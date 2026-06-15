import { useMeeting } from '@videosdk.live/react-native-sdk';
import { useEffect, useState, useRef } from 'react';
import React from 'react';
import Toast from 'react-native-simple-toast';
import OneToOneMeetingViewer from './OneToOne';
import ConferenceMeetingViewer from './Conference/ConferenceMeetingViewer';
import ParticipantLimitViewer from './OneToOne/ParticipantLimitViewer';
import SessionLobbyView from './Components/SessionLobbyView';

export default function MeetingContainer({
  meetingType,
  onParticipantCountChange,
  isHost,
  booking,
  isMentor,
  otherUser,
  onLeaveSession,
}) {
  const [isJoined, setJoined] = useState(false);
  const [participantLimit, setParticipantLimit] = useState(false);
  const hasJoinedRef = useRef(false);
  const joinRequestedRef = useRef(false);

  const { join, participants, leave, localMicOn, localWebcamOn, toggleMic, toggleWebcam } = useMeeting({
    onMeetingJoined: () => {
      hasJoinedRef.current = true;
      setJoined(true);
    },
    onError: ({ message }) => {
      Toast.show(message || 'Failed to join session');
    },
    onParticipantLeft: () => {
      if (participants.size < 2) {
        setParticipantLimit(false);
      }
    },
  });

  const remoteParticipantCount = participants.size;

  useEffect(() => {
    onParticipantCountChange?.(participants.size + 1);
  }, [participants.size, onParticipantCountChange]);

  useEffect(() => {
    if (isJoined && participants.size > 2) {
      setParticipantLimit(true);
    }
  }, [isJoined, participants.size]);

  useEffect(() => {
    if (joinRequestedRef.current) return undefined;
    joinRequestedRef.current = true;

    const timer = setTimeout(() => {
      try {
        join();
      } catch (err) {
        Toast.show(err?.message || 'Could not join session');
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (hasJoinedRef.current) {
        leave();
      }
    };
  }, [join, leave]);

  const handleLeave = () => {
    if (hasJoinedRef.current) {
      leave();
    }
    onLeaveSession?.();
  };

  const showActiveCall =
    isJoined && remoteParticipantCount >= 1 && meetingType !== 'GROUP' && !participantLimit;

  if (showActiveCall) {
    return <OneToOneMeetingViewer isHost={isHost} booking={booking} />;
  }

  if (isJoined && meetingType === 'GROUP') {
    return <ConferenceMeetingViewer />;
  }

  if (isJoined && participantLimit) {
    return <ParticipantLimitViewer />;
  }

  return (
    <SessionLobbyView
      booking={booking}
      isMentor={isMentor}
      otherUser={otherUser}
      connecting={!isJoined}
      micOn={localMicOn}
      camOn={localWebcamOn}
      onToggleMic={isJoined ? toggleMic : undefined}
      onToggleCam={isJoined ? toggleWebcam : undefined}
      onLeave={handleLeave}
      onReschedule={handleLeave}
      onCancelRefund={() => {}}
    />
  );
}
