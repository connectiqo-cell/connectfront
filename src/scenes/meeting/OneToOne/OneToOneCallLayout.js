import React from 'react';
import { View, Text } from 'react-native';
import { ROBOTO_FONTS } from '../../../styles/fonts';
import LargeView from './LargeView';
import MiniView from './MiniView';
import LocalViewContainer from './LocalViewContainer';
import LocalParticipantPresenter from '../Components/LocalParticipantPresenter';
import RemoteParticipantPresenter from '../Conference/RemoteParticipantPresenter';
import { CosmicLoader } from '../../../components/LoadingSpinner';

function NameBadge({ name }) {
  if (!name) return null;
  return (
    <View
      style={{ position: 'absolute', bottom: 12, right: 12, alignItems: 'flex-end' }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 'bold',
          fontSize: 15,
          fontFamily: ROBOTO_FONTS.RobotoBold,
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {name}
      </Text>
    </View>
  );
}

function ConnectiqoDivider({ vertical = false }) {
  if (vertical) {
    return (
      <View
        style={{
          width: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, width: 1, backgroundColor: '#7c3aed', opacity: 0.7 }} />
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#7c3aed' }} />
        <Text
          style={{
            color: '#fff',
            fontSize: 10,
            fontFamily: ROBOTO_FONTS.RobotoMedium,
            letterSpacing: 1,
            transform: [{ rotate: '90deg' }],
          }}
        >
          Connectiqo
        </Text>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#7c3aed' }} />
        <View style={{ flex: 1, width: 1, backgroundColor: '#7c3aed', opacity: 0.7 }} />
      </View>
    );
  }

  return (
    <View
      style={{
        height: 18,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 10,
        alignSelf: 'stretch',
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: '#7c3aed', opacity: 0.7 }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#7c3aed' }} />
      <Text
        style={{
          color: '#fff',
          fontSize: 12,
          fontFamily: ROBOTO_FONTS.RobotoMedium,
          letterSpacing: 1,
        }}
      >
        Connectiqo
      </Text>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#7c3aed' }} />
      <View style={{ flex: 1, height: 1, backgroundColor: '#7c3aed', opacity: 0.7 }} />
    </View>
  );
}

function SplitParticipantPane({ participantId, displayName, openStatsBottomSheet }) {
  if (!participantId) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1 }}>
      <LargeView participantId={participantId} openStatsBottomSheet={openStatsBottomSheet} />
      <NameBadge name={displayName} />
    </View>
  );
}

export default function OneToOneCallLayout({
  participantCount,
  viewLayout,
  isLandscape,
  localParticipantId,
  remoteParticipantId,
  primaryParticipantId,
  secondaryParticipantId,
  participantIds,
  localDisplayName,
  remoteDisplayName,
  localScreenShareOn,
  presenterId,
  onSwapPrimary,
  openStatsBottomSheet,
  miniViewHeight,
}) {
  if (participantCount > 1) {
    if (presenterId && !localScreenShareOn) {
      return (
        <View style={{ flex: 1 }}>
          <RemoteParticipantPresenter presenterId={presenterId} />
        </View>
      );
    }

    if (localScreenShareOn) {
      return <LocalParticipantPresenter />;
    }

    if (viewLayout === 'split') {
      const splitStyle = {
        flex: 1,
        flexDirection: isLandscape ? 'row' : 'column',
      };

      return (
        <View style={splitStyle}>
          <SplitParticipantPane
            participantId={remoteParticipantId}
            displayName={remoteDisplayName}
            openStatsBottomSheet={openStatsBottomSheet}
          />
          <ConnectiqoDivider vertical={isLandscape} />
          <SplitParticipantPane
            participantId={localParticipantId}
            displayName={localDisplayName}
            openStatsBottomSheet={openStatsBottomSheet}
          />
        </View>
      );
    }

    const mainId = primaryParticipantId || remoteParticipantId || participantIds[1];
    const pipId =
      secondaryParticipantId ||
      (mainId === localParticipantId ? remoteParticipantId : localParticipantId) ||
      participantIds[localScreenShareOn || presenterId ? 1 : 0];

    return (
      <>
        <LargeView participantId={mainId} openStatsBottomSheet={openStatsBottomSheet} />
        <MiniView
          participantId={pipId}
          openStatsBottomSheet={openStatsBottomSheet}
          onSwapPress={onSwapPrimary}
          height={miniViewHeight}
        />
      </>
    );
  }

  if (participantCount === 1) {
    return <LocalViewContainer participantId={participantIds[0]} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <CosmicLoader size={56} />
    </View>
  );
}
