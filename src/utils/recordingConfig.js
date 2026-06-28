const RECORDING_TEMPLATE_URL = 'https://connectfront-eta.vercel.app';

const RECORDING_API_URL = 'https://api.videosdk.live/v2/recordings/start';

/**
 * Starts recording via VideoSDK REST API with a custom template URL.
 * The SDK's startRecording() cannot load custom templates — only the REST API supports templateUrl.
 */
export async function startOneToOneRecordingViaAPI({ token, meetingId }) {
  const templateUrl =
    `${RECORDING_TEMPLATE_URL}` +
    `?token=${encodeURIComponent(token)}` +
    `&meetingId=${encodeURIComponent(meetingId)}` +
    `&participantId=RECORDER_${meetingId.replace(/-/g, '')}`;

  console.warn('[Recording] REST API start | meetingId:', meetingId);

  const res = await fetch(RECORDING_API_URL, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomId: meetingId,
      templateUrl,
      config: {
        theme: 'DARK',
        mode: 'video-and-audio',
        quality: 'high',
        orientation: 'portrait',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`VideoSDK recording start failed (${res.status}): ${text}`);
  }

  return res.json();
}

/** Fallback: SDK-native GRID layout (no custom template). */
export function startOneToOneRecording(startRecording, activeParticipantCount = 2) {
  const count = Math.max(1, Math.min(activeParticipantCount, 4));
  startRecording(null, null, {
    theme: 'DARK',
    mode: 'video-and-audio',
    quality: 'high',
    orientation: 'portrait',
    layout: { type: 'GRID', priority: 'SPEAKER', gridSize: count },
  });
}
