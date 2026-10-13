/**
 * Resolve who the local user can report during a live booking call.
 * Prefer explicit otherUser from the lobby; fall back to booking mentor/learner IDs.
 */
export function resolveMeetingReportTarget({
  booking,
  user,
  profile,
  isMentor = null,
  otherUser = null,
} = {}) {
  const myId = profile?.id || user?.id;
  if (!myId || !booking?.id) {
    return { userId: null, name: 'this user', contextId: null };
  }

  const me = String(myId);
  const mentorId = booking.mentor_id != null ? String(booking.mentor_id) : null;
  const learnerId = booking.learner_id != null ? String(booking.learner_id) : null;

  let otherId = otherUser?.id != null ? String(otherUser.id) : null;
  let otherName = typeof otherUser?.name === 'string' && otherUser.name.trim()
    ? otherUser.name.trim()
    : null;

  if (!otherId) {
    if (mentorId && me === mentorId) otherId = learnerId;
    else if (learnerId && me === learnerId) otherId = mentorId;
    else if (isMentor === true && learnerId) otherId = learnerId;
    else if (isMentor === false && mentorId) otherId = mentorId;
  }

  if (!otherId || otherId === me) {
    return { userId: null, name: 'this user', contextId: booking.id };
  }

  if (!otherName) {
    if (learnerId && otherId === learnerId) {
      otherName =
        booking.profiles?.name ||
        booking.learner_profile?.name ||
        booking.learner?.name ||
        'Creator';
    } else if (mentorId && otherId === mentorId) {
      otherName =
        booking.mentor_profile?.name ||
        booking.mentor?.name ||
        'Creator';
    }
  }

  return {
    userId: otherId,
    name: otherName || 'this user',
    contextId: booking.id,
  };
}
