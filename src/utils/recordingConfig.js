/**
 * VideoSDK cloud recording layout for 1-on-1 mentoring calls.
 * Uses a custom template deployed on Vercel — 50/50 split with objectFit:cover
 * so each tile fills edge-to-edge with no black bars.
 * @see https://docs.videosdk.live/react-native/guide/video-and-audio-calling-api-sdk/recording-and-live-streaming/record-meeting
 */

const RECORDING_TEMPLATE_URL = 'https://YOUR_TEMPLATE.vercel.app'; // ← replace after deploy

const BASE_RECORDING_OPTIONS = {
  theme: 'DARK',
  mode: 'video-and-audio',
  quality: 'high',
  orientation: 'portrait',
};

export function buildOneToOneRecordingConfig(activeParticipantCount = 2) {
  const count = Math.max(1, Math.min(activeParticipantCount, 4));

  // CUSTOM template: renders a 50/50 split with objectFit:cover — no black bars.
  // Fallback to GRID if template URL is not set yet.
  if (RECORDING_TEMPLATE_URL && !RECORDING_TEMPLATE_URL.includes('YOUR_TEMPLATE')) {
    return {
      ...BASE_RECORDING_OPTIONS,
      layout: {
        type: 'CUSTOM',
        customTemplate: RECORDING_TEMPLATE_URL,
        gridSize: count,
      },
    };
  }

  // Fallback: GRID until template is deployed
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
