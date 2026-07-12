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

  const onMeetingJoined = useCallback(() => {
    hasJoinedRef.current = true;
    setJoined(true);
  }, []);

  const onError = useCallback(({ message }) => {
    Toast.show(message || 'Failed to join session');
  }, []);

  const { join, participants, leave, localMicOn, localWebcamOn, toggleMic, toggleWebcam } = useMeeting({
    onMeetingJoined,
    onError,
  });

  const remoteParticipantCount = participants.size;

  useEffect(() => {
    onParticipantCountChange?.(participants.size + 1);
  }, [participants.size, onParticipantCountChange]);

  useEffect(() => {
    if (joinRequestedRef.current) return undefined;
    joinRequestedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        if (Platform.OS === 'ios') {
          const ready = await ensureIosCallAudioSession();
          if (!ready) {
            Toast.show('Camera and microphone permissions are required');
            return;
          }
        }
        join();
      } catch (err) {
        Toast.show(err?.message || 'Could not join session');
      }
    }, Platform.OS === 'ios' ? 600 : 400);

    return () => {
      clearTimeout(timer);
      if (hasJoinedRef.current) {
        leave();
      }
    };
  }, [join, leave]);

  // Auto-end session after maxDurationMs once both participants are in the call
  useEffect(() => {
    if (!maxDurationMs || remoteParticipantCount < 1) return undefined;
    const timer = setTimeout(() => {
      Toast.show('Session time limit reached (20 min)');
      leave();
    }, maxDurationMs);
    return () => clearTimeout(timer);
  }, [remoteParticipantCount, maxDurationMs, leave]);

  const handleLeave = () => {
    if (hasJoinedRef.current) {
      leave();
    }
    onLeaveSession?.();
  };

  const showActiveCall =
    isJoined && remoteParticipantCount >= 1 && meetingType !== 'GROUP';

  if (showActiveCall) {
    return <OneToOneMeetingViewer isHost={isHost} booking={booking} />;
  }

  if (isJoined && meetingType === 'GROUP') {
    return <ConferenceMeetingViewer />;
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
