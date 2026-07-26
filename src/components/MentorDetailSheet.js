import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CosmicButton from './CosmicButton';
import { CircularProfileImage } from './CircularGradientFrame';
import { useAvatarPreview } from '../contexts/AvatarPreviewContext';
import { UNIFIED_THEME } from '../unifiedTheme';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { iosFlexChild, PLATFORM_LAYOUT } from '../utils/platformLayout';
import { ringBorder } from '../theme/surfaceStyles';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;

const SHEET_HEIGHT = 520;

function PressScale({ onPress, style, hitSlop, children, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.92,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function StatSegment({ icon, iconColor, value, label }) {
  const styles = useThemedStyles(createThemedStyles);
  return (
    <View style={styles.statSeg}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </Text>
      <View style={styles.statLabelRow}>
        <MaterialIcons name={icon} size={12} color={iconColor} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function SheetReveal({ visible, mentorKey, delay = 0, offsetY = 18, style, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      translateY.setValue(offsetY);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 90,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(offsetY);
    }
  }, [visible, mentorKey, delay, offsetY, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function AvatarReveal({ visible, mentorKey, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.82);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          delay: 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          delay: 90,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      scale.setValue(0.82);
    }
  }, [visible, mentorKey, opacity, scale]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

export function MentorDetailSheet({ mentor, visible, onClose, onBook, onViewProfile }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const SHEET_BG = C.surface.sheet;
  const PANEL_BG = C.surface.panel;
  const { showAvatarPreview } = useAvatarPreview();
  const insets = useSafeAreaInsets();
  const actionsBottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8) + T.spacing.md;
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const actionsSlide = useRef(new Animated.Value(48)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      actionsSlide.setValue(48);
      actionsOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(160),
          Animated.parallel([
            Animated.spring(actionsSlide, {
              toValue: 0,
              friction: 7,
              tension: 95,
              useNativeDriver: true,
            }),
            Animated.timing(actionsOpacity, {
              toValue: 1,
              duration: 280,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    } else {
      actionsSlide.setValue(48);
      actionsOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, mentor?.id, slideAnim, backdropAnim, actionsSlide, actionsOpacity]);

  if (!mentor) return null;

  const name = mentor.profiles?.name || 'Unknown';
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = mentor.profiles?.avatar_url;
  const rating = mentor.rating != null && mentor.rating !== '' ? String(mentor.rating) : '—';
  const price = mentor.price_per_hour;
  const priceLabel = !price || price === 0 ? 'Free' : `₹${price}`;
  const expYears = mentor.experience_years ? `${mentor.experience_years}` : '—';
  const sessions = mentor.total_sessions ?? 0;
  const bio = mentor.bio || null;
  const spec = mentor.specialization || null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <PressScale
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeBtnWrap}
          accessibilityLabel="Close profile"
        >
          <View style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={C.text.primary} />
          </View>
        </PressScale>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <View style={styles.header}>
            <AvatarReveal visible={visible} mentorKey={mentor.id} key={`avatar-${mentor.id}`}>
              <PressScale
                onPress={() => showAvatarPreview({ uri: avatarUrl, name })}
                accessibilityLabel={`View ${name} profile photo`}
              >
                <CircularProfileImage
                  size={76}
                  ringWidth={2}
                  colors={B.premiumGradient}
                  innerBg={C.primary.void}
                  uri={avatarUrl}
                  previewName={name}
                  pressable={false}
                  fallback={
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  }
                />
              </PressScale>
            </AvatarReveal>
            <SheetReveal visible={visible} mentorKey={mentor.id} delay={130} offsetY={14} style={styles.headerInfo} key={`info-${mentor.id}`}>
              <Text style={styles.name}>{name}</Text>
              {spec ? (
                <Text style={styles.spec} numberOfLines={2}>
                  {spec}
                </Text>
              ) : null}
              <View style={styles.verifiedRow}>
                <MaterialIcons name="verified" size={14} color={TEAL} />
                <Text style={styles.verifiedTxt}>Verified Mentor</Text>
              </View>
            </SheetReveal>
          </View>

          <SheetReveal visible={visible} mentorKey={mentor.id} delay={190} offsetY={20} key={`stats-${mentor.id}`}>
            <View style={styles.statsBar}>
              <StatSegment icon="star" iconColor={GOLD} value={rating} label="Rating" />
              <View style={styles.statDivider} />
              <StatSegment icon="history-edu" iconColor={TEAL} value={String(sessions)} label="Sessions" />
              <View style={styles.statDivider} />
              <StatSegment icon="workspace-premium" iconColor={PURPLE_LINK} value={expYears} label="Exp" />
              <View style={styles.statDivider} />
              <StatSegment icon="payments" iconColor={GOLD} value={priceLabel} label="Per session" />
            </View>
          </SheetReveal>

          {bio ? (
            <SheetReveal visible={visible} mentorKey={mentor.id} delay={250} offsetY={20} key={`bio-${mentor.id}`}>
              <View style={styles.bioWrap}>
                <Text style={styles.bioLabel}>About</Text>
                <Text style={styles.bioText}>{bio}</Text>
              </View>
            </SheetReveal>
          ) : null}
        </ScrollView>

        <Animated.View
          style={[
            styles.actions,
            {
              opacity: actionsOpacity,
              transform: [{ translateY: actionsSlide }],
              paddingBottom: actionsBottomPad,
            },
          ]}
        >
          <CosmicButton
            label="View Profile"
            icon="person-outline"
            variant="outline"
            pressScale
            pill
            numberOfLines={1}
            onPress={() => {
              onClose();
              onViewProfile(mentor);
            }}
            style={styles.actionBtn}
          />

          <CosmicButton
            label="Book Session"
            icon="event-available"
            variant="nebula"
            pressScale
            pill
            numberOfLines={1}
            onPress={() => onBook(mentor)}
            style={styles.actionBtn}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const SHEET_BG = C.surface.sheet;
  const PANEL_BG = C.surface.panel;
  return StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.component.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(167,139,250,0.28)',
    maxHeight: '85%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.mode === 'light' ? C.border.default : 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginTop: T.spacing.md,
    marginBottom: T.spacing.sm,
    zIndex: 1,
  },
  closeBtnWrap: {
    position: 'absolute',
    top: T.spacing.md,
    right: T.spacing.lg,
    zIndex: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  scrollContent: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.sm,
    paddingBottom: T.spacing.lg,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    gap: T.spacing.lg,
    alignItems: 'flex-start',
    marginBottom: T.spacing.lg,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: ringBorder(theme),
  },
  avatarFallback: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.primary.void,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '800',
    color: PURPLE_LINK,
  },
  headerInfo: {
    ...iosFlexChild(),
    paddingTop: 4,
  },
  name: {
    fontSize: 20,
    color: C.text.primary,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: T.spacing.xs,
  },
  spec: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: T.spacing.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedTxt: {
    fontSize: 12,
    color: TEAL,
    fontWeight: '600',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: PANEL_BG,
    paddingVertical: 11,
    paddingHorizontal: 4,
    marginBottom: T.spacing.lg,
  },
  statSeg: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text.muted,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(167,139,250,0.18)',
    marginVertical: 6,
    alignSelf: 'stretch',
  },
  bioWrap: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    padding: T.spacing.md,
  },
  bioLabel: {
    fontSize: 11,
    color: PURPLE_LINK,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: T.spacing.sm,
  },
  bioText: {
    fontSize: 14,
    color: C.text.secondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: T.spacing.sm,
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.22)',
    backgroundColor: SHEET_BG,
    zIndex: 1,
  },
  actionBtn: {
    width: '100%',
    alignSelf: 'stretch',
    marginVertical: 0,
    height: PLATFORM_LAYOUT.buttonMinHeight,
  },
});
}

