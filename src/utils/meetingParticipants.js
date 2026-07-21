/**
 * VideoSDK's `participants` map may include the local peer depending on SDK
 * timing. These helpers always treat local + remote separately.
 */
export function getMeetingParticipantSnapshot(participants, localParticipantId) {
  const remoteParticipantIds = [...participants.keys()].filter(
    (id) => id && id !== localParticipantId,
  );

  return {
    remoteParticipantIds,
    remoteParticipantId: remoteParticipantIds[0] ?? null,
    participantIds: localParticipantId
      ? [localParticipantId, ...remoteParticipantIds]
      : remoteParticipantIds,
    remoteParticipantCount: remoteParticipantIds.length,
    participantCount: (localParticipantId ? 1 : 0) + remoteParticipantIds.length,
  };
}
