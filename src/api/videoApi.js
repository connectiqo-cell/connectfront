import { Video as VideoCompressor, getVideoMetaData } from 'react-native-compressor';
import NetInfo from '@react-native-community/netinfo';
import { uploadResumable } from '../lib/resumableUpload';
import { uploadErrorMessage } from '../lib/uploadErrors';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { getSupabaseErrorMessage } from '../lib/supabaseErrorHandler';
import { VIDEO_UNLOCK_PRICE_TIERS } from '../utils/videoUnlockTiers';
import { isMentorFreezeActive } from '../utils/mentorFreeze';

const BUCKET = 'mentor-videos';
// Phone cameras record ~17 Mbps for archival. 1080p @ 3 Mbps is what Reels/Shorts serve,
// and it cuts upload time ~5x — which is what makes uploads survive weak networks.
const TARGET_BITRATE = 3_000_000;
// Cellular target. Supabase's TUS endpoint needs 6MB chunks and only commits whole
// ones, so on a weak link a chunk can fail repeatedly and never land. Fewer bytes
// means fewer chunks and a real chance of each completing.
//
// The quality cost is now small: the server transcodes to an HLS ladder anyway, so
// a 720p upload still yields 360p and 720p rungs. Only the 1080p rung is lost, and
// only for videos uploaded on mobile data.
const CELLULAR_BITRATE = 1_200_000;

async function compressTargets() {
  try {
    const net = await NetInfo.fetch();
    if (net?.type === 'cellular') {
      return { compressionMethod: 'manual', maxSize: 1280, bitrate: CELLULAR_BITRATE };
    }
  } catch (e) {
    console.warn('[compressTargets] NetInfo failed, assuming wifi:', e?.message || e);
  }
  return { compressionMethod: 'manual', maxSize: 1920, bitrate: TARGET_BITRATE };
}

/**
 * Re-encode only when it actually helps.
 *
 * Forcing a fixed bitrate onto a source that is already below it makes the file BIGGER
 * (a 7.8MB/1.4Mbps clip came back as 17MB at 3Mbps). So: skip clips already at or under
 * the target, and if the encoder still returns something larger, keep the original.
 */
async function compressIfWorthIt(sourceUri, onProgress) {
  const opts = await compressTargets();
  let sourceSize = 0;
  try {
    const meta = await getVideoMetaData(sourceUri);
    sourceSize = meta?.size || 0;
    const duration = meta?.duration || 0;
    if (sourceSize && duration) {
      const sourceBitrate = (sourceSize * 8) / duration;
      // 1.2x margin: a marginal saving is not worth a minute of CPU on an old phone.
      if (sourceBitrate <= opts.bitrate * 1.2) return sourceUri;
    }
  } catch (e) {
    console.warn('[compressIfWorthIt] metadata read failed:', e?.message || e);
  }

  const outUri = await VideoCompressor.compress(sourceUri, opts, (p) =>
    onProgress?.(Math.min(100, Math.round((p || 0) * 100)), 'compressing'));

  if (sourceSize) {
    try {
      const outMeta = await getVideoMetaData(outUri);
      if ((outMeta?.size || 0) >= sourceSize) return sourceUri;
    } catch {
      // can't measure the result — trust it rather than discarding the work
    }
  }
  return outUri;
}
const THUMB_BUCKET = 'mentor-videos-thumbnail';

async function fetchActiveMentorIds(mentorIds) {
  const unique = [...new Set((mentorIds || []).filter(Boolean))];
  if (!unique.length) return new Set();
  const { data } = await supabase
    .from('mentor_profiles')
    .select('id, mentor_frozen, mentor_frozen_until')
    .in('id', unique);
  const active = new Set();
  (data || []).forEach((row) => {
    if (!isMentorFreezeActive(row)) active.add(row.id);
  });
  // Mentors missing from result (RLS-hidden while frozen) stay out of the set.
  return active;
}

/**
 * Recover an object's storage path from its public URL.
 * Public URLs look like .../object/public/<bucket>/<path>?maybe=query
 */
export function storagePathFromPublicUrl(url, bucket) {
  if (!url || typeof url !== 'string') return null;
  const marker = `/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function extractErrorMsg(parsed) {
  if (!parsed) return null;
  const e = parsed.error;
  if (typeof e === 'string') return e;
  if (e && typeof e.message === 'string') return e.message;
  if (typeof parsed.message === 'string') return parsed.message;
  return null;
}

// XHR upload — Supabase JS client v2 + React Native FormData is incompatible (body.has error)
const STALL_MS = 90000; // no upload progress for this long = dead socket, abort and retry
const UPLOAD_ATTEMPTS = 3;

const uploadOnce = (storagePath, fileUri, fileName, contentType, token, onProgress, bucket) =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('', { uri: fileUri, name: fileName, type: contentType });

    const xhr = new XMLHttpRequest();
    let stallTimer = null;
    let aborted = false;
    const clearStall = () => { if (stallTimer) clearTimeout(stallTimer); stallTimer = null; };
    const armStall = () => {
      clearStall();
      stallTimer = setTimeout(() => { aborted = true; xhr.abort(); }, STALL_MS);
    };

    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.upload.onprogress = (e) => {
      armStall();
      if (onProgress && e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      clearStall();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        const err = new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`);
        err.retryable = xhr.status === 0 || xhr.status === 408 || xhr.status === 429 || xhr.status >= 500;
        reject(err);
      }
    };
    xhr.onerror = () => {
      clearStall();
      const err = new Error('Network error during upload');
      err.retryable = true;
      reject(err);
    };
    xhr.onabort = () => {
      clearStall();
      const err = new Error(aborted ? 'Upload stalled' : 'Upload cancelled');
      err.retryable = aborted;
      reject(err);
    };
    armStall();
    xhr.send(formData);
  });

// Weak/flaky mobile networks drop the socket mid-upload; one failed POST is not a failed upload.
export const uploadFileXHR = async (storagePath, fileUri, fileName, contentType, token, onProgress, bucket = BUCKET) => {
  let lastError;
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      if (onProgress) onProgress(0, 'uploading');
      return await uploadOnce(storagePath, fileUri, fileName, contentType, token, onProgress, bucket);
    } catch (e) {
      lastError = e;
      if (!e.retryable || attempt === UPLOAD_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (lastError?.retryable) {
    throw new Error('Upload failed — your connection dropped. Move to a stronger network and try again.');
  }
  throw lastError;
};

export const videoApi = {
  // ─── Mentor: upload one queued video ───────────────────────────────────────
  // Takes a persisted queue record and finishes whatever is left of it. Every step
  // writes its result back through `patch`, so a kill mid-upload resumes at the last
  // completed step instead of recompressing and re-uploading from scratch.
  uploadQueuedVideo: async (record, { onProgress, patch } = {}) => {
    const savePatch = patch || (() => {});
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      let uploadUri = record.compressedUri;
      if (!uploadUri) {
        try {
          uploadUri = await compressIfWorthIt(record.sourceUri, onProgress);
          await savePatch({ compressedUri: uploadUri });
        } catch (e) {
          // Compression is an optimisation, not a gate. A codec the device can't handle
          // must not block the upload — send the original instead.
          console.warn('[uploadQueuedVideo] compression failed, using original:', e?.message || e);
          uploadUri = record.sourceUri;
        }
      }

      const srcExt = (uploadUri.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
      const contentType = srcExt === 'mov' ? 'video/quicktime' : `video/${srcExt}`;

      // storagePath is fixed at enqueue time — it is the resume key, so it must not
      // change between attempts even if the compressor output does.
      await uploadResumable({
        bucket: BUCKET,
        storagePath: record.storagePath,
        fileUri: uploadUri,
        contentType,
        token: session.access_token,
        onProgress,
      });

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(record.storagePath);

      let thumbnailUrl = record.thumbnailUrl || null;
      if (!thumbnailUrl && record.thumbnailUri && record.thumbnailFileName) {
        const thumbExt = (record.thumbnailFileName.split('.').pop() || 'jpg').toLowerCase();
        const thumbContentType = `image/${thumbExt === 'jpg' ? 'jpeg' : thumbExt}`;
        const thumbPath = `${record.mentorId}/${Date.now()}_thumb.${thumbExt}`;
        await uploadFileXHR(thumbPath, record.thumbnailUri, record.thumbnailFileName, thumbContentType, session.access_token, undefined, THUMB_BUCKET);
        const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
          .from(THUMB_BUCKET)
          .getPublicUrl(thumbPath);
        thumbnailUrl = thumbPublicUrl;
        await savePatch({ thumbnailUrl });
      }

      const { data, error } = await supabase
        .from('mentor_videos')
        .insert({
          mentor_id: record.mentorId,
          title: record.title,
          description: record.description,
          video_url: publicUrl,
          storage_path: record.storagePath,
          is_free: record.isFree,
          thumbnail_url: thumbnailUrl,
        })
        .select('id, mentor_id, title, description, storage_path, thumbnail_url, is_free, position, is_promoted, promoted_at, created_at')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(uploadErrorMessage(error));
    }
  },

  // ─── Get all public videos across all mentors (for learner feed) ────────────
  getAllPublicVideos: async ({ page = 0, pageSize = 20, excludeMentorId = null } = {}) => {
    try {
      const from = page * pageSize;

      // Step 1: videos via RPC — video_url/hls_url are no longer SELECT-able on the
      // table; the function nulls them server-side for paid videos the viewer hasn't
      // unlocked. Ordering and paging live inside the function.
      const { data: rpcVideos, error } = await supabase.rpc('get_public_videos_for_viewer', {
        p_limit: pageSize,
        p_offset: from,
      });

      if (error) throw error;
      // excludeMentorId now filters after paging (the RPC pages internally), so a page
      // may come back short rather than topped up.
      const videos = excludeMentorId
        ? (rpcVideos || []).filter((v) => String(v.mentor_id) !== String(excludeMentorId))
        : (rpcVideos || []);
      if (!videos.length) return [];

      // Step 2: profiles + mentor_profiles for the unique mentor IDs (the RPC returns
      // video columns only, so the joined profile has to come separately)
      const mentorIds = [...new Set(videos.map(v => v.mentor_id))];
      const [{ data: profiles }, { data: mentorProfiles }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', mentorIds),
        supabase
          .from('mentor_profiles')
          .select('id, specialization, unlock_price, category, mentor_frozen, mentor_frozen_until')
          .in('id', mentorIds),
      ]);
      const nameMap = {};
      (profiles || []).forEach(pr => { nameMap[pr.id] = pr; });

      // Step 3: merge — drop videos whose mentor is currently frozen
      const profileMap = {};
      (mentorProfiles || []).forEach(mp => {
        if (!isMentorFreezeActive(mp)) profileMap[mp.id] = mp;
      });

      return videos
        .filter((v) => profileMap[v.mentor_id])
        .map(v => ({
          ...v,
          profiles: nameMap[v.mentor_id] || { id: v.mentor_id, name: null, avatar_url: null },
          mentor_profiles: profileMap[v.mentor_id] || { specialization: '', unlock_price: 299, category: null },
        }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** One video by id (same shape as getAllPublicVideos) — for deep links / startVideoId. */
  getPublicVideoById: async (videoId) => {
    try {
      const { data: rows, error } = await supabase.rpc('get_public_video_by_id', {
        p_video_id: videoId,
      });

      if (error) throw error;
      const video = rows?.[0];
      if (!video) return null;

      const [{ data: profile }, { data: mentorProfile }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').eq('id', video.mentor_id).maybeSingle(),
        supabase
          .from('mentor_profiles')
          .select('id, specialization, unlock_price, category, mentor_frozen, mentor_frozen_until')
          .eq('id', video.mentor_id)
          .maybeSingle(),
      ]);

      if (!mentorProfile || isMentorFreezeActive(mentorProfile)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id || String(user.id) !== String(video.mentor_id)) {
          return null;
        }
      }

      return {
        ...video,
        profiles: profile || { id: video.mentor_id, name: null, avatar_url: null },
        mentor_profiles: mentorProfile || { specialization: '', unlock_price: 299, category: null },
      };
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Like/dislike counts for a batch of videos (video_reaction_counts view). */
  getVideoReactionCounts: async (videoIds) => {
    const map = new Map();
    const ids = [...new Set((videoIds || []).map((id) => String(id)).filter(Boolean))];
    if (!ids.length) return map;
    try {
      const { data, error } = await supabase
        .from('video_reaction_counts')
        .select('video_id, like_count, dislike_count')
        .in('video_id', ids);
      if (error) throw error;
      (data || []).forEach((row) => {
        map.set(String(row.video_id), {
          likeCount: Number(row.like_count) || 0,
          dislikeCount: Number(row.dislike_count) || 0,
        });
      });
      return map;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Current user's reactions for a batch of videos. */
  getMyVideoReactions: async (userId, videoIds) => {
    const map = new Map();
    const uid = userId ? String(userId) : '';
    const ids = [...new Set((videoIds || []).map((id) => String(id)).filter(Boolean))];
    if (!uid || !ids.length) return map;
    try {
      const { data, error } = await supabase
        .from('video_reactions')
        .select('video_id, reaction')
        .eq('user_id', uid)
        .in('video_id', ids);
      if (error) throw error;
      (data || []).forEach((row) => {
        if (row.reaction === 'like' || row.reaction === 'dislike') {
          map.set(String(row.video_id), row.reaction);
        }
      });
      return map;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Set/switch/clear reaction. null clears it. Idempotent across app/web. */
  setVideoReaction: async ({ videoId, userId, reaction }) => {
    const vid = String(videoId);
    const uid = String(userId);
    try {
      if (reaction === null) {
        const { error } = await supabase
          .from('video_reactions')
          .delete()
          .eq('video_id', vid)
          .eq('user_id', uid);
        if (error) throw error;
        return;
      }
      if (reaction !== 'like' && reaction !== 'dislike') {
        throw new Error('Invalid reaction');
      }

      const { data: existing, error: findError } = await supabase
        .from('video_reactions')
        .select('id, reaction')
        .eq('video_id', vid)
        .eq('user_id', uid)
        .maybeSingle();
      if (findError) throw findError;

      if (existing?.id) {
        if (existing.reaction === reaction) return;
        const { error } = await supabase
          .from('video_reactions')
          .update({ reaction })
          .eq('id', existing.id)
          .eq('user_id', uid);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('video_reactions')
        .insert({ video_id: vid, user_id: uid, reaction });
      if (error) {
        if (String(error.code) === '23505' || /duplicate|unique/i.test(error.message || '')) {
          const { error: updErr } = await supabase
            .from('video_reactions')
            .update({ reaction })
            .eq('video_id', vid)
            .eq('user_id', uid);
          if (updErr) throw updErr;
          return;
        }
        throw error;
      }
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Get unlocked mentor IDs for a learner (active, non-expired) → Map<mentorId, {expiresAt}>
  // Frozen mentors are omitted so subscribed playback pauses during suspension.
  getLearnerUnlocks: async (learnerId) => {
    try {
      const { data, error } = await supabase
        .from('learner_unlocks')
        .select('mentor_id, expires_at')
        .eq('learner_id', learnerId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (error) throw error;
      const rows = data || [];
      const activeMentorIds = await fetchActiveMentorIds(rows.map((u) => u.mentor_id));
      const map = new Map();
      rows.forEach((u) => {
        if (activeMentorIds.has(u.mentor_id)) {
          map.set(u.mentor_id, { expiresAt: u.expires_at });
        }
      });
      return map;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Active video-library subscriptions with mentor names (Settings / profile) ─
  getLearnerActiveSubscriptionsDetail: async (learnerId) => {
    try {
      const iso = new Date().toISOString();
      const { data, error } = await supabase
        .from('learner_unlocks')
        .select(`
          mentor_id,
          expires_at,
          unlocked_at,
          profiles:mentor_id ( id, name, avatar_url )
        `)
        .eq('learner_id', learnerId)
        .or(`expires_at.is.null,expires_at.gt.${iso}`)
        .order('expires_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Get full subscription list for a learner (for transaction history) ──────
  getLearnerSubscriptions: async (learnerId) => {
    try {
      // Step 1: fetch unlock records
      const { data: unlocks, error } = await supabase
        .from('learner_unlocks')
        .select('id, mentor_id, amount_paid, unlocked_at, expires_at')
        .eq('learner_id', learnerId)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;
      if (!unlocks?.length) return [];

      // Step 2: fetch mentor profiles for all unique mentor IDs
      const mentorIds = [...new Set(unlocks.map(u => u.mentor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', mentorIds);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      return unlocks.map(u => ({
        ...u,
        profiles: profileMap[u.mentor_id] || null,
      }));
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Create Razorpay order for video subscription ─────────────────────────
  createVideoOrder: async ({ mentorId, learnerId }) => {
    try {
      const activeMentorIds = await fetchActiveMentorIds([mentorId]);
      if (!activeMentorIds.has(mentorId)) {
        throw new Error('This creator is temporarily unavailable.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token ?? SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-video-order`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${userToken}`,
          'apikey':        SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ mentorId, learnerId }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('[createVideoOrder] error response:', text);
        const parsed = tryParseJson(text);
        throw new Error(extractErrorMsg(parsed) || `Order creation failed (${res.status})`);
      }
      return JSON.parse(text);
    } catch (error) {
      throw new Error(typeof error.message === 'string' ? error.message : 'Failed to create order');
    }
  },

  // ─── Verify payment + record subscription server-side ────────────────────
  verifyVideoSubscription: async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature, mentorId, learnerId }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token ?? SUPABASE_ANON_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-video-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${userToken}`,
          'apikey':        SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ razorpayOrderId, razorpayPaymentId, razorpaySignature, mentorId, learnerId }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('[verifyVideoSubscription] error response:', text);
        const parsed = tryParseJson(text);
        throw new Error(extractErrorMsg(parsed) || `Verification failed (${res.status})`);
      }
      return JSON.parse(text);
    } catch (error) {
      throw new Error(typeof error.message === 'string' ? error.message : 'Payment verification failed');
    }
  },

  // ─── Get all videos for a mentor (ordered by position then created_at) ───────
  getMentorVideos: async (mentorId) => {
    try {
      const { data: mentorRow } = await supabase
        .from('mentor_profiles')
        .select('id, mentor_frozen, mentor_frozen_until')
        .eq('id', mentorId)
        .maybeSingle();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isOwner = user?.id && String(user.id) === String(mentorId);

      // Non-owners cannot load a frozen mentor's library (Instagram-style pause).
      if (!isOwner && (!mentorRow || isMentorFreezeActive(mentorRow))) {
        return [];
      }

      const { data, error } = await supabase.rpc('get_mentor_videos_for_viewer', {
        p_mentor_id: mentorId,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  /** Active (non-expired) video-library subscribers for a mentor — uses RPC (see migration 007). */
  getMentorActiveSubscriberCount: async (mentorId) => {
    try {
      const { data, error } = await supabase.rpc('mentor_active_subscriber_count', { p_mentor_id: mentorId });
      if (error) throw error;
      const n = Number(data);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    } catch (error) {
      console.warn('[getMentorActiveSubscriberCount]', error?.message || error);
      return 0;
    }
  },

  // ─── Update video metadata (+ optional new thumbnail) ───────────────────────
  updateVideo: async ({
    id,
    title,
    description,
    isFree,
    position,
    thumbnailUri,
    thumbnailFileName,
    mentorId,
  }) => {
    try {
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (isFree !== undefined) updates.is_free = isFree;
      if (position !== undefined) updates.position = position;

      if (thumbnailUri && thumbnailFileName && mentorId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const thumbExt = (thumbnailFileName.split('.').pop() || 'jpg').toLowerCase();
        const thumbContentType = `image/${thumbExt === 'jpg' ? 'jpeg' : thumbExt}`;
        const thumbPath = `${mentorId}/${Date.now()}_thumb.${thumbExt}`;
        await uploadFileXHR(
          thumbPath,
          thumbnailUri,
          thumbnailFileName,
          thumbContentType,
          session.access_token,
          undefined,
          THUMB_BUCKET,
        );
        const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
          .from(THUMB_BUCKET)
          .getPublicUrl(thumbPath);
        updates.thumbnail_url = `${thumbPublicUrl}?t=${Date.now()}`;
      }

      if (!Object.keys(updates).length) {
        throw new Error('Nothing to update');
      }

      const { data, error } = await supabase
        .from('mentor_videos')
        .update(updates)
        .eq('id', id)
        .select('id, mentor_id, title, description, storage_path, thumbnail_url, is_free, position, is_promoted, promoted_at, created_at')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Delete video from storage + table ───────────────────────────────────────
  deleteVideo: async ({ id, storagePath, thumbnailUrl }) => {
    try {
      // Storage cleanup is best-effort and runs before the row delete. A storage
      // hiccup must not leave the mentor unable to remove their video — an orphaned
      // file is a smaller problem than a video that refuses to disappear.
      const cleanup = async (label, fn) => {
        try { await fn(); } catch (e) {
          console.warn(`[deleteVideo] ${label} cleanup failed:`, e?.message || e);
        }
      };

      if (storagePath) {
        await cleanup('original', () => supabase.storage.from(BUCKET).remove([storagePath]));
      }

      // The HLS ladder is a folder of manifests and segments, not a single file.
      await cleanup('hls', async () => {
        const { data: files } = await supabase.storage.from(BUCKET).list(`hls/${id}`);
        if (files?.length) {
          await supabase.storage
            .from(BUCKET)
            .remove(files.map(f => `hls/${id}/${f.name}`));
        }
      });

      const thumbPath = storagePathFromPublicUrl(thumbnailUrl, THUMB_BUCKET);
      if (thumbPath) {
        await cleanup('thumbnail', () =>
          supabase.storage.from(THUMB_BUCKET).remove([thumbPath]));
      }

      const { error } = await supabase
        .from('mentor_videos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Check if learner has unlocked a mentor's library ────────────────────────
  checkUnlocked: async ({ learnerId, mentorId }) => {
    try {
      const activeMentorIds = await fetchActiveMentorIds([mentorId]);
      if (!activeMentorIds.has(mentorId)) return false;

      const iso = new Date().toISOString();
      const { data, error } = await supabase
        .from('learner_unlocks')
        .select('id, unlocked_at')
        .eq('learner_id', learnerId)
        .eq('mentor_id', mentorId)
        .or(`expires_at.is.null,expires_at.gt.${iso}`)
        .maybeSingle();

      if (error) throw error;
      return data !== null;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Record unlock after successful Razorpay payment ─────────────────────────
  recordUnlock: async ({ learnerId, mentorId, amountPaid }) => {
    try {
      const { data, error } = await supabase
        .from('learner_unlocks')
        .upsert({ learner_id: learnerId, mentor_id: mentorId, amount_paid: amountPaid }, { onConflict: 'learner_id,mentor_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Set mentor's library unlock price ───────────────────────────────────────
  // Must be one of VIDEO_UNLOCK_PRICE_TIERS (website catalog pricing).
  // products need a fixed price per product ID, so this can't be a free-form
  // amount (also enforced by a DB check constraint as the source of truth).
  setUnlockPrice: async ({ mentorId, price }) => {
    try {
      if (!VIDEO_UNLOCK_PRICE_TIERS.includes(price)) {
        throw new Error(`Price must be one of: ₹${VIDEO_UNLOCK_PRICE_TIERS.join(', ₹')}`);
      }
      const { error } = await supabase
        .from('mentor_profiles')
        .update({ unlock_price: price })
        .eq('id', mentorId);

      if (error) throw error;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },

  // ─── Get mentor's unlock price ────────────────────────────────────────────────
  getUnlockPrice: async (mentorId) => {
    try {
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select('unlock_price')
        .eq('id', mentorId)
        .single();

      if (error) throw error;
      return data?.unlock_price || 299;
    } catch (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  },
};
