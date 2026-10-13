import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pendingVideoUploads';

/**
 * Pending video uploads, persisted so an upload outlives the modal, the screen and
 * the app process. Each record carries everything needed to finish the job from
 * scratch, and `storagePath` stays fixed across attempts so the resumable upload can
 * pick up at the server's offset instead of starting over.
 *
 * ponytail: one queue, processed serially, no concurrency control. Mentors upload one
 * video at a time; add a worker pool only if that stops being true.
 */

const listeners = new Set();
let running = false;

const readAll = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
};

const writeAll = async (records) => {
  await AsyncStorage.setItem(KEY, JSON.stringify(records));
  listeners.forEach(fn => fn(records));
};

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const listPending = readAll;

export const enqueue = async (record) => {
  const records = await readAll();
  await writeAll([...records, record]);
  return record;
};

export const patchRecord = async (id, patch) => {
  const records = await readAll();
  await writeAll(records.map(r => (r.id === id ? { ...r, ...patch } : r)));
};

export const removeRecord = async (id) => {
  const records = await readAll();
  await writeAll(records.filter(r => r.id !== id));
};

/**
 * Run every pending record to completion, oldest first.
 *
 * `work(record, patch)` performs one upload and resolves with the inserted row.
 * Records are only removed once their work resolves, so a crash or a kill mid-upload
 * leaves the record on disk to be retried on the next run.
 */
export const processQueue = async (work, { onDone, onError } = {}) => {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    for (const record of await readAll()) {
      // A record that just failed is in backoff. Skipping it matters on a weak
      // network: without this, a fresh upload queues behind a doomed retry and
      // the mentor waits out its whole failure before their new video starts.
      if (record.nextAttemptAt && record.nextAttemptAt > now) continue;

      try {
        const result = await work(record, patch => patchRecord(record.id, patch));
        await removeRecord(record.id);
        onDone?.(record, result);
      } catch (e) {
        // Keep the record: the next run resumes it rather than losing the mentor's work.
        const attempts = (record.attempts || 0) + 1;
        await patchRecord(record.id, {
          attempts,
          error: e?.message || 'Upload failed',
          // 30s, 2m, 8m, capped at 30m.
          nextAttemptAt: Date.now() + Math.min(30 * 60000, 30000 * 4 ** (attempts - 1)),
        });
        onError?.(record, e);
      }
    }
  } finally {
    running = false;
  }
};

/** Clear backoff so a user-initiated Retry runs immediately. */
export const retryNow = async (id) => {
  await patchRecord(id, { nextAttemptAt: 0, error: null });
};

/**
 * Drop all backoff. Called once on app start: a fresh launch means the user is
 * present and the network may well have changed, so making them wait out a
 * backoff set in a previous session would be pointless.
 */
export const clearBackoff = async () => {
  const records = await readAll();
  if (!records.some(r => r.nextAttemptAt)) return;
  await writeAll(records.map(r => ({ ...r, nextAttemptAt: 0 })));
};
