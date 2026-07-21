import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CosmicButton from './CosmicButton';
import { UNIFIED_THEME } from '../unifiedTheme';
import { formatDate, formatTime } from '../utils/dateHelpers';

export const SessionCard = ({ session, onJoinPress, onMorePress }) => {
  const learnerName = session.learner_profile?.name || 'Unknown Learner';
  const date = session.availability_slots?.date;
  const time = session.availability_slots?.start_time;

  const canJoinNow = session.status === 'confirmed' && new Date() >= new Date(date);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.timeSection}>
          <MaterialIcons
            name="access-time"
            size={20}
            color={UNIFIED_THEME.colors.text.secondary}
            style={styles.icon}
          />
          <View style={styles.timeInfo}>
            <Text style={styles.time}>{time || 'TBA'}</Text>
            <Text style={styles.date}>{date ? formatDate(date) : 'Date pending'}</Text>
          </View>
        </View>

        <View style={styles.learnerSection}>
          <MaterialIcons
            name="person"
            size={20}
            color={UNIFIED_THEME.colors.text.secondary}
            style={styles.icon}
          />
          <Text style={styles.learnerName} numberOfLines={1}>{learnerName}</Text>
        </View>

        <View style={styles.statusSection}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  session.status === 'pending'
                    ? UNIFIED_THEME.colors.warning
                    : session.status === 'confirmed'
                    ? UNIFIED_THEME.colors.success
                    : UNIFIED_THEME.colors.text.secondary,
              },
            ]}
          >
            <Text style={styles.statusText}>
              {session.status?.charAt(0).toUpperCase() + session.status?.slice(1) || 'Pending'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {canJoinNow && onJoinPress && (
          <CosmicButton
            label="Start"
            icon="videocam"
            variant="success"
            size="compact"
            onPress={onJoinPress}
            style={styles.joinBtnThemed}
          />
        )}
        {onMorePress && (
          <TouchableOpacity
            onPress={onMorePress}
            style={styles.moreButton}
          >
            <MaterialIcons
              name="more-vert"
              size={20}
              color={UNIFIED_THEME.colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: UNIFIED_THEME.colors.component.input,
    borderRadius: 12,
    padding: UNIFIED_THEME.spacing.md,
    marginHorizontal: UNIFIED_THEME.spacing.md,
    marginVertical: UNIFIED_THEME.spacing.sm,
    borderWidth: 1,
    borderColor: UNIFIED_THEME.colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: UNIFIED_THEME.spacing.sm,
  },
  learnerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: UNIFIED_THEME.spacing.sm,
  },
  icon: {
    marginRight: UNIFIED_THEME.spacing.sm,
  },
  timeInfo: {
    flex: 1,
  },
  time: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
  },
  date: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.secondary,
  },
  learnerName: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: UNIFIED_THEME.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.onAccent,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: UNIFIED_THEME.spacing.md,
  },
  joinBtnThemed: { marginVertical: 0, minWidth: 88 },
  moreButton: {
    padding: UNIFIED_THEME.spacing.sm,
  },
});
