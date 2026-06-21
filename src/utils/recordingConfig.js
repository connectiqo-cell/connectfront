/**
 * VideoSDK cloud recording layout for 1-on-1 mentoring calls.
 * Portrait + GRID gridSize 2 → equal top/bottom stack (not side-by-side).
 * Grid size follows active participants so a drop does not leave an empty tile.
 * @see https://docs.videosdk.live/react-native/guide/video-and-audio-calling-api-sdk/recording-and-live-streaming/record-meeting
 */

const BASE_RECORDING_OPTIONS = {
  theme: 'LIGHT',
  mode: 'video-and-audio',
  quality: 'high',
  orientation: 'portrait',
};

export function buildOneToOneRecordingConfig(activeParticipantCount = 2) {
  const count = Math.max(1, Math.min(activeParticipantCount, 4));

  if (count <= 1) {
    return {
      ...BASE_RECORDING_OPTIONS,
      layout: {
        type: 'SPOTLIGHT',
        priority: 'SPEAKER',
      },
    };
  }

  return {
    ...BASE_RECORDING_OPTIONS,
    layout: {
      type: 'GRID',
      priority: 'SPEAKER',
      gridSize: count,
    },
  };
}

/** @deprecated Use buildOneToOneRecordingConfig */
export const ONE_TO_ONE_RECORDING_CONFIG = buildOneToOneRecordingConfig(2);

/** Pass null webhook/aws paths so VideoSDK applies the layout config. */
export function startOneToOneRecording(startRecording, activeParticipantCount = 2) {
  startRecording(null, null, buildOneToOneRecordingConfig(activeParticipantCount));
}
