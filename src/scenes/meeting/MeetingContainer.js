import { useMeeting } from '@videosdk.live/react-native-sdk';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import React from 'react';
import Toast from 'react-native-simple-toast';
import { ensureIosCallAudioSession } from '../../utils/iosCallAudioSession';
import { MEETING_LEAVE_NAV_FALLBACK_MS } from '../../utils/meetingLeave';
import { getMeetingParticipantSnapshot } from '../../utils/meetingParticipants';
import OneToOneMeetingViewer from './OneToOne';
import ConferenceMeetingViewer from './Conference/ConferenceMeetingViewer';
import WaitingToJoinView from './Components/WaitingToJoinView';

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
}) {
  const [isJoined, setJoined] = useState(false);
  const [joinStalled, setJoinStalled] = useState(false);
  const hasJoinedRef = useRef(false);
  const hasLeftRef = useRef(false);
  const joinRef = useRef(null);
  const leavePendingRef = useRef(false);
  const iosWebcamBootstrappedRef = useRef(false);
  const iosWebcamTimerRef = useRef(null);
  const joinTimerRef = useRef(null);
  const toggleWebcamRef = useRef(null);
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

  const finishLeaveSession = useCallback(() => {
    clearLeaveFallback();
    leavePendingRef.current = false;
    hasLeftRef.current = true;
    onLeaveSessionRef.current?.();
  }, [clearLeaveFallback]);

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
    if (hasLeftRef.current) {
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

    try {
      leaveRef.current?.();
    } catch (_) {}

    scheduleLeaveFallback();
  }, [scheduleLeaveFallback]);

  const markJoined = useCallback(() => {
    if (hasJoinedRef.current || hasLeftRef.current) {
      return;
    }
    hasJoinedRef.current = true;
    setJoinStalled(false);
    setJoined(true);

    if (Platform.OS === 'ios' && !iosWebcamBootstrappedRef.current) {
      iosWebcamBootstrappedRef.current = true;
      iosWebcamTimerRef.current = setTimeout(() => {
        iosWebcamTimerRef.current = null;
        if (!hasLeftRef.current) {
          toggleWebcamRef.current?.();
        }
      }, 500);
    }
  }, []);

  const onMeetingLeft = useCallback(() => {
    finishLeaveSession();
  }, [finishLeaveSession]);

  const onError = useCallback(({ code, message } = {}) => {
    setJoinStalled(true);
    Toast.show(message || code || 'Failed to join session');
  }, []);

  const leaveRef = useRef(null);
  const {
    join,
    participants,
    localParticipant,
    leave,
    toggleWebcam,
    isMeetingJoined,
  } = useMeeting({
    onMeetingJoined: markJoined,
    onMeetingLeft,
    onError,
  });

  joinRef.current = join;
  leaveRef.current = leave;
  toggleWebcamRef.current = toggleWebcam;

  const localParticipantId = localParticipant?.id;
  const { remoteParticipantCount, participantCount } = getMeetingParticipantSnapshot(
    participants,
    localParticipantId,
  );

  useEffect(() => {
    onParticipantCountChange?.(participantCount);
  }, [participantCount, onParticipantCountChange]);

  const attemptJoin = useCallback(async () => {
    if (hasLeftRef.current || hasJoinedRef.current) {
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
      if (!hasLeftRef.current && !hasJoinedRef.current) {
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
    }, Platform.OS === 'ios' ? 600 : 400);

    stallTimerId = setTimeout(() => {
      if (!hasJoinedRef.current && !hasLeftRef.current) {
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
      if (iosWebcamTimerRef.current) {
        clearTimeout(iosWebcamTimerRef.current);
        iosWebcamTimerRef.current = null;
      }
      // Do not clearLeaveFallback here — join() identity changes during active
      // calls and would cancel an in-flight leave fallback before onMeetingLeft.
    };
  }, [attemptJoin]);

  // VideoSDK sometimes sets localParticipant / isMeetingJoined before the
  // meeting-joined event reaches this hook (especially on Android release builds).
  useEffect(() => {
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
    if (!maxDurationMs || remoteParticipantCount < 1) return undefined;
    const timer = setTimeout(() => {
      Toast.show('Session time limit reached (20 min)');
      requestLeave();
    }, maxDurationMs);
    return () => clearTimeout(timer);
  }, [remoteParticipantCount, maxDurationMs, requestLeave]);

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
