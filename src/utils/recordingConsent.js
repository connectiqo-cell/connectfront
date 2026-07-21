/** Learner chose "Yes, record it" at booking (required for any recording in this session). */
export function isRecordingRequestedForBooking(booking) {
  return booking?.recording_requested === true;
}

/** Both peers are in the room — requires a known local id and at least one remote. */
export function areBothCallParticipantsPresent(localParticipantId, remoteParticipantCount) {
  return Boolean(localParticipantId) && remoteParticipantCount >= 1;
}

/**
 * Checkout transaction is the source of truth when present; otherwise use booking row.
 */
export function resolveRecordingRequestedFromRows(booking, transaction) {
  if (typeof transaction?.recording_requested === 'boolean') {
    return transaction.recording_requested;
  }
  return booking?.recording_requested === true;
}
