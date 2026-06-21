import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import { formatDate, formatTime, formatDateForDisplay } from '../utils/dateHelpers';
import CosmicButton from './CosmicButton';

const T = UNIFIED_THEME.colors;
const S = UNIFIED_THEME.colors.surface;
const B = UNIFIED_THEME.colors.buttons;
const PURPLE_LINK = B.nebulaGradient[0];

const STATUS_COLORS = {
  pending: T.accent.warning,
  confirmed: T.accent.secondary,
  completed: T.accent.success,
  cancelled: T.text.muted,
  booked: T.accent.success,
  failed: T.text.muted,
  expired: T.text.muted,
  live: T.accent.secondary,
  done: T.accent.success,
};

const STATUS_ICONS = {
  pending: 'schedule',
  confirmed: 'check-circle',
  completed: 'done-all',
  cancelled: 'cancel',
  booked: 'event-available',
  failed: 'error',
  expired: 'history-toggle-off',
  live: 'fiber-manual-record',
  done: 'done-all',
};

/**
 * Session / booking row — flat cosmic panel (left status beam, square avatar, full-width CTA).
 */
export const BookingCard = ({
  booking,
  isMentor = false,
  showLearnerInfo = false,
  compact = false,
  onPressJoin,
  onPressCancel,
  onPressRecording = null,
  onPressDownload = null,
  onPressRate = null,
  statusLabel = null,
  entranceDelay = null,
  pressScale = false,
}) => {
  const showLearnerDetails = isMentor || showLearnerInfo;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(entranceDelay != null ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(entranceDelay != null ? 12 : 0)).current;

  useEffect(() => {
    if (entranceDelay == null) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay: entranceDelay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        delay: entranceDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceDelay, opacity, translateY]);

  const onPressIn = () => {
    if (!pressScale) return;
    Animated.spring(scale, {
      toValue: 0.98,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    if (!pressScale) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const getOtherUserInfo = () => {
    if (showLearnerDetails) {
      return {
        name: booking.profiles?.name || 'Unknown Learner',
        avatar: booking.profiles?.avatar_url,
      };
    }
    return {
      name: booking.profiles?.name || 'Unknown Mentor',
      avatar: booking.profiles?.avatar_url,
    };
  };

  const otherUser = getOtherUserInfo();
  const avatarUrl = otherUser.avatar;
  const name = otherUser.name;

  const rawStatus = (statusLabel || booking.status || 'pending')
    .toLowerCase()
    .replace(/\s+/g, '');
  const displayStatus = statusLabel || booking.status || 'pending';
  const statusColor = STATUS_COLORS[rawStatus] || T.text.secondary;
  const statusIcon = STATUS_ICONS[rawStatus] || 'help';

  const date = booking.availability_slots?.date;
  const time = booking.availability_slots?.start_time;
  const dateLabel =
    date && time
      ? compact
        ? `${formatDateForDisplay(date)} · ${formatTime(time)}`
        : `${formatDate(date)} · ${formatTime(time)}`
      : null;

  const canJoin =
    onPressJoin && (booking.status === 'pending' || booking.status === 'confirmed');
  const canCancel =
    onPressCancel && (booking.status === 'pending' || booking.status === 'confirmed');
  const canViewRecording = !!onPressRecording;
  const canDownloadRecording = !!onPressDownload;

  const statusTitle =
    typeof displayStatus === 'string'
      ? displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)
      : displayStatus;

  const hasActions =
    canJoin || canCancel || canViewRecording || canDownloadRecording || onPressRate;

  const card = (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { borderLeftColor: statusColor },
      ]}
    >
      <View style={styles.topRow}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatar, compact && styles.avatarCompact]}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              compact && styles.avatarCompact,
            ]}
          >
            <MaterialIcons
              name="person"
              size={compact ? 20 : 22}
              color={PURPLE_LINK}
            />
          </View>
        )}

        <View style={styles.main}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {name}
          </Text>
          {dateLabel ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="schedule" size={13} color={T.text.muted} />
              <Text style={styles.dateTime} numberOfLines={1}>
                {dateLabel}
              </Text>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <MaterialIcons name="event-busy" size={13} color={T.text.muted} />
              <Text style={styles.dateTime}>—</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusPill, { borderColor: `${statusColor}44` }]}>
          <MaterialIcons name={statusIcon} size={14} color={statusColor} />
          <Text
            style={[styles.statusText, compact && styles.statusTextCompact, { color: statusColor }]}
            numberOfLines={1}
          >
            {statusTitle}
          </Text>
        </View>
      </View>

      {booking.message && isMentor ? (
        <View style={[styles.goalStrip, compact && styles.goalStripCompact]}>
          <MaterialIcons name="chat-bubble-outline" size={14} color={T.accent.secondary} />
          <Text style={styles.goalText} numberOfLines={2}>
            {booking.message}
          </Text>
        </View>
      ) : null}

      {hasActions ? (
        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {canJoin && onPressJoin ? (
            <CosmicButton
              label={compact ? 'Start' : isMentor ? 'Start' : 'Join'}
              variant="success"
              size="compact"
              icon="videocam"
              onPress={onPressJoin}
              pressScale
              pill
              style={[styles.joinBtn, compact && styles.actionBtnCompact]}
            />
          ) : null}
          {canCancel && onPressCancel ? (
            <CosmicButton
              label={compact ? 'Cancel' : 'Cancel'}
              variant="outline"
              size="compact"
              onPress={onPressCancel}
              pressScale
              style={[styles.cancelBtnOuter, compact && styles.actionBtnCompact]}
            />
          ) : null}
          {canViewRecording ? (
            <CosmicButton
              label={compact ? 'Replay' : 'Replay'}
              variant="info"
              size="compact"
              icon="play-circle-filled"
              onPress={onPressRecording}
              pressScale
              style={[styles.recordingBtnOuter, compact && styles.actionBtnCompact]}
            />
          ) : null}
          {canDownloadRecording ? (
            <CosmicButton
              label={compact ? 'Save' : 'Download'}
              variant="outline"
              size="compact"
              icon="file-download"
              onPress={onPressDownload}
              pressScale
              style={[styles.downloadBtnOuter, compact && styles.actionBtnCompact]}
            />
          ) : null}
          {onPressRate ? (
            <CosmicButton
              label={compact ? 'Rate' : 'Rate'}
              variant="warning"
              size="compact"
              icon="star-outline"
              onPress={onPressRate}
              pressScale
              style={[styles.rateBtnOuter, compact && styles.actionBtnCompact]}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, ...(pressScale ? [{ scale }] : [])],
      }}
    >
      {pressScale ? (
        <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
          {card}
        </Pressable>
      ) : (
        card
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: UNIFIED_THEME.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderLeftWidth: 3,
    ...Platform.select({
      ios: UNIFIED_THEME.shadows.small,
      android: { elevation: 4 },
    }),
  },
  cardCompact: {
    padding: UNIFIED_THEME.spacing.sm + 2,
    borderRadius: UNIFIED_THEME.borderRadius.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UNIFIED_THEME.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarCompact: {
    width: 44,
    height: 44,
  },
  avatarPlaceholder: {
    backgroundColor: S.accentViolet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...UNIFIED_THEME.typography.labelMd,
    color: T.text.primary,
    fontWeight: '800',
    marginBottom: 4,
  },
  nameCompact: {
    fontSize: 14,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateTime: {
    ...UNIFIED_THEME.typography.bodySm,
    color: T.text.muted,
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: UNIFIED_THEME.borderRadius.chip,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: '36%',
  },
  statusText: {
    ...UNIFIED_THEME.typography.labelSm,
    fontWeight: '700',
  },
  statusTextCompact: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  goalStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: UNIFIED_THEME.spacing.sm,
    marginTop: UNIFIED_THEME.spacing.sm,
    paddingTop: UNIFIED_THEME.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  goalStripCompact: {
    marginTop: UNIFIED_THEME.spacing.xs,
    paddingTop: UNIFIED_THEME.spacing.xs,
  },
  goalText: {
    ...UNIFIED_THEME.typography.bodySm,
    color: T.text.secondary,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    marginTop: UNIFIED_THEME.spacing.md,
    gap: UNIFIED_THEME.spacing.sm,
  },
  actionsCompact: {
    marginTop: UNIFIED_THEME.spacing.sm,
  },
  actionBtnCompact: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  joinBtn: {
    flex: 1,
    borderRadius: UNIFIED_THEME.borderRadius.round,
  },
  cancelBtnOuter: {
    flex: 1,
  },
  recordingBtnOuter: {
    flex: 1,
  },
  downloadBtnOuter: {
    flex: 1,
  },
  rateBtnOuter: {
    flex: 1,
  },
});
