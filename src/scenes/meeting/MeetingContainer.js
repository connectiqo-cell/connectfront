import { useMeeting } from '@videosdk.live/react-native-sdk';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import React from 'react';
import Toast from 'react-native-simple-toast';
import { ensureIosCallAudioSession } from '../../utils/iosCallAudioSession';
import { MEETING_LEAVE_NAV_FALLBACK_MS } from '../../utils/meetingLeave';
import { getMeetingParticipantSnapshot } from '../../utils/meetingParticipants';
import { useTheme } from '../../hooks/useTheme';
import OneToOneMeetingViewer from './OneToOne';
import ConferenceMeetingViewer from './Conference/ConferenceMeetingViewer';
import WaitingToJoinView from './Components/WaitingToJoinView';

function LeavingCallView() {
  const { theme } = useTheme();
  const bg = theme.colors.meeting[900];
  const ink = theme.colors.meeting[100];
  const accent = theme.colors.accent?.secondary || '#6366f1';

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: bg,
        paddingHorizontal: 24,
      }}
    >
      <ActivityIndicator size="large" color={accent} />
      <Text style={{ color: ink, marginTop: 16, fontSize: 15, fontWeight: '600' }}>
        Leaving session…
      </Text>
    </View>
  );
}

export default function MeetingContainer({
  meetingType,
  onParticipantCountChange,
  isHost,
  booking,
  isMentor,
  otherUser,
  autoStartRecording = false,
  recordingRequested = false,
  onLeaveSession,
  maxDurationMs,
  sessionEndsAtMs,
}) {
  const [isJoined, setJoined] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [joinStalled, setJoinStalled] = useState(false);
  const hasJoinedRef = useRef(false);
  const hasLeftRef = useRef(false);
  const isLeavingRef = useRef(false);
  const joinRef = useRef(null);
  const leavePendingRef = useRef(false);
  const iosWebcamBootstrappedRef = useRef(false);
  const iosWebcamTimerRef = useRef(null);
  const leaveSdkTimerRef = useRef(null);
  const joinTimerRef = useRef(null);
  const toggleWebcamRef = useRef(null);
  const enableWebcamRef = useRef(null);
  const localWebcamOnRef = useRef(false);
  const onLeaveSessionRef = useRef(onLeaveSession);
  onLeaveSessionRef.current = onLeaveSession;
  const leaveFallbackTimerRef = useRef(null);
  const leaveRequestedAtRef = useRef(null);

  const clearLeaveFallback = useCallback(() => {
    if (leaveFallbackTimerRef.current) {
      clearTimeout(leaveFallbackTimerRef.current);
      leaveFallbackTimerRef.current = null;
    }
  }, []);

  const cancelIosWebcamBootstrap = useCallback(() => {
    if (iosWebcamTimerRef.current) {
      clearTimeout(iosWebcamTimerRef.current);
      iosWebcamTimerRef.current = null;
    }
  }, []);

  const finishLeaveSession = useCallback(
    (opts = {}) => {
      clearLeaveFallback();
      leavePendingRef.current = false;
      hasLeftRef.current = true;
      isLeavingRef.current = true;
      setIsLeaving(true);
      onLeaveSessionRef.current?.(opts);
    },
    [clearLeaveFallback],
  );

  const scheduleLeaveFallback = useCallback(() => {
    clearLeaveFallback();
    leaveFallbackTimerRef.current = setTimeout(() => {
      leaveFallbackTimerRef.current = null;
      if (!hasLeftRef.current) {
        finishLeaveSession();
      }
    }, MEETING_LEAVE_NAV_FALLBACK_MS);
  }, [clearLeaveFallback, finishLeaveSession]);

  const requestLeave = useCallback(() => {
    // Parent may still be showing the call screen after a failed navigate — force exit.
    if (hasLeftRef.current) {
      onLeaveSessionRef.current?.({ force: true });
      return;
    }

    const now = Date.now();
    if (leavePendingRef.current) {
      const stalledMs = leaveRequestedAtRef.current
        ? now - leaveRequestedAtRef.current
        : 0;
      // A prior leave() may never fire onMeetingLeft on iOS; allow retry after fallback window.
      if (stalledMs <= MEETING_LEAVE_NAV_FALLBACK_MS + 500) {
        return;
      }
      leavePendingRef.current = false;
    }

    leavePendingRef.current = true;
    leaveRequestedAtRef.current = now;
    isLeavingRef.current = true;
    setIsLeaving(true);
    cancelIosWebcamBootstrap();

    // Unmount RTC views first, then ask VideoSDK to leave — avoids iOS crash
    // from tearing down live RTCView / AVCapture while still on screen.
    if (leaveSdkTimerRef.current) {
      clearTimeout(leaveSdkTimerRef.current);
    }
    leaveSdkTimerRef.current = setTimeout(() => {
      leaveSdkTimerRef.current = null;
      try {
        leaveRef.current?.();
      } catch (_) {}
    }, Platform.OS === 'ios' ? 80 : 0);

    scheduleLeaveFallback();
  }, [cancelIosWebcamBootstrap, scheduleLeaveFallback]);

  const markJoined = useCallback(() => {
    if (hasJoinedRef.current || hasLeftRef.current || isLeavingRef.current) {
      return;
    }
    hasJoinedRef.current = true;
    setJoinStalled(false);
    setJoined(true);

    // iOS: ensure front camera is actually producing after join. Joining with
    // webcamEnabled can still leave the track off until enableWebcam runs.
    // Never use toggleWebcam here — if the camera is already on, toggle would
    // turn it off.
    if (Platform.OS === 'ios' && !iosWebcamBootstrappedRef.current) {
      iosWebcamBootstrappedRef.current = true;
      const tryEnableFrontCamera = (attempt = 0) => {
        iosWebcamTimerRef.current = setTimeout(() => {
          iosWebcamTimerRef.current = null;
          if (hasLeftRef.current || isLeavingRef.current) {
            return;
          }
          if (localWebcamOnRef.current) {
            return;
          }
          try {
            if (typeof enableWebcamRef.current === 'function') {
              enableWebcamRef.current();
            } else {
              toggleWebcamRef.current?.();
            }
          } catch (_) {}
          if (attempt < 2) {
            tryEnableFrontCamera(attempt + 1);
          }
        }, attempt === 0 ? 700 : 1100);
      };
      tryEnableFrontCamera();
    }
  }, []);

  const onMeetingLeft = useCallback(() => {
    finishLeaveSession();
  }, [finishLeaveSession]);

  const onError = useCallback(({ code, message } = {}) => {
    if (isLeavingRef.current || hasLeftRef.current) {
      return;
    }
    setJoinStalled(true);
    Toast.show(message || code || 'Failed to join session');
  }, []);

  const leaveRef = useRef(null);
  const endRef = useRef(null);
  const {
    join,
    participants,
    localParticipant,
    leave,
    end,
    toggleWebcam,
    enableWebcam,
    localWebcamOn,
    isMeetingJoined,
  } = useMeeting({
    onMeetingJoined: markJoined,
    onMeetingLeft,
    onError,
  });

  joinRef.current = join;
  leaveRef.current = leave;
  endRef.current = end;
  toggleWebcamRef.current = toggleWebcam;
  enableWebcamRef.current = enableWebcam;
  localWebcamOnRef.current = !!localWebcamOn;

  const localParticipantId = localParticipant?.id;
  const { remoteParticipantCount, participantCount } = getMeetingParticipantSnapshot(
    participants,
    localParticipantId,
  );

  useEffect(() => {
    onParticipantCountChange?.(participantCount);
  }, [participantCount, onParticipantCountChange]);

  const attemptJoin = useCallback(async () => {
    if (hasLeftRef.current || hasJoinedRef.current || isLeavingRef.current) {
      return;
    }

    setJoinStalled(false);

    try {
      if (Platform.OS === 'ios') {
        const ready = await ensureIosCallAudioSession();
        if (!ready) {
          setJoinStalled(true);
          Toast.show('Camera and microphone permissions are required');
          return;
        }
      }
      if (!hasLeftRef.current && !hasJoinedRef.current && !isLeavingRef.current) {
        joinRef.current?.();
      }
    } catch (err) {
      setJoinStalled(true);
      Toast.show(err?.message || 'Could not join session');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stallTimerId = null;

    joinTimerRef.current = setTimeout(() => {
      joinTimerRef.current = null;
      if (!cancelled) {
        attemptJoin();
      }
    }, Platform.OS === 'ios' ? 800 : 400);

    stallTimerId = setTimeout(() => {
      if (!hasJoinedRef.current && !hasLeftRef.current && !isLeavingRef.current) {
        setJoinStalled(true);
      }
    }, 20000);

    return () => {
      cancelled = true;
      if (joinTimerRef.current) {
        clearTimeout(joinTimerRef.current);
        joinTimerRef.current = null;
      }
      if (stallTimerId) {
        clearTimeout(stallTimerId);
      }
      cancelIosWebcamBootstrap();
      if (leaveSdkTimerRef.current) {
        clearTimeout(leaveSdkTimerRef.current);
        leaveSdkTimerRef.current = null;
      }
      // Do not clearLeaveFallback here — join() identity changes during active
      // calls and would cancel an in-flight leave fallback before onMeetingLeft.
    };
  }, [attemptJoin, cancelIosWebcamBootstrap]);

  // VideoSDK sometimes sets localParticipant / isMeetingJoined before the
  // meeting-joined event reaches this hook (especially on Android release builds).
  useEffect(() => {
    if (isLeavingRef.current || hasLeftRef.current) {
      return;
    }
    if (isMeetingJoined || localParticipant?.id) {
      markJoined();
    }
  }, [isMeetingJoined, localParticipant?.id, markJoined]);

  useEffect(() => {
    return () => {
      clearLeaveFallback();
    };
  }, [clearLeaveFallback]);

  useEffect(() => {
    const endsAt =
      typeof sessionEndsAtMs === 'number' && sessionEndsAtMs > 0
        ? sessionEndsAtMs
        : typeof maxDurationMs === 'number' && maxDurationMs > 0
          ? Date.now() + maxDurationMs
          : null;
    if (!endsAt || remoteParticipantCount < 1) return undefined;

    const delay = Math.max(0, endsAt - Date.now());
    const timer = setTimeout(() => {
      Toast.show('Session time is over');
      // End the room for both participants, then ensure local navigation.
      try {
        endRef.current?.();
      } catch (_) {}
      requestLeave();
    }, delay);
    return () => clearTimeout(timer);
  }, [remoteParticipantCount, maxDurationMs, sessionEndsAtMs, requestLeave]);

  if (isLeaving) {
    return <LeavingCallView />;
  }

  // Show the call UI as soon as VideoSDK join succeeds — waiting for the peer
  // inside OneToOneMeetingViewer. Gating on remoteParticipantCount kept both
  // sides stuck on a dead lobby after join.
  if (isJoined && meetingType === 'GROUP') {
    return <ConferenceMeetingViewer onRequestLeave={requestLeave} />;
  }

  if (isJoined) {
    return (
      <OneToOneMeetingViewer
        isHost={isHost}
        booking={booking}
        recordingRequested={recordingRequested}
        autoStartRecording={autoStartRecording}
        onRequestLeave={requestLeave}
        onSessionEnding={scheduleLeaveFallback}
      />
    );
  }

  // Do not re-mount SessionLobbyView here — its mentor/learner CTAs ignore
  // `connecting` and look like Start/Join failed after the room was created.
  return (
    <WaitingToJoinView
      otherUser={otherUser}
      isMentor={isMentor}
      stalled={joinStalled}
      onRetry={attemptJoin}
      onLeave={requestLeave}
    />
  );
}
