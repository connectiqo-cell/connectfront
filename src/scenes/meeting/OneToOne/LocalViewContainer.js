import { useParticipant } from '@videosdk.live/react-native-sdk';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import colors from '../../../styles/colors';
import LargeVideoRTCView from './LargeView/LargeVideoRTCView';
import ParticipantVideoPlaceholder from './ParticipantVideoPlaceholder';

export default function LocalViewContainer({ participantId }) {
  if (!participantId) {
    return <ParticipantVideoPlaceholder />;
  }

  return <LocalViewContainerInner participantId={participantId} />;
}

function LocalViewContainerInner({ participantId }) {
  const { webcamOn, webcamStream, displayName, setQuality, isLocal } =
    useParticipant(participantId, {});

  useEffect(() => {
    setQuality?.(Platform.OS === 'ios' ? 'medium' : 'high');
  }, [setQuality]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary[800],
        overflow: 'hidden',
      }}
    >
      <LargeVideoRTCView
        isOn={webcamOn}
        stream={webcamStream}
        displayName={displayName}
        objectFit="cover"
        isLocal={isLocal}
      />
    </View>
  );
}
