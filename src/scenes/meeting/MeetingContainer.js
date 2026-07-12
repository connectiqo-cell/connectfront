import { useMeeting } from '@videosdk.live/react-native-sdk';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import React from 'react';
import Toast from 'react-native-simple-toast';
import { ensureIosCallAudioSession } from '../../utils/iosCallAudioSession';
import OneToOneMeetingViewer from './OneToOne';
import ConferenceMeetingViewer from './Conference/ConferenceMeetingViewer';
import SessionLobbyView from './Components/SessionLobbyView';

export default function MeetingContainer({
  meetingType,
  onParticipantCountChange,
  isHost,
  booking,
  isMentor,
  otherUser,
  onLeaveSession,
  maxDurationMs,
}) {
  const [isJoined, setJoined] = useState(false);
  const hasJoinedRef = useRef(false);
  const joinRequestedRef = useRef(false);
  const hasLeftRef = useRef(false);
  const iosWebcamBootstrappedRef = useRef(false);
  const iosWebcamTimerRef = useRef(null);
  const joinTimerRef = useRef(null);
  const toggleWebcamRef = useRef(null);

  const requestLeave = useCallback(() => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    try {
      leaveRef.current?.();
    } catch (_) {}
  }, []);

  const markSessionEnding = useCallback(() => {
    hasLeftRef.current = true;
  }, []);

  const onMeetingJoined = useCallback(() => {
    hasJoinedRef.current = true;
    setJoined(true);

    // Join without camera on iOS, then enable after signaling — less lag on iPhone 11-class devices.
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

  const onError = useCallback(({ message }) => {
    Toast.show(message || 'Failed to join session');
  }, []);

  const leaveRef = useRef(null);
  const { join, participants, leave, localMicOn, localWebcamOn, toggleMic, toggleWebcam } = useMeeting({
    onMeetingJoined,
    onError,
  });

  leaveRef.current = leave;
  toggleWebcamRef.current = toggleWebcam;

  const remoteParticipantCount = participants.size;

  useEffect(() => {
    onParticipantCountChange?.(participants.size + 1);
  }, [participants.size, onParticipantCountChange]);

  useEffect(() => {
    if (joinRequestedRef.current) return undefined;
    joinRequestedRef.current = true;

    joinTimerRef.current = setTimeout(async () => {
      joinTimerRef.current = null;
      if (hasLeftRef.current) return;

      try {
        if (Platform.OS === 'ios') {
          const ready = await ensureIosCallAudioSession();
          if (!ready) {
            Toast.show('Camera and microphone permissions are required');
            return;
          }
        }
        if (!hasLeftRef.current) {
          join();
        }
      } catch (err) {
        Toast.show(err?.message || 'Could not join session');
      }
    }, Platform.OS === 'ios' ? 600 : 400);

    return () => {
      if (joinTimerRef.current) {
        clearTimeout(joinTimerRef.current);
        joinTimerRef.current = null;
      }
      if (iosWebcamTimerRef.current) {
        clearTimeout(iosWebcamTimerRef.current);
        iosWebcamTimerRef.current = null;
      }
      if (hasJoinedRef.current && !hasLeftRef.current) {
        requestLeave();
      }
    };
  }, [join, requestLeave]);

  // Auto-end session after maxDurationMs once both participants are in the call
  useEffect(() => {
    if (!maxDurationMs || remoteParticipantCount < 1) return undefined;
    const timer = setTimeout(() => {
      Toast.show('Session time limit reached (20 min)');
      requestLeave();
    }, maxDurationMs);
    return () => clearTimeout(timer);
  }, [remoteParticipantCount, maxDurationMs, requestLeave]);

  const handleLeave = () => {
    if (hasJoinedRef.current) {
      // SDK onMeetingLeft will run session cleanup — do not call onLeaveSession here.
      requestLeave();
      return;
    }
    onLeaveSession?.();
  };

  const showActiveCall =
    isJoined && remoteParticipantCount >= 1 && meetingType !== 'GROUP';

  if (showActiveCall) {
    return <OneToOneMeetingViewer isHost={isHost} booking={booking} onRequestLeave={requestLeave} onSessionEnding={markSessionEnding} />;
  }

  if (isJoined && meetingType === 'GROUP') {
    return <ConferenceMeetingViewer onRequestLeave={requestLeave} />;
  }

  return (
    <SessionLobbyView
      booking={booking}
      isMentor={isMentor}
      otherUser={otherUser}
      connecting={!isJoined}
      micOn={localMicOn}
      camOn={localWebcamOn}
      onToggleMic={isJoined ? () => toggleMic() : undefined}
      onToggleCam={isJoined ? () => toggleWebcam() : undefined}
      onLeave={handleLeave}
      onReschedule={handleLeave}
      onCancelRefund={() => {}}
    />
  );
}
