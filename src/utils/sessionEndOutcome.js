/** Minimum both-present call length before a booking is marked completed. */
export const MIN_SESSION_COMPLETE_SECONDS = 300;

/**
 * Pure post-call outcome used by VideoCallScreen after leave.
 * `bothJoinedAt` is set only when participantCount reaches 2.
 */
export function resolveSessionEndOutcome({
  bothJoinedAt,
  endedAt = new Date(),
  isMentorHost = false,
}) {
  const callDurationSec = bothJoinedAt
    ? Math.max(0, Math.round((endedAt - bothJoinedAt) / 1000))
    : 0;

  if (bothJoinedAt && callDurationSec >= MIN_SESSION_COMPLETE_SECONDS) {
    return {
      kind: 'completed',
      callDurationSec,
      shouldMarkCompleted: Boolean(isMentorHost),
      shouldStopRecording: Boolean(isMentorHost),
      shouldFetchRecording: Boolean(isMentorHost),
      shouldClearMeetingId: false,
      toast: 'Session completed',
    };
  }

  if (!bothJoinedAt) {
    return {
      kind: 'abandoned',
      callDurationSec: 0,
      shouldMarkCompleted: false,
      shouldStopRecording: Boolean(isMentorHost),
      shouldFetchRecording: false,
      shouldClearMeetingId: Boolean(isMentorHost),
      toast: 'Session ended - Meeting abandoned',
    };
  }

  return {
    kind: 'too_short',
    callDurationSec,
    shouldMarkCompleted: false,
    shouldStopRecording: Boolean(isMentorHost),
    shouldFetchRecording: false,
    shouldClearMeetingId: false,
    toast: 'Session ended — minimum 5 minutes required for completion',
  };
}
