const RECORDING_TEMPLATE_URL = 'https://connectfront-tau.vercel.app';

const RECORDING_API_URL = 'https://api.videosdk.live/v2/recordings/start';

/**
 * Starts recording via VideoSDK REST API with a custom template URL.
 * The SDK's startRecording() cannot load custom templates — only the REST API supports templateUrl.
 */
export async function startOneToOneRecordingViaAPI({ token, meetingId }) {
  console.warn('[Recording] startViaAPI | meetingId:', meetingId, '| hasToken:', !!token);

  if (!meetingId) throw new Error('meetingId is missing');
  if (!token) throw new Error('token is missing');

  // Provide meetingId + token in URL. VideoSDK auto-appends &participantId= itself.
  const templateUrl = `${RECORDING_TEMPLATE_URL}?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`;

  console.warn('[Recording] templateUrl:', templateUrl);

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
        layout: {
          type: 'GRID',
          priority: 'SPEAKER',
          gridSize: 2,
        },
        theme: 'DARK',
        mode: 'video-and-audio',
        quality: 'high',
        orientation: 'portrait',
      },
    }),
  });

  const responseText = await res.text().catch(() => '');
  console.warn('[Recording] API response | status:', res.status, '| body:', responseText);

  if (!res.ok) {
    throw new Error(`VideoSDK ${res.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
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
