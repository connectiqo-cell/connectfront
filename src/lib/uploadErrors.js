/**
 * Turn an upload failure into something a mentor can act on.
 *
 * Raw tus and Supabase errors are unusable in a UI — they read like
 * "tus: unexpected response while creating upload, originated from request
 * (method: POST, url: …, response code: 403 …)".
 *
 * Every message here says what happened and what to do, and — because the queue
 * persists the job — reassures the mentor their video is not lost. That last part
 * is true: a failed record stays on disk and retries.
 */

/** tus wraps the HTTP response; plain fetch/Supabase errors expose status directly. */
function statusOf(error) {
  const fromTus = error?.originalResponse?.getStatus?.();
  if (typeof fromTus === 'number') return fromTus;
  if (typeof error?.status === 'number') return error.status;
  // Last resort: tus bakes the code into its message text.
  const match = /response code:\s*(\d{3})/i.exec(error?.message || '');
  return match ? Number(match[1]) : 0;
}

export function uploadErrorMessage(error) {
  const raw = String(error?.message || '');
  const status = statusOf(error);

  // Our own watchdogs, raised in resumableUpload.
  if (raw.includes('Connection too slow')) {
    return 'Your connection is too slow to finish this upload. Your video is saved — try again on stronger signal or Wi-Fi.';
  }
  if (raw.includes('Upload stalled')) {
    return 'The connection dropped while uploading. Your video is saved and will retry automatically.';
  }

  // Size limits, client guard or server rejection.
  if (status === 413 || /too large|entity too large|exceeded.*size|maximum.*size/i.test(raw)) {
    return 'This video is too large to upload. Please choose a shorter clip, or one under 80 MB.';
  }

  // Storage full on our side — nothing the mentor can do.
  if (status === 507 || /quota|storage.*full|insufficient storage/i.test(raw)) {
    return 'We have run out of storage space. Please contact support — this is on our side, not yours.';
  }

  if (status === 401 || /jwt|not authenticated|invalid token|expired/i.test(raw)) {
    return 'Your session expired. Please sign in again, then tap Retry.';
  }
  if (status === 403) {
    return 'You do not have permission to upload this video. Please sign in again, or contact support if it continues.';
  }
  if (status === 429 || /rate limit|too many requests/i.test(raw)) {
    return 'Too many uploads at once. Your video is saved and will upload shortly.';
  }

  // Anything 5xx is ours to apologise for.
  if (status >= 500) {
    return 'Our server is having trouble right now. Sorry about that — your video is saved and will upload automatically once it recovers.';
  }

  // No usable connection at all. A bare status of 0 is NOT enough on its own —
  // it is also what we get for any error with no HTTP response, and claiming
  // "you are offline" when they are not is worse than a generic message.
  // tus sets originalRequest but no originalResponse when a request got no reply.
  const requestGotNoReply = !!error?.originalRequest && !error?.originalResponse;
  if (
    requestGotNoReply ||
    /network|offline|failed to fetch|connection|timeout|timed out|unreachable|ENOTFOUND|ECONNRESET/i.test(raw)
  ) {
    return 'No internet connection. Your video is saved and will upload as soon as you are back online.';
  }

  return 'Something went wrong while uploading. Your video is saved and we will try again automatically.';
}
