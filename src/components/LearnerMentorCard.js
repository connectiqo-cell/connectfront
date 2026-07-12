import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CosmicButton from './CosmicButton';
import { CircularProfileImage } from './CircularGradientFrame';
import { UNIFIED_THEME } from '../unifiedTheme';
import { iosFlexChild } from '../utils/platformLayout';
import { scaleUi } from '../utils/iosUiScale';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;

const S = C.surface;

/**
 * Learner discover tile — cosmic glass card aligned with mentor profile rails.
 */
export function LearnerMentorCard({
  mentor,
  onBook,
  onViewProfile,
  onPress,
  fullWidth = false,
}) {
  const name = mentor.profiles?.name || 'Unknown';
  const initial = name.charAt(0).toUpperCase();
  const rating = mentor.rating != null && mentor.rating !== '' ? String(mentor.rating) : null;
  const price = mentor.price_per_hour;
  const priceLabel = !price || price === 0 ? 'Free' : `₹${price}`;
  const expYears = mentor.experience_years;
  const sessions = mentor.total_sessions ?? 0;
  const hasActions = Boolean(onBook && onViewProfile);

  const body = (
    <>
      <View style={styles.topRow}>
        <View style={styles.avatarRingWrap}>
          <CircularProfileImage
            size={Platform.OS === 'ios' ? scaleUi(48) : 48}
            ringWidth={2}
            colors={['rgba(167,139,250,0.95)', 'rgba(255,255,255,0.55)', 'rgba(94,234,212,0.5)']}
            innerBg={C.primary.void}
            uri={mentor.profiles?.avatar_url}
            fallback={
              <View style={[styles.avatarPh, styles.avatarFallbackSmall]}>
                <Text style={styles.avatarLetter}>{initial}</Text>
              </View>
            }
          />
        </View>
        <View style={styles.headMain}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.badgeRow}>
            {rating ? (
              <View style={styles.ratingBadge}>
                <MaterialIcons name="star" size={11} color={GOLD} />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            ) : null}
            {expYears ? (
              <View style={styles.expBadge}>
                <Text style={styles.expText}>{expYears}yr</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Text style={styles.spec} numberOfLines={2}>
        {mentor.specialization || 'Specialist'}
      </Text>

      <View style={styles.priceRow}>
        <Text style={[styles.price, !price && styles.priceFree]}>{priceLabel}</Text>
        {price ? <Text style={styles.priceUnit}>/hr</Text> : null}
      </View>

      <View style={styles.metaRow}>
        <MaterialIcons name="history-edu" size={12} color={C.text.muted} />
        <Text style={styles.metaText}>{sessions} sessions</Text>
      </View>

      {hasActions ? (
        <View style={styles.actions}>
          <CosmicButton
            label="Book"
            variant="primary"
            size="compact"
            onPress={() => onBook(mentor)}
            style={styles.bookBtnThemed}
          />
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => onViewProfile(mentor)}
            activeOpacity={0.85}
            accessibilityLabel="View profile"
          >
            <MaterialIcons name="person-outline" size={18} color={PURPLE_LINK} />
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, fullWidth && styles.cardFullWidth]}
        onPress={() => onPress(mentor)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${mentor.specialization || 'mentor'}`}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, fullWidth && styles.cardFullWidth]}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    width: Platform.OS === 'ios' ? scaleUi(192) : 176,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  cardFullWidth: {
    width: '100%',
    flex: undefined,
    ...Platform.select({
      ios: T.shadows.small,
      android: { elevation: 3 },
    }),
  },
  topRow: {
    flexDirection: 'row',
    marginBottom: T.spacing.sm,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {},
      default: { gap: T.spacing.sm },
    }),
  },
  avatarRingWrap: {
    alignItems: 'center',
    ...Platform.select({
      ios: { marginRight: T.spacing.sm },
      default: {},
    }),
  },
  avatarRingGrad: {
    padding: 2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFallbackSmall: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPh: {
    backgroundColor: S.accentViolet,
  },
  avatarLetter: {
    fontSize: 18,
    color: PURPLE_LINK,
    fontWeight: '700',
  },
  headMain: iosFlexChild(),
  name: {
    fontSize: Platform.OS === 'ios' ? scaleUi(15) : 13,
    color: C.text.primary,
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    marginBottom: 5,
    lineHeight: Platform.OS === 'ios' ? scaleUi(20) : 17,
    letterSpacing: Platform.OS === 'ios' ? 0 : -0.2,
    flexShrink: 1,
    ...(Platform.OS === 'ios'
      ? {
          backgroundColor: 'transparent',
          width: '100%',
        }
      : {}),
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: S.accentGold,
    borderRadius: T.borderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.25)',
  },
  ratingText: {
    fontSize: 11,
    color: GOLD,
    fontWeight: '700',
  },
  expBadge: {
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  expText: {
    fontSize: 11,
    color: TEAL,
    fontWeight: '700',
  },
  spec: {
    fontSize: 12,
    color: GOLD,
    fontWeight: '700',
    marginBottom: T.spacing.sm,
    minHeight: Platform.OS === 'ios' ? scaleUi(32) : 26,
    lineHeight: Platform.OS === 'ios' ? scaleUi(18) : 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginBottom: T.spacing.xs,
  },
  price: {
    fontSize: 14,
    color: C.text.primary,
    fontWeight: '800',
  },
  priceFree: {
    color: TEAL,
  },
  priceUnit: {
    fontSize: 11,
    color: C.text.muted,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: T.spacing.sm,
  },
  metaText: {
    fontSize: 11,
    color: C.text.muted,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: T.spacing.xs,
    width: '100%',
    marginTop: 'auto',
  },
  bookBtnThemed: { flex: 1, flexBasis: 0, minWidth: 0, marginVertical: 0 },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: S.accentViolet,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
