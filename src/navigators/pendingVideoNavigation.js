/** Holds the next video to open in Search → Videos (survives nested tab navigation). */
let pending = null;

export function setPendingLearnerVideo({ mentorId, videoId } = {}) {
  if (!videoId && !mentorId) {
    pending = null;
    return;
  }
  pending = {
    mentorId: mentorId != null ? String(mentorId) : null,
    videoId: videoId != null ? String(videoId) : null,
  };
}

export function consumePendingLearnerVideo() {
  const value = pending;
  pending = null;
  return value;
}
