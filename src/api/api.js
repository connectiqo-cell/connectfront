import ApiErrorHandler from "../utils/apiErrorHandler";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@env";

const API_BASE_URL = "https://api.videosdk.live/v2";
const MEETING_RECORDINGS_V1_URL = "https://api.videosdk.live/v1/meeting-recordings";
const VIDEO_SDK_CDN_BASE = "https://cdn.videosdk.live/";

export const isTokenEndpointConfigured = true;

export const getToken = async () => {
  try {
    const token = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/get-videosdk-token`,
          {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.token) throw new Error('No token in response');
        return data.token;
      },
      3,
    );

    return token;
  } catch (error) {
    ApiErrorHandler.logError("getToken", error);
    const userMessage = ApiErrorHandler.formatErrorMessage(error);
    const apiError = new Error(userMessage);
    apiError.originalError = error;
    throw apiError;
  }
};

export const createMeeting = async ({ token }) => {
  try {
    if (!token) {
      throw new Error("Token is required to create a meeting");
    }


    const roomId = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const url = `${API_BASE_URL}/rooms`;
        const options = {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          timeout: 15000, // 15 second timeout
        };

        const response = await fetch(url, options);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        return data.roomId;
      },
      2 // Max retries (fewer for POST)
    );

    return roomId;
  } catch (error) {
    ApiErrorHandler.logError("createMeeting", error);
    const userMessage = ApiErrorHandler.formatErrorMessage(error);
    const apiError = new Error(userMessage);
    apiError.originalError = error;
    throw apiError;
  }
};

export const validateMeeting = async ({ meetingId, token }) => {
  try {
    if (!meetingId || !token) {
      throw new Error("meetingId and token are required");
    }


    const isValid = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const url = `${API_BASE_URL}/rooms/validate/${meetingId}`;
        const options = {
          method: "GET",
          headers: { Authorization: token },
          timeout: 10000, // 10 second timeout
        };

        const response = await fetch(url, options);

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`⚠️ Meeting not found: ${meetingId}`);
            return false;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result && result.roomId === meetingId;
      },
      2 // Max retries
    );

    return isValid;
  } catch (error) {
    ApiErrorHandler.logError("validateMeeting", error);
    console.error("❌ validateMeeting Error:", error.message);
    return false;
  }
};

export const fetchSession = async ({ meetingId, token }) => {
  try {
    if (!meetingId || !token) {
      throw new Error("meetingId and token are required");
    }

    const session = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const url = `${API_BASE_URL}/sessions?roomId=${meetingId}`;
        const options = {
          method: "GET",
          headers: { Authorization: token },
          timeout: 10000,
        };

        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return result?.data?.[0] || null;
      },
      2 // Max retries
    );

    return session;
  } catch (error) {
    ApiErrorHandler.logError("fetchSession", error);
    console.error("❌ fetchSession Error:", error.message);
    return null;
  }
};

const fetchSessionsByRoom = async ({ meetingId, token }) => {
  try {
    if (!meetingId || !token) return [];

    const sessions = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const url = `${API_BASE_URL}/sessions?roomId=${meetingId}`;
        const options = {
          method: "GET",
          headers: { Authorization: token },
          timeout: 10000,
        };

        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return Array.isArray(result?.data) ? result.data : [];
      },
      2
    );

    return sessions;
  } catch (error) {
    ApiErrorHandler.logError("fetchSessionsByRoom", error);
    return [];
  }
};

const fetchRecordingById = async ({ recordingId, token }) => {
  try {
    if (!recordingId || !token) return null;

    const recording = await ApiErrorHandler.retryWithBackoff(
      async () => {
        const response = await fetch(`${API_BASE_URL}/recordings/${recordingId}`, {
          method: "GET",
          headers: { Authorization: token },
          timeout: 10000,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      2
    );

    return recording || null;
  } catch (error) {
    ApiErrorHandler.logError("fetchRecordingById", error);
    return null;
  }
};

const pickRecordingUrlFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  return (
    obj.fileUrl ||
    obj.file_url ||
    obj.playbackUrl ||
    obj.playback_url ||
    obj.downloadUrl ||
    obj.url ||
    obj.hlsUrl ||
    obj.hls_url ||
    obj.filePath ||
    obj.file_path ||
    null
  );
};

/** Cloud composite recordings are often only listed on the v1 meeting-recordings API. */
const fetchMeetingRecordingsV1 = async ({ meetingId, token }) => {
  try {
    if (!meetingId || !token) return [];

    const url = `${MEETING_RECORDINGS_V1_URL}?meetingId=${encodeURIComponent(meetingId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: token },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return Array.isArray(result?.data) ? result.data : [];
  } catch (error) {
    ApiErrorHandler.logError("fetchMeetingRecordingsV1", error);
    return [];
  }
};

const collectUrlsFromV1Recordings = (items, pushUrl) => {
  (items || []).forEach((item) => {
    pushUrl(pickRecordingUrlFromObject(item?.file));
    pushUrl(pickRecordingUrlFromObject(item));
  });
};

const collectUrlsFromSessions = async (sessions, token, pushUrl) => {
  const sortedSessions = [...(sessions || [])].sort((a, b) => {
    const aTime = new Date(a?.end || a?.start || 0).getTime();
    const bTime = new Date(b?.end || b?.start || 0).getTime();
    return bTime - aTime;
  });

  for (const session of sortedSessions) {
    const recordingLog = Array.isArray(session?.recordingLog)
      ? session.recordingLog
      : [];

    pushUrl(pickRecordingUrlFromObject(session.recording));
    pushUrl(pickRecordingUrlFromObject(session.recordings));

    for (let i = recordingLog.length - 1; i >= 0; i -= 1) {
      const recordingId = recordingLog[i]?.recordingId;
      if (!recordingId) continue;

      const recording = await fetchRecordingById({ recordingId, token });
      pushUrl(pickRecordingUrlFromObject(recording?.file));
      pushUrl(pickRecordingUrlFromObject(recording));
    }

    if (Array.isArray(session.recordings)) {
      session.recordings.forEach((item) =>
        pushUrl(pickRecordingUrlFromObject(item))
      );
    }

    if (Array.isArray(session.files)) {
      session.files.forEach((item) =>
        pushUrl(pickRecordingUrlFromObject(item))
      );
    }
  }
};

export const normalizeRecordingUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const relativePath = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return `${VIDEO_SDK_CDN_BASE}${relativePath}`;
};

export const fetchRecordingUrl = async ({ meetingId, token }) => {
  try {
    const urls = await fetchRecordingUrls({ meetingId, token });
    return urls[0] || null;
  } catch (error) {
    ApiErrorHandler.logError("fetchRecordingUrl", error);
    return null;
  }
};

export const fetchRecordingUrls = async ({ meetingId, token }) => {
  try {
    if (!meetingId || !token) return [];

    const urls = [];
    const seen = new Set();
    const pushUrl = (rawUrl) => {
      const normalized = normalizeRecordingUrl(rawUrl);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    };

    const sessions = await fetchSessionsByRoom({ meetingId, token });
    await collectUrlsFromSessions(sessions, token, pushUrl);

    if (!urls.length) {
      const v1Items = await fetchMeetingRecordingsV1({ meetingId, token });
      collectUrlsFromV1Recordings(v1Items, pushUrl);
    }

    return urls;
  } catch (error) {
    ApiErrorHandler.logError("fetchRecordingUrls", error);
    return [];
  }
};
