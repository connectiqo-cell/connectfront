import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ROBOTO_FONTS } from '../../../styles/fonts';
import { useThemedStyles } from '../../../hooks/useTheme';
import LargeView from './LargeView';
import MiniView from './MiniView';
import LocalViewContainer from './LocalViewContainer';
import LocalParticipantPresenter from '../Components/LocalParticipantPresenter';
import RemoteParticipantPresenter from '../Conference/RemoteParticipantPresenter';
import { CosmicLoader } from '../../../components/LoadingSpinner';

/** Labels sit on dark video tiles in both themes. */
const ON_VIDEO = '#ffffff';
const ON_VIDEO_BADGE_BG = 'rgba(0, 0, 0, 0.55)';
const ON_VIDEO_BANNER_BG = 'rgba(0, 0, 0, 0.58)';

function NameBadge({ name, styles }) {
  if (!name) return null;
  return (
    <View style={styles.nameBadge} pointerEvents="none">
      <Text style={styles.nameBadgeText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function WaitingBanner({ peerLabel, styles }) {
  const label = peerLabel || 'participant';
  return (
    <View style={styles.waitingBanner} pointerEvents="none">
      <View style={styles.waitingDot} />
      <Text style={styles.waitingText}>Waiting for {label} to join…</Text>
    </View>
  );
}

function ConnectiqoDivider({ vertical = false, styles }) {
  if (vertical) {
    return (
      <View style={styles.dividerVertical}>
        <View style={styles.dividerLineV} />
        <View style={styles.dividerDot} />
        <Text style={styles.dividerBrandV}>Connectiqo</Text>
        <View style={styles.dividerDot} />
        <View style={styles.dividerLineV} />
      </View>
    );
  }

  return (
    <View style={styles.dividerHorizontal}>
      <View style={styles.dividerLineH} />
      <View style={styles.dividerDot} />
      <Text style={styles.dividerBrandH}>Connectiqo</Text>
      <View style={styles.dividerDot} />
      <View style={styles.dividerLineH} />
    </View>
  );
}

function SplitParticipantPane({ participantId, displayName, openStatsBottomSheet, styles }) {
  if (!participantId) return <View style={styles.flex} />;
  return (
    <View style={styles.flex}>
      <LargeView participantId={participantId} openStatsBottomSheet={openStatsBottomSheet} />
      <NameBadge name={displayName} styles={styles} />
    </View>
  );
}

function OneToOneCallLayout({
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
  miniViewBottomInset = 0,
  waitingForPeer = false,
  waitingPeerLabel,
}) {
  const styles = useThemedStyles(createCallLayoutStyles);

  if (participantCount > 1) {
    if (presenterId && !localScreenShareOn) {
      return (
        <View style={styles.flex}>
          <RemoteParticipantPresenter presenterId={presenterId} />
        </View>
      );
    }

    if (localScreenShareOn) {
      return <LocalParticipantPresenter />;
    }

    if (viewLayout === 'split') {
      return (
        <View style={[styles.flex, { flexDirection: isLandscape ? 'row' : 'column' }]}>
          <SplitParticipantPane
            participantId={remoteParticipantId}
            displayName={remoteDisplayName}
            openStatsBottomSheet={openStatsBottomSheet}
            styles={styles}
          />
          <ConnectiqoDivider vertical={isLandscape} styles={styles} />
          <SplitParticipantPane
            participantId={localParticipantId}
            displayName={localDisplayName}
            openStatsBottomSheet={openStatsBottomSheet}
            styles={styles}
          />
        </View>
      );
    }

    const mainId =
      primaryParticipantId ||
      remoteParticipantId ||
      participantIds[0] ||
      localParticipantId;
    const pipId =
      secondaryParticipantId ||
      (mainId === localParticipantId ? remoteParticipantId : localParticipantId) ||
      participantIds[0];

    if (!mainId && !pipId) {
      return (
        <View style={styles.centered}>
          <CosmicLoader size={56} />
        </View>
      );
    }

    const mainName =
      mainId === localParticipantId ? localDisplayName : remoteDisplayName;

    return (
      <View style={styles.flex}>
        <LargeView participantId={mainId} openStatsBottomSheet={openStatsBottomSheet} />
        <NameBadge name={mainName} styles={styles} />
        <MiniView
          participantId={pipId}
          openStatsBottomSheet={openStatsBottomSheet}
          onSwapPress={onSwapPrimary}
          height={miniViewHeight}
          bottomInset={miniViewBottomInset}
        />
      </View>
    );
  }

  if (participantCount === 1) {
    if (!localParticipantId) {
      return (
        <View style={styles.centered}>
          <CosmicLoader size={56} />
        </View>
      );
    }
    return (
      <View style={styles.flex}>
        <LocalViewContainer participantId={localParticipantId} />
        {waitingForPeer ? (
          <WaitingBanner peerLabel={waitingPeerLabel} styles={styles} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <CosmicLoader size={56} />
    </View>
  );
}

function createCallLayoutStyles(theme) {
  const brand = theme.colors.component.button;
  const active = theme.colors.status.active;

  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nameBadge: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      maxWidth: '70%',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: ON_VIDEO_BADGE_BG,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    nameBadgeText: {
      color: ON_VIDEO,
      fontWeight: '600',
      fontSize: 13,
      fontFamily: ROBOTO_FONTS.RobotoMedium,
      letterSpacing: 0.2,
    },
    waitingBanner: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 16 : 14,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: ON_VIDEO_BANNER_BG,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    waitingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: active,
    },
    waitingText: {
      color: ON_VIDEO,
      fontSize: 13,
      fontFamily: ROBOTO_FONTS.RobotoMedium,
    },
    dividerVertical: {
      width: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 10,
    },
    dividerHorizontal: {
      height: 18,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 10,
      alignSelf: 'stretch',
    },
    dividerLineV: {
      flex: 1,
      width: 1,
      backgroundColor: brand,
      opacity: 0.55,
    },
    dividerLineH: {
      flex: 1,
      height: 1,
      backgroundColor: brand,
      opacity: 0.55,
    },
    dividerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: brand,
    },
    dividerBrandV: {
      color: ON_VIDEO,
      fontSize: 10,
      fontFamily: ROBOTO_FONTS.RobotoMedium,
      letterSpacing: 1,
      transform: [{ rotate: '90deg' }],
    },
    dividerBrandH: {
      color: ON_VIDEO,
      fontSize: 11,
      fontFamily: ROBOTO_FONTS.RobotoMedium,
      letterSpacing: 1,
    },
  });
}

export default React.memo(OneToOneCallLayout);
