import AsyncStorage from '@react-native-async-storage/async-storage';
import * as tus from 'tus-js-client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

// Supabase's TUS endpoint rejects any chunk size other than 6MB.
const CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_ENDPOINT = `${SUPABASE_URL}/storage/v1/upload/resumable`;
const KEY_PREFIX = 'tus::';

/**
 * tus-js-client ships a localStorage-backed store, which React Native does not have.
 * Without a store the client forgets the upload URL, so a resumed upload restarts at
 * byte 0 — the exact failure we are trying to remove.
 */
export class AsyncStorageUrlStorage {
  async findAllUploads() {
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(KEY_PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs
      .map(([urlStorageKey, value]) => {
        try {
          return { ...JSON.parse(value), urlStorageKey };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async findUploadsByFingerprint(fingerprint) {
    const all = await this.findAllUploads();
    return all.filter(u => u.urlStorageKey.startsWith(`${KEY_PREFIX}${fingerprint}::`));
  }

  async removeUpload(urlStorageKey) {
    await AsyncStorage.removeItem(urlStorageKey);
  }

  async addUpload(fingerprint, upload) {
    const key = `${KEY_PREFIX}${fingerprint}::${Date.now()}`;
    await AsyncStorage.setItem(key, JSON.stringify(upload));
    return key;
  }
}

const urlStorage = new AsyncStorageUrlStorage();

/**
 * Resumable upload to Supabase Storage.
 *
 * Unlike a plain POST, a dropped connection resumes from the server's recorded offset
 * instead of re-sending the whole file. `storagePath` is the resume key, so a caller that
 * wants to resume after an app restart must persist it and pass the same value back.
 */
// No progress for this long means a dead socket. Bad signal can hold a half-open
// connection far longer than the retry delays suggest, so bound it ourselves.
const STALL_MS = 60000;

// Supabase requires 6MB chunks (S3 multipart has a 5MB floor), and the server only
// commits whole chunks. On a flaky link a chunk can fail at 5MB repeatedly, and
// tus resets its retry counter whenever bytes move — so it retries forever while
// the committed offset never advances. STALL_MS cannot see this: data IS flowing.
// This is the backstop that turns an invisible loop into a visible failure.
const ATTEMPT_BUDGET_MS = 8 * 60000;

/** A resume target the server no longer knows about. Retrying it can never succeed. */
const isDeadResume = (err) => {
  const code = err?.originalResponse?.getStatus?.();
  return code === 404 || code === 410 || code === 403;
};

export const uploadResumable = ({
  bucket,
  storagePath,
  fileUri,
  contentType,
  token,
  onProgress,
}) => {
  const fingerprint = `${bucket}/${storagePath}`;

  const attempt = (allowResume) =>
    new Promise((resolve, reject) => {
      let stallTimer = null;
      let budgetTimer = null;
      let settled = false;

      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(stallTimer);
        clearTimeout(budgetTimer);
        fn(arg);
      };

      const upload = new tus.Upload(
        { uri: fileUri },
        {
          endpoint: TUS_ENDPOINT,
          chunkSize: CHUNK_SIZE,
          // Shorter than the default ladder: the persistent queue retries anyway,
          // and a long in-process backoff just delays the mentor's next upload.
          retryDelays: [0, 3000, 10000],
          removeFingerprintOnSuccess: true,
          urlStorage,
          // Stable across attempts and app launches, unlike the default which hashes
          // a React Native file object that differs every pick.
          fingerprint: async () => fingerprint,
          metadata: {
            bucketName: bucket,
            objectName: storagePath,
            contentType,
            cacheControl: '3600',
          },
          // No x-upsert: storagePath is unique per upload, and asking to overwrite
          // demands UPDATE on storage.objects, which this bucket does not grant.
          headers: {
            authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
          },
          onProgress: (sent, total) => {
            armStall();
            if (onProgress && total > 0) {
              onProgress(Math.min(100, Math.round((sent / total) * 100)), 'uploading');
            }
          },
          onSuccess: () => finish(resolve),
          onError: (error) => finish(reject, error),
        },
      );

      function armStall() {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          upload.abort();
          finish(reject, new Error('Upload stalled'));
        }, STALL_MS);
      }

      const begin = (previous) => {
        if (allowResume && previous?.length) upload.resumeFromPreviousUpload(previous[0]);
        armStall();
        budgetTimer = setTimeout(() => {
          upload.abort();
          finish(reject, new Error('Connection too slow — upload could not complete'));
        }, ATTEMPT_BUDGET_MS);
        upload.start();
      };

      if (!allowResume) {
        begin(null);
        return;
      }
      upload.findPreviousUploads().then(begin, () => begin(null));
    });

  // Resume first. If the server has forgotten that upload, the stored URL is poison —
  // drop it and start clean rather than retrying a dead target on every attempt.
  return attempt(true).catch(async (err) => {
    if (!isDeadResume(err)) throw err;
    for (const u of await urlStorage.findUploadsByFingerprint(fingerprint)) {
      await urlStorage.removeUpload(u.urlStorageKey);
    }
    return attempt(false);
  });
};
