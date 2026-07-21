import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import StackScreenHeader from '../../components/StackScreenHeader';
import CosmicButton from '../../components/CosmicButton';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { rescheduleApi } from '../../api/rescheduleApi';
import { formatDateForDisplay, formatTime } from '../../utils/dateHelpers';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const ERROR = C.accent.error;
const SUCCESS = C.accent.success;
const GLASS_BORDER = C.border.light;
const PANEL = S.panel;

export default function RescheduleResponseScreen({ navigation, route }) {
  const styles = useThemedStyles(createRescheduleResponseStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const { proposal } = route.params;
  // proposal: reschedule_requests row with bookings relation attached
  const insets = useSafeAreaInsets();

  const booking = proposal?.bookings;
  const mentor = booking?.profiles; // mentor profile from bookings relation
  const originalSlot = booking?.availability_slots || {};
  const reason = booking?.reschedule_reason;

  const [loading, setLoading] = useState(null); // 'accept' | 'decline' | null
  const [done, setDone] = useState(null); // 'accepted' | 'declined'

  const expiresAt = proposal?.expires_at ? new Date(proposal.expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date();

  const reasonLabel =
    reason === 'mentor_noshow'
      ? 'Mentor did not join the session'
      : reason === 'technical'
        ? 'Session ended too early (technical issue)'
        : 'Session could not be completed';

  const handleAccept = useCallback(async () => {
    Alert.alert(
      'Accept Proposal?',
      `Confirm your new session on ${formatDateForDisplay(proposal.proposed_date)} at ${formatTime(proposal.proposed_start_time)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading('accept');
            try {
              await rescheduleApi.acceptProposal(proposal.id);
              setDone('accepted');
              Toast.show('Session rescheduled!');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to accept proposal');
            } finally {
              setLoading(null);
            }
          },
        },
      ],
    );
  }, [proposal]);

  const handleDecline = useCallback(async () => {
    Alert.alert(
      'Decline Proposal?',
      'The mentor will be notified and can propose another time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading('decline');
            try {
              await rescheduleApi.declineProposal(proposal.id);
              setDone('declined');
              Toast.show('Proposal declined. Mentor will suggest another time.');
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to decline proposal');
            } finally {
              setLoading(null);
            }
          },
        },
      ],
    );
  }, [proposal]);

  if (done === 'accepted') {
    return (
      <CosmicBackground style={{ flex: 1 }}>
        <View style={[styles.centeredFull, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.resultIcon, { backgroundColor: S.accentSuccess, borderColor: B.successBorder }]}>
            <MaterialIcons name="check-circle" size={48} color={SUCCESS} />
          </View>
          <Text style={styles.resultTitle}>Session Rescheduled!</Text>
          <Text style={styles.resultSub}>
            Your new session with {mentor?.name || 'your mentor'} is confirmed on{' '}
            {formatDateForDisplay(proposal.proposed_date)} at {formatTime(proposal.proposed_start_time)}.
          </Text>
          <CosmicButton
            label="Go to Bookings"
            variant="success"
            onPress={() => navigation.goBack()}
            style={{ marginTop: T.spacing.xl, width: '80%' }}
          />
        </View>
      </CosmicBackground>
    );
  }

  if (done === 'declined') {
    return (
      <CosmicBackground style={{ flex: 1 }}>
        <View style={[styles.centeredFull, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.resultIcon, { backgroundColor: B.dangerBg, borderColor: B.dangerBorder }]}>
            <MaterialIcons name="event-busy" size={48} color={ERROR} />
          </View>
          <Text style={styles.resultTitle}>Proposal Declined</Text>
          <Text style={styles.resultSub}>
            {mentor?.name || 'Your mentor'} will be notified and can propose another time.
            Check back in your bookings soon.
          </Text>
          <CosmicButton
            label="Go to Bookings"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: T.spacing.xl, width: '80%' }}
          />
        </View>
      </CosmicBackground>
    );
  }

  return (
    <CosmicBackground style={{ flex: 1 }}>
      <StackScreenHeader>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Reschedule Proposal</Text>
            <Text style={styles.headerSub}>From {mentor?.name || 'your mentor'}</Text>
          </View>
          <View style={styles.headerSide} />
        </View>
      </StackScreenHeader>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mentor card */}
        <View style={styles.mentorCard}>
          <View style={styles.mentorAvatar}>
            {mentor?.avatar_url ? (
              <Image source={{ uri: mentor.avatar_url }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(mentor?.name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.mentorInfo}>
            <Text style={styles.mentorName}>{mentor?.name || 'Mentor'}</Text>
            <Text style={styles.mentorRole}>Your Mentor</Text>
          </View>
        </View>

        {/* Context */}
        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>Why was this rescheduled?</Text>
          <Text style={styles.contextReason}>{reasonLabel}</Text>
          <View style={styles.contextDivider} />
          <View style={styles.slotRow}>
            <MaterialIcons name="event-busy" size={16} color={ERROR} />
            <Text style={styles.slotLabel}>Original session</Text>
            <Text style={styles.slotValue}>
              {formatDateForDisplay(originalSlot.date)}
              {' · '}
              {formatTime(originalSlot.start_time)}
            </Text>
          </View>
        </View>

        {/* Proposal */}
        {isExpired ? (
          <View style={[styles.proposalCard, styles.proposalExpired]}>
            <MaterialIcons name="timer-off" size={28} color={ERROR} />
            <Text style={styles.proposalTitle}>Proposal Expired</Text>
            <Text style={styles.proposalSub}>
              This proposal expired on {expiresAt.toLocaleDateString()}. The mentor can submit a new one.
            </Text>
          </View>
        ) : proposal.proposed_date ? (
          <View style={styles.proposalCard}>
            <View style={styles.proposalIconWrap}>
              <MaterialIcons name="event-available" size={28} color={TEAL} />
            </View>
            <Text style={styles.proposalTitle}>New Time Proposed</Text>
            <View style={styles.proposedTimeRow}>
              <View style={styles.proposedTimeItem}>
                <MaterialIcons name="event" size={20} color={TEAL} />
                <Text style={styles.proposedDate}>{formatDateForDisplay(proposal.proposed_date)}</Text>
              </View>
              <View style={styles.proposedTimeDivider} />
              <View style={styles.proposedTimeItem}>
                <MaterialIcons name="access-time" size={20} color={TEAL} />
                <Text style={styles.proposedDate}>
                  {formatTime(proposal.proposed_start_time)} – {formatTime(proposal.proposed_end_time)}
                </Text>
              </View>
            </View>
            {expiresAt ? (
              <Text style={styles.expiryNote}>
                Expires {expiresAt.toLocaleDateString()} — respond before then
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.proposalCard, styles.proposalWaiting]}>
            <MaterialIcons name="hourglass-empty" size={28} color={GOLD} />
            <Text style={styles.proposalTitle}>Waiting for mentor's proposal</Text>
            <Text style={styles.proposalSub}>
              {mentor?.name || 'Your mentor'} will propose a new time. Check back soon.
            </Text>
          </View>
        )}

        {/* Actions */}
        {proposal.proposed_date && !isExpired ? (
          <>
            <CosmicButton
              label={loading === 'accept' ? 'Confirming…' : 'Accept & Confirm Session'}
              variant="success"
              onPress={handleAccept}
              disabled={!!loading}
              style={styles.cta}
            />
            <CosmicButton
              label={loading === 'decline' ? 'Declining…' : 'Decline — Propose Another Time'}
              variant="danger"
              onPress={handleDecline}
              disabled={!!loading}
            />
          </>
        ) : (
          <CosmicButton
            label="Back to Bookings"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={styles.cta}
          />
        )}
      </ScrollView>
    </CosmicBackground>
  );
}

function createRescheduleResponseStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const isLight = T.mode === 'light';
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: T.spacing.md,
    gap: T.spacing.md,
  },

  centeredFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: T.spacing.xl,
    gap: T.spacing.md,
  },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: T.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resultTitle: {
    ...T.typography.headingMd,
    color: C.text.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultSub: {
    ...T.typography.bodyMd,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSide: { width: 40 },
  headerTitle: {
    ...T.typography.headingXs,
    color: C.text.primary,
    fontWeight: '800',
  },
  headerSub: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: 2,
  },

  mentorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    backgroundColor: PANEL,
    borderRadius: T.borderRadius.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.md,
  },
  mentorAvatar: {
    width: 52,
    height: 52,
    borderRadius: T.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border.default,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: B.nebulaGradient[0],
  },
  mentorInfo: { flex: 1 },
  mentorName: {
    ...T.typography.labelLg,
    fontWeight: '800',
    color: C.text.primary,
  },
  mentorRole: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: 2,
  },

  contextCard: {
    backgroundColor: PANEL,
    borderRadius: T.borderRadius.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.md,
    gap: T.spacing.sm,
  },
  contextLabel: {
    ...T.typography.labelSm,
    color: C.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  contextReason: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: C.text.secondary,
  },
  contextDivider: {
    height: 1,
    backgroundColor: GLASS_BORDER,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
  },
  slotLabel: {
    ...T.typography.bodySm,
    color: C.text.muted,
    flex: 1,
  },
  slotValue: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: C.text.secondary,
  },

  proposalCard: {
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.lg,
    borderWidth: 1,
    borderColor: C.border.default,
    padding: T.spacing.xl,
    alignItems: 'center',
    gap: T.spacing.sm,
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 4 } }),
  },
  proposalExpired: {
    backgroundColor: B.dangerBg,
    borderColor: B.dangerBorder,
  },
  proposalWaiting: {
    backgroundColor: S.accentGold,
    borderColor: B.goldOutlineBorder,
  },
  proposalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: T.borderRadius.md,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: softBorder(theme),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.xs,
  },
  proposalTitle: {
    ...T.typography.labelLg,
    fontWeight: '800',
    color: C.text.primary,
  },
  proposalSub: {
    ...T.typography.bodySm,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  proposedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginTop: T.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  proposedTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  proposedTimeDivider: {
    width: 1,
    height: 20,
    backgroundColor: GLASS_BORDER,
  },
  proposedDate: {
    ...T.typography.labelMd,
    fontWeight: '700',
    color: C.text.primary,
  },
  expiryNote: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: T.spacing.xs,
  },

  cta: { marginTop: T.spacing.xs },
});
}