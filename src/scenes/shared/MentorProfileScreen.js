import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import CosmicButton from '../../components/CosmicButton';
import { CircularProfileImage } from '../../components/CircularGradientFrame';
import ReportUserSheet from '../../components/ReportUserSheet';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, avatarRingColors } from '../../theme/surfaceStyles';
import { iosFlexChild, PLATFORM_LAYOUT } from '../../utils/platformLayout';
import { profileApi } from '../../api/profileApi';
import { videoApi } from '../../api/videoApi';
import { bookingApi } from '../../api/bookingApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { navigateToLearnerVideosTab } from '../../navigators/navigateToLearnerVideos';
import { parseMentorCategories } from '../../utils/mentorCategories';
import { pickProfileAvatar } from '../../utils/pickProfileAvatar';
import { isSameUserId } from '../../utils/mentorOwnership';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import { purchaseAndroidProduct, finishAndroidPurchase, getPlayProductIdForPrice } from '../../utils/playBilling';
import { purchaseIosProduct, finishIosPurchase, getAppleProductIdForPrice } from '../../utils/appleBilling';
import { useAvatarPreview } from '../../contexts/AvatarPreviewContext';

const T = UNIFIED_THEME;
const C = T.colors;

/** Opaque fill for small UI elements (avatar ring, refresh spinner). */
const SCREEN_BG = C.primary.void;
const PURPLE_LINK = '#a78bfa';
const GOLD = '#f0d875';
const TEAL = '#2dd4bf';
const TEAL_DEEP = '#0c2a28';
const VERIFIED_BLUE = '#38bdf8';

const FREE_LIMIT = 2;
const TAG_VISIBLE = 3;

const SCREEN_W = Dimensions.get('window').width;
const RAIL_CARD_W = Math.min(138, Math.round(SCREEN_W * 0.36));

function formatSlotDateLabel(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function firstRow(obj) {
  if (obj == null) return null;
  return Array.isArray(obj) ? obj[0] : obj;
}

function mapBookingToPastSession(b) {
  const learner = firstRow(b.profiles);
  const slot = firstRow(b.availability_slots);
  const rec = firstRow(b.recordings);
  const rev = firstRow(b.reviews);
  const recapUrl = rec?.recording_playback_url || rec?.recording_url || null;
  return {
    id: b.id,
    student_name: learner?.name || 'Learner',
    topic: (b.message && String(b.message).trim()) || '1-on-1 session',
    date_label: slot?.date ? formatSlotDateLabel(slot.date) : '',
    rating: rev?.rating != null ? Number(rev.rating) : null,
    student_avatar_url: learner?.avatar_url || null,
    recap_url: recapUrl,
  };
}

function formatDurationSec(sec) {
  if (sec == null || Number.isNaN(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact counts for the stats bar (fits four columns on narrow screens). */
function formatStatCount(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  const num = Math.max(0, Math.floor(Number(n)));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${Math.round(num / 1000)}k`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function isPreviewSlot(video, index) {
  return video.is_free || index < FREE_LIMIT;
}

/** Staggered fade + slide entrance for profile sections. */
function ProfileFadeIn({ delayIndex = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.97)).current;
  const delay = delayIndex * 70;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 85,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

/** Press scale + optional glow for tappable profile elements. */
function PressableScale({
  children,
  onPress,
  style,
  disabled,
  scaleTo = 0.94,
  hitSlop,
  showGlow = true,
}) {
  const pressFx = useThemedStyles(createMentorPressFxStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={style}
        hitSlop={hitSlop}
      >
        {showGlow ? (
          <Animated.View
            pointerEvents="none"
            style={[pressFx.glowRing, { opacity: glowOpacity }]}
          />
        ) : null}
        {children}
      </Pressable>
    </Animated.View>
  );
}

function createMentorPressFxStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PURPLE_LINK,
  },
});
}

/** Subtle Ken Burns zoom on hero cover. */
function HeroEntrance({ children, style }) {
  const scale = useRef(new Animated.Value(1.08)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

/** Pulsing halo behind avatar ring. */
function AvatarPulseRing({ children }) {
  const avatarFx = useThemedStyles(createMentorAvatarFxStyles);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  return (
    <View style={avatarFx.wrap}>
      <Animated.View
        style={[
          avatarFx.halo,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      {children}
    </View>
  );
}

function createMentorAvatarFxStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'center' },
  halo: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: PURPLE_LINK,
    top: -8,
  },
  dotWrap: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
  },
  dotCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: SCREEN_BG,
  },
});
}

/** Breathing online indicator. */
function PulseOnlineDot({ style }) {
  const avatarFx = useThemedStyles(createMentorAvatarFxStyles);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={[style, avatarFx.dotWrap]}>
      <Animated.View
        style={[avatarFx.dotPulse, { opacity: dotOpacity, transform: [{ scale: dotScale }] }]}
      />
      <View style={avatarFx.dotCore} />
    </View>
  );
}

function AnimatedTagChip({ label, overflow }) {
  const styles = useThemedStyles(createMentorProfileStyles);
  return (
    <Text style={[styles.tagTxt, overflow && styles.tagOverflowTxt]}>{label}</Text>
  );
}

function GoldStarsRow({ rating, size = 11 }) {
  const { theme } = useTheme();
  const starColor = theme.colors.accent.primary;
  const filled = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <MaterialIcons
          key={i}
          name={i < filled ? 'star' : 'star-border'}
          size={size}
          color={starColor}
        />
      ))}
    </View>
  );
}

function MetricsStatRow({ subscriberCount, rating, videoCount, totalSessions, onRatingPress }) {
  const { theme: liveTheme } = useTheme();
  const statsBar = useThemedStyles(createMentorStatsBarStyles);
  const LC = liveTheme.colors;
  const isLight = liveTheme.mode === 'light';
  const ratingNum = Number(rating) || 0;
  const hasRating = ratingNum > 0;
  const numberColor = LC.text.primary;
  const labelColor = LC.text.muted;
  const dividerColor = isLight ? LC.border.light : 'rgba(255,255,255,0.18)';
  const accentPurple = LC.accent.primary;
  const accentTeal = LC.accent.secondary;
  const accentGold = isLight ? LC.accent.primary : GOLD;

  const CountSeg = ({ icon, iconColor, valueText, label }) => (
    <View style={statsBar.segment}>
      <View style={statsBar.valueRowSlot}>
        <Text
          style={[statsBar.valueBig, { color: numberColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {valueText}
        </Text>
      </View>
      <View style={statsBar.starsSlot}>
        <View style={statsBar.starsSlotInner} />
      </View>
      <View style={statsBar.labelRow}>
        <MaterialIcons name={icon} size={12} color={iconColor} />
        <Text
          style={[statsBar.labelMuted, { color: labelColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          {label}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={statsBar.wrap}>
      <CountSeg
        icon="groups"
        iconColor={isLight ? accentPurple : '#e879f9'}
        valueText={formatStatCount(subscriberCount)}
        label="Subscribers"
      />
      <View style={[statsBar.divider, { backgroundColor: dividerColor }]} />
      <CountSeg
        icon="video-library"
        iconColor={accentPurple}
        valueText={formatStatCount(videoCount)}
        label="Videos"
      />
      <View style={[statsBar.divider, { backgroundColor: dividerColor }]} />
      <CountSeg
        icon="event"
        iconColor={accentTeal}
        valueText={formatStatCount(totalSessions)}
        label="Sessions"
      />
      <View style={[statsBar.divider, { backgroundColor: dividerColor }]} />
      <Pressable
        onPress={onRatingPress}
        disabled={!onRatingPress}
        style={({ pressed }) => [
          statsBar.segment,
          statsBar.ratingSegment,
          onRatingPress && pressed && statsBar.ratingSegmentPressed,
        ]}
        accessibilityRole={onRatingPress ? 'button' : undefined}
        accessibilityLabel="View reviews"
      >
        <View style={statsBar.valueRowSlot}>
          <Text
            style={[statsBar.valueBig, { color: numberColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {hasRating ? ratingNum.toFixed(1) : '—'}
          </Text>
        </View>
        <View style={statsBar.starsSlot}>
          <View style={statsBar.starsSlotInner} />
        </View>
        <View style={statsBar.labelRow}>
          <MaterialIcons name="star" size={12} color={accentGold} />
          <Text style={[statsBar.labelMuted, { color: labelColor }]} numberOfLines={1}>
            Reviews
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function createMentorStatsBarStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: T.spacing.lg,
    marginBottom: T.spacing.md,
    paddingVertical: T.spacing.sm,
    paddingHorizontal: 0,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 2,
  },
  valueRowSlot: {
    minHeight: 22,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueBig: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    width: '100%',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  starsSlot: {
    height: 14,
    width: '100%',
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starsSlotInner: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 5,
    maxWidth: '100%',
  },
  labelMuted: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
    alignSelf: 'stretch',
  },
  ratingSegment: {},
  ratingSegmentPressed: {
    opacity: 0.7,
  },
});
}

function SectionHeaderRow({ title, onSeeAll, delayIndex = 0 }) {
  const { theme: liveTheme } = useTheme();
  const secHdr = useThemedStyles(createMentorSecHdrStyles);
  const PURPLE_LINK = liveTheme.colors.buttons.nebulaGradient[0];
  const scale = useRef(new Animated.Value(1)).current;
  const chevronX = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.94,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(chevronX, {
        toValue: 5,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(chevronX, {
        toValue: 0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <ProfileFadeIn delayIndex={delayIndex} style={secHdr.row}>
      <Text style={[secHdr.title, { color: liveTheme.colors.text.primary }]}>{title}</Text>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onSeeAll}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={secHdr.linkBtn}
        >
          <Text style={secHdr.link}>See all</Text>
          <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
            <MaterialIcons name="chevron-right" size={18} color={PURPLE_LINK} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </ProfileFadeIn>
  );
}

function createMentorSecHdrStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.lg,
    marginTop: T.spacing.xs,
    marginBottom: 2,
  },
  title: { fontSize: 15, fontWeight: '800', color: C.text.primary },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  link: { fontSize: 13, fontWeight: '700', color: PURPLE_LINK },
});
}

function PortraitVideoCard({
  video,
  index,
  isUnlocked,
  onPlay,
  locked,
  isOwnChannel = false,
  cardWidth = RAIL_CARD_W,
  thumbAspect = 1.38,
  animDelay = 0,
}) {
  const { theme: liveTheme } = useTheme();
  const railCard = useThemedStyles(createMentorRailCardStyles);
  const isPrev = isPreviewSlot(video, index);
  const canPlay = isOwnChannel || isPrev || isUnlocked;
  const showLocked = !isOwnChannel && locked && !isPrev && !isUnlocked;
  const durationLabel = formatDurationSec(video.duration_sec);
  const thumbH = Math.round(cardWidth * thumbAspect);
  const iconSize = Math.round(Math.min(34, cardWidth * 0.26));
  const playIconSize = Math.round(Math.min(26, cardWidth * 0.22));
  const railMargin = cardWidth >= SCREEN_W * 0.85 ? 0 : 10;

  const handlePress = () => {
    if (canPlay) onPlay(video);
    else Toast.show('Subscribe to unlock this video', Toast.SHORT);
  };

  return (
    <ProfileFadeIn delayIndex={animDelay} style={{ marginRight: railMargin }}>
      <PressableScale
        onPress={handlePress}
        scaleTo={0.93}
        style={[railCard.card, { width: cardWidth }]}
      >
        <View style={[railCard.thumbWrap, { height: thumbH }]}>
          {video.thumbnail_url ? (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={[railCard.thumbImg, showLocked ? { opacity: Platform.OS === 'ios' ? 0.5 : 0.42 } : null]}
              resizeMode="cover"
              blurRadius={showLocked && Platform.OS === 'ios' ? 14 : 0}
            />
          ) : (
            <LinearGradient
              colors={['#3d3666', '#16122c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={railCard.thumbPlaceholder}
            >
              <MaterialIcons name="videocam" size={Math.round(Math.min(36, cardWidth * 0.32))} color="rgba(255,255,255,0.38)" />
            </LinearGradient>
          )}
          {showLocked ? (
            <>
              <LinearGradient
                colors={['rgba(8,6,24,0.55)', 'rgba(3,2,12,0.92)']}
                style={railCard.thumbDim}
              />
              <View style={railCard.lockCenter}>
                <MaterialIcons name="lock" size={iconSize} color="rgba(255,255,255,0.5)" />
              </View>
              {durationLabel ? (
                <Text style={railCard.lockedDurTxt}>{durationLabel}</Text>
              ) : null}
            </>
          ) : (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(5,5,20,0.82)']}
                style={railCard.thumbBottomFade}
              />
              <View style={railCard.thumbBottomRow}>
                <MaterialIcons name="play-circle-filled" size={playIconSize} color="rgba(255,255,255,0.95)" />
                {durationLabel ? (
                  <Text style={railCard.durTxt}>{durationLabel}</Text>
                ) : <View />}
              </View>
            </>
          )}
        </View>
        <View style={railCard.info}>
          <Text style={[railCard.titleTxt, { color: liveTheme.colors.text.primary }]} numberOfLines={2}>{video.title}</Text>
        </View>
      </PressableScale>
    </ProfileFadeIn>
  );
}

function createMentorRailCardStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const isLight = theme.mode === 'light';
  return StyleSheet.create({
  card: {
    borderRadius: isLight ? 10 : 4,
    overflow: 'hidden',
    backgroundColor: isLight ? PANEL_BG : 'transparent',
    ...(isLight
      ? {
          borderWidth: 1,
          borderColor: softBorder(theme),
        }
      : {}),
  },
  thumbWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: isLight ? 9 : 0,
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImg: { ...StyleSheet.absoluteFillObject },
  thumbDim: { ...StyleSheet.absoluteFillObject },
  lockCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '35%',
  },
  thumbBottomRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  lockedDurTxt: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  info: { paddingHorizontal: 2, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  titleTxt: { color: C.text.primary, fontSize: 12, fontWeight: '700', lineHeight: 16 },
});
}

function PastSessionRow({ session, onWatchRecap }) {
  const { theme } = useTheme();
  const past = useThemedStyles(createMentorPastStyles);
  const C = theme.colors;
  const GOLD = C.accent.primary;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const { showAvatarPreview } = useAvatarPreview();
  const hasRecap = Boolean(session.recap_url);
  const hasRating = session.rating != null && !Number.isNaN(session.rating);

  return (
    <View style={past.card}>
      {session.student_avatar_url ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => showAvatarPreview({
            uri: session.student_avatar_url,
            name: session.student_name || 'Learner',
          })}
        >
          <Image source={{ uri: session.student_avatar_url }} style={past.avatar} />
        </TouchableOpacity>
      ) : (
        <View style={[past.avatar, past.avatarPh]}>
          <MaterialIcons name="person" size={22} color={C.text.muted} />
        </View>
      )}
      <View style={past.mid}>
        <Text style={past.title} numberOfLines={1}>
          Session with {session.student_name}
        </Text>
        <Text style={past.sub} numberOfLines={1}>{session.topic}</Text>
      </View>
      <View style={past.right}>
        <Text style={past.date}>{session.date_label || '—'}</Text>
        {hasRating ? (
          <View style={past.starRow}>
            <MaterialIcons name="star" size={14} color={GOLD} />
            <Text style={past.rateTxt}>{Number(session.rating).toFixed(1)}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[past.recapBtn, !hasRecap && past.recapBtnDisabled]}
          onPress={onWatchRecap}
          activeOpacity={0.9}
          disabled={!hasRecap}
        >
          <MaterialIcons name="play-arrow" size={16} color={hasRecap ? PURPLE_LINK : C.text.muted} />
          <Text style={[past.recapTxt, !hasRecap && past.recapTxtDisabled]}>Watch Recap</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createMentorPastStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  card: {
    marginHorizontal: T.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: T.spacing.sm,
    borderRadius: 12,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: softBorder(theme),
    gap: T.spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary.light },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  mid: { flex: 1, minWidth: 0 },
  title: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
  sub: { color: C.text.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  date: { color: C.text.secondary, fontSize: 11, fontWeight: '600' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rateTxt: { color: C.text.primary, fontSize: 12, fontWeight: '800' },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  recapTxt: { color: PURPLE_LINK, fontSize: 11, fontWeight: '800' },
  recapBtnDisabled: { opacity: 0.55 },
  recapTxtDisabled: { color: C.text.muted },
});
}

export default function MentorProfileScreen({ navigation, route }) {
  const { theme: liveTheme } = useTheme();
  const styles = useThemedStyles(createMentorProfileStyles);
  const sheet = useThemedStyles(createMentorSheetStyles);
  const T = liveTheme;
  const C = liveTheme.colors;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const SCREEN_BG = C.primary.void;
  const isLightTheme = liveTheme.mode === 'light';
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const { user, profile, refreshProfile } = useAuth();
  const { showAvatarPreview: openAvatarPreview } = useAvatarPreview();
  const mentorId = route.params?.mentorId ?? null;
  const paramMentorName = route.params?.mentorName?.trim?.() || '';
  const coverFromParams = route.params?.coverImageUrl?.trim?.() || '';

  const [mentor, setMentor] = useState(null);
  const [videos, setVideos] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [unlocking, setUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOwnProfile = useMemo(
    () => isSameUserId(mentorId, user, profile),
    [mentorId, profile?.id, user?.id],
  );
  const libraryUnlocked = isUnlocked || isOwnProfile;
  const safeScreenProps = {
    padding: 0,
    hasBottomTabs: false,
    includeTopInset: isOwnProfile ? false : Platform.OS !== 'ios',
  };

  const compactHero = useMemo(
    () => Math.round(Math.min(152, Math.max(108, winH * 0.155))),
    [winH],
  );
  const compactRailW = useMemo(() => {
    const side = T.spacing.lg * 2;
    const gap = 10;
    const w = (winW - side - gap * 2) / 1.88;
    return Math.round(Math.min(136, Math.max(102, w)));
  }, [winW]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!mentorId) {
      setError('missing_mentor');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const isSelf = isSameUserId(mentorId, user, profile);

      const fetchMentorRow = async () => {
        try {
          return await profileApi.getMentorProfile(mentorId);
        } catch (err) {
          // Own Profile tab: ensure a mentor_profiles row exists so full view works
          // for accounts that signed up before mentor rows were always created.
          if (!isSelf) throw err;
          const msg = String(err?.message || '').toLowerCase();
          if (msg.includes('not found') || msg.includes('no rows') || msg.includes('0 rows')) {
            return profileApi.createMentorProfile(mentorId);
          }
          // Soft-fallback: still show identity from profiles even if mentor row is broken.
          return {
            id: mentorId,
            specialization: '',
            bio: '',
            experience_years: 0,
            price_per_hour: 0,
            rating: 0,
            total_sessions: 0,
            unlock_price: 299,
            category: '',
            cover_image_url: null,
          };
        }
      };

      const [mpRow, profRow, vids, bookingRows, subCount] = await Promise.all([
        fetchMentorRow(),
        profileApi.getProfile(mentorId).catch(() => null),
        videoApi.getMentorVideos(mentorId).catch(() => []),
        bookingApi.getCompletedSessionsForMentorProfile(mentorId).catch(() => []),
        videoApi.getMentorActiveSubscriberCount(mentorId).catch(() => 0),
      ]);

      const merged = {
        ...mpRow,
        profiles: profRow || { name: paramMentorName || 'Mentor', avatar_url: null },
      };
      setMentor(merged);
      setVideos(Array.isArray(vids) ? vids : []);
      setPastSessions((Array.isArray(bookingRows) ? bookingRows : []).map(mapBookingToPastSession));
      setSubscriberCount(Number.isFinite(Number(subCount)) ? Math.max(0, Math.floor(Number(subCount))) : 0);

      let unlocked = false;
      if (isSelf) {
        unlocked = true;
      } else if (user?.id) {
        unlocked = await videoApi.checkUnlocked({
          learnerId: user.id,
          mentorId,
        }).catch(() => false);
      }
      setIsUnlocked(unlocked);
    } catch (e) {
      setError(e?.message || 'Failed to load mentor');
      setMentor(null);
      setVideos([]);
      setPastSessions([]);
      setSubscriberCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mentorId, paramMentorName, user?.id, profile?.id]);

  useEffect(() => {
    if (isOwnProfile) setIsUnlocked(true);
  }, [isOwnProfile]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const ownTabFocusedOnce = useRef(false);
  // Keep Me → Profile tab in sync after edits (iOS + Android).
  useFocusEffect(
    useCallback(() => {
      if (!mentorId || !isOwnProfile) return undefined;
      if (!ownTabFocusedOnce.current) {
        ownTabFocusedOnce.current = true;
        return undefined;
      }
      loadData(false);
      return undefined;
    }, [mentorId, isOwnProfile, loadData]),
  );

  const allTags = useMemo(() => {
    if (Array.isArray(mentor?.tags) && mentor.tags.length) return mentor.tags;
    const fromCategories = parseMentorCategories(mentor?.category);
    const raw = mentor?.specialization || '';
    const fromSpec = raw.split(',').map(s => s.trim()).filter(Boolean);
    const merged = [...fromCategories, ...fromSpec];
    return [...new Set(merged)];
  }, [mentor]);

  const tagOverflow = Math.max(0, allTags.length - TAG_VISIBLE);
  const visibleTags = allTags.slice(0, TAG_VISIBLE);

  const hasLockedVideos = useMemo(() => videos.some(v => !v.is_free), [videos]);

  const memberVideos = useMemo(() => videos.filter(v => !v.is_free), [videos]);
  const previewVideos = useMemo(() => videos.filter(v => v.is_free), [videos]);

  const handleUnlock = async () => {
    if (!hasLockedVideos) {
      Toast.show('All videos here are already free.', Toast.SHORT);
      return;
    }
    if (!user?.id) {
      Toast.show('Please log in to subscribe.', Toast.SHORT);
      return;
    }
    if (isSameUserId(mentorId, user, profile)) {
      Toast.show('This is your channel.', Toast.SHORT);
      return;
    }
    setUnlocking(true);
    try {
      if (Platform.OS === 'android') {
        const productId = getPlayProductIdForPrice(mentor?.unlock_price || 299);
        const purchase = await purchaseAndroidProduct(productId);

        await videoApi.verifyPlayPurchase({
          mentorId,
          learnerId:     user.id,
          productId:     purchase.productId,
          purchaseToken: purchase.purchaseToken,
        });

        await finishAndroidPurchase(purchase);
      } else if (Platform.OS === 'ios') {
        const productId = getAppleProductIdForPrice(mentor?.unlock_price || 299);
        const purchase = await purchaseIosProduct(productId);

        await videoApi.verifyApplePurchase({
          mentorId,
          learnerId:     user.id,
          productId:     purchase.productId,
          transactionId: purchase.transactionId,
        });

        await finishIosPurchase(purchase);
      } else {
        const order = await videoApi.createVideoOrder({ mentorId, learnerId: user.id });
        const displayName = mentor?.profiles?.name || 'Mentor';
        const paymentData = await openRazorpayCheckout({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Connectiqo',
          description: `Subscribe to ${displayName}'s video library`,
          order_id: order.orderId,
          prefill: { email: user.email || '' },
          theme: { color: '#5eead4' },
          upi: { flow: 'intent' },
        });

        await videoApi.verifyVideoSubscription({
          razorpayOrderId: order.orderId,
          razorpayPaymentId: paymentData.razorpay_payment_id,
          razorpaySignature: paymentData.razorpay_signature,
          mentorId,
          learnerId: user.id,
        });
      }

      setIsUnlocked(true);
      Toast.show('Subscribed! You can watch all videos.', Toast.SHORT);
    } catch (e) {
      if (e?.code !== 'PAYMENT_CANCELLED') {
        Toast.show(e?.message || 'Payment failed', Toast.LONG);
      }
    } finally {
      setUnlocking(false);
    }
  };

  const goBook = () => {
    if (!mentorId) return;
    if (!user?.id) {
      Toast.show('Please log in to book a session.', Toast.SHORT);
      return;
    }
    const nm = mentor?.profiles?.name || paramMentorName || 'Mentor';
    navigation.navigate(SCREEN_NAMES.Booking, { mentorId, mentorName: nm });
  };

  const openLearnerVideoFeed = useCallback(({ videoId } = {}) => {
    if (!mentorId) return;
    navigateToLearnerVideosTab(navigation, { mentorId, videoId });
  }, [mentorId, navigation]);

  const seeAll = () => {
    if (isOwnProfile) {
      navigation.navigate(SCREEN_NAMES.MentorVideos);
      return;
    }
    openLearnerVideoFeed();
  };

  const handlePlayVideo = useCallback((video) => {
    if (!video?.video_url) {
      Toast.show('Video unavailable', Toast.SHORT);
      return;
    }
    openLearnerVideoFeed({ videoId: video.id });
  }, [openLearnerVideoFeed]);

  const openRecap = (session) => {
    if (!session?.recap_url) {
      Toast.show('No recording available yet.', Toast.SHORT);
      return;
    }
    navigation.navigate(SCREEN_NAMES.RecordingPlayer, { recordingUrl: session.recap_url });
  };

  const openReviews = () => {
    if (!mentorId) return;
    navigation.navigate(SCREEN_NAMES.MentorReviews, {
      mentorId,
      mentorName: mentor?.profiles?.name || paramMentorName || 'Mentor',
    });
  };

  const handleChangeAvatar = useCallback(async () => {
    if (!isOwnProfile || !mentorId || avatarUploading) return;
    try {
      const picked = await pickProfileAvatar();
      if (!picked) return;
      setAvatarUploading(true);
      const url = await profileApi.uploadAvatar({
        userId: mentorId,
        base64: picked.base64,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
      });
      setMentor(prev => (
        prev
          ? { ...prev, profiles: { ...(prev.profiles || {}), avatar_url: url } }
          : prev
      ));
      await refreshProfile?.();
      await loadData(true);
      openAvatarPreview({
        uri: url,
        name: mentor?.profiles?.name || paramMentorName || 'Mentor',
        isOwnProfile: true,
        onChangePhoto: handleChangeAvatar,
      });
      Toast.show('Photo updated');
    } catch {
      Toast.show('Failed to update photo');
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, isOwnProfile, loadData, mentorId, refreshProfile, openAvatarPreview, mentor?.profiles?.name, paramMentorName]);

  const avatarUrl = mentor?.profiles?.avatar_url;
  const name = mentor?.profiles?.name || paramMentorName || 'Mentor';
  const username = mentor?.profiles?.username || null;
  const specialization = mentor?.specialization || 'Not specified';
  const bio = mentor?.bio || 'No bio provided yet.';
  const rating = mentor?.rating ?? 0;
  const totalSessions = mentor?.total_sessions ?? 0;
  const videoStat = videos.length;
  const unlockPrice = mentor?.unlock_price || 299;
  const showSubscribeCta = hasLockedVideos && !libraryUnlocked && !isOwnProfile;
  const heroCoverUri = (coverFromParams || mentor?.cover_image_url || '').trim() || null;

  const handleAvatarPress = useCallback(() => {
    if (isOwnProfile && !avatarUrl) {
      handleChangeAvatar();
      return;
    }
    if (avatarUrl || isOwnProfile) {
      openAvatarPreview({
        uri: avatarUrl,
        name,
        isOwnProfile,
        uploading: avatarUploading,
        onChangePhoto: isOwnProfile ? handleChangeAvatar : undefined,
      });
    }
  }, [avatarUrl, avatarUploading, handleChangeAvatar, isOwnProfile, name, openAvatarPreview]);

  if (!mentorId) {
    return (
      <SafeScreen scrollable={false} {...safeScreenProps}>
        <View style={[styles.root, styles.centerFill]}>
          <ActivityIndicator size="large" color={PURPLE_LINK} />
          <Text style={[styles.errTxt, { marginTop: T.spacing.md }]}>Loading profile…</Text>
        </View>
      </SafeScreen>
    );
  }

  if (loading && !mentor) {
    return (
      <SafeScreen scrollable={false} {...safeScreenProps}>
        <View style={[styles.root, styles.centerFill]}>
          <ActivityIndicator size="large" color={PURPLE_LINK} />
        </View>
      </SafeScreen>
    );
  }

  if (error && !mentor) {
    return (
      <SafeScreen scrollable={false} {...safeScreenProps}>
        <View style={[styles.root, styles.centerFill]}>
          <MaterialIcons name="error-outline" size={40} color={C.accent.error} />
          <Text style={styles.errTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(false)}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
          {!isOwnProfile && (
            <TouchableOpacity style={[styles.retryBtn, { marginTop: 8 }]} onPress={() => navigation.goBack()}>
              <Text style={styles.retryTxtMuted}>Go back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeScreen>
    );
  }

  return (
    <>
    <SafeScreen
      scrollable
      {...safeScreenProps}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          tintColor={PURPLE_LINK}
          colors={[PURPLE_LINK]}
          progressBackgroundColor={SCREEN_BG}
        />
      )}
    >
      <View style={[styles.root, isOwnProfile && styles.ownProfileScrollPad]}>
        <View style={styles.mainColumn}>
          <View style={[styles.hero, { height: compactHero, overflow: 'hidden' }]}>
            <HeroEntrance style={StyleSheet.absoluteFill}>
              {heroCoverUri ? (
                <ImageBackground
                  source={{ uri: heroCoverUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['rgba(5,5,16,0.02)', 'rgba(5,5,16,0.28)', 'rgba(5,5,16,0.78)']}
                    locations={[0, 0.42, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                </ImageBackground>
              ) : (
                <LinearGradient
                  colors={[C.primary.nebula, C.primary.dark, C.primary.void]}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </HeroEntrance>
            <View
              style={[
                styles.heroTopBar,
                {
                  paddingTop: (Platform.OS === 'ios' && !isOwnProfile ? insets.top : 0) + T.spacing.sm,
                },
              ]}
            >
              <View style={styles.heroBarActions}>
                {!isOwnProfile ? (
                  <PressableScale
                    onPress={() => navigation.goBack()}
                    scaleTo={0.9}
                    showGlow={false}
                    style={[
                      styles.heroCircleBtn,
                      isLightTheme && styles.heroCircleBtnLight,
                    ]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={22}
                      color={liveTheme.colors.text.primary}
                    />
                  </PressableScale>
                ) : (
                  <PressableScale
                    onPress={() => navigation.navigate(SCREEN_NAMES.EditProfile)}
                    scaleTo={0.9}
                    showGlow={false}
                    style={[
                      styles.heroCircleBtn,
                      isLightTheme && styles.heroCircleBtnLight,
                    ]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialIcons
                      name="edit"
                      size={20}
                      color={liveTheme.colors.text.primary}
                    />
                  </PressableScale>
                )}
                {!isOwnProfile ? (
                  <PressableScale
                    onPress={() => setShowReportSheet(true)}
                    scaleTo={0.9}
                    showGlow={false}
                    style={[
                      styles.heroCircleBtn,
                      isLightTheme && styles.heroCircleBtnLight,
                    ]}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialIcons
                      name="flag"
                      size={20}
                      color={liveTheme.colors.text.primary}
                    />
                  </PressableScale>
                ) : null}
              </View>
            </View>
          </View>

          {/* ── Identity Block ── */}
          <ProfileFadeIn delayIndex={1} style={styles.identityBlock}>
            <PressableScale onPress={handleAvatarPress} scaleTo={0.94} style={styles.avatarRingWrap}>
              <AvatarPulseRing>
                <CircularProfileImage
                  size={94}
                  ringWidth={3}
                  colors={avatarRingColors(liveTheme)}
                  innerBg={SCREEN_BG}
                  uri={avatarUrl}
                  previewName={name}
                  onPress={handleAvatarPress}
                  pressable={false}
                  style={Platform.select({ ios: T.shadows.medium, android: { elevation: 8 } })}
                  fallback={
                    <View style={[styles.avatarPlaceholder, styles.avatarFallbackLarge]}>
                      <MaterialIcons name="person" size={48} color={PURPLE_LINK} />
                    </View>
                  }
                />
              </AvatarPulseRing>
              <PulseOnlineDot />
              {isOwnProfile ? (
                <View style={styles.avatarCameraBadge}>
                  <MaterialIcons name="photo-camera" size={14} color={C.text.primary} />
                </View>
              ) : null}
            </PressableScale>

            {/* Name + specialization + verified */}
            <View style={styles.nameRow}>
              <Text style={[styles.heroName, { color: liveTheme.colors.text.primary }]}>{name}</Text>
              {(rating >= 4 || totalSessions >= 5) && (
                <MaterialIcons name="verified" size={18} color={VERIFIED_BLUE} />
              )}
            </View>
            {username ? (
              <Text style={[styles.usernameHandle, { color: liveTheme.colors.accent.primary }]}>@{username}</Text>
            ) : null}
            <Text style={[styles.titleGold, isLightTheme && { color: liveTheme.colors.accent.primary }]}>{specialization}</Text>

            {/* Bio */}
            <Text style={[styles.heroBio, { color: liveTheme.colors.text.secondary }]}>{bio}</Text>

            {/* Tags — plain text, no capsule chips */}
            {visibleTags.length > 0 && (
              <View style={styles.tagStrip}>
                {visibleTags.map((t, i) => (
                  <React.Fragment key={t}>
                    {i > 0 ? <Text style={styles.tagSep}>·</Text> : null}
                    <AnimatedTagChip label={t} />
                  </React.Fragment>
                ))}
                {tagOverflow > 0 ? (
                  <>
                    <Text style={styles.tagSep}>·</Text>
                    <AnimatedTagChip label={`+${tagOverflow}`} overflow />
                  </>
                ) : null}
              </View>
            )}
          </ProfileFadeIn>

          <View style={styles.bodyFlex}>
            <View style={styles.singleScreenBody}>
              <ProfileFadeIn delayIndex={2}>
                <MetricsStatRow
                  subscriberCount={subscriberCount}
                  rating={Number(rating) || 0}
                  videoCount={videoStat}
                  totalSessions={totalSessions}
                  onRatingPress={openReviews}
                />
              </ProfileFadeIn>

              <ProfileFadeIn delayIndex={3} style={styles.dualCtas}>
                {showSubscribeCta ? (
                  <CosmicButton
                    label={`Subscribe · ₹${unlockPrice}`}
                    variant="nebula"
                    size="compact"
                    icon="star"
                    onPress={() => setShowSubSheet(true)}
                    loading={unlocking}
                    numberOfLines={2}
                    style={styles.ctaHalf}
                  />
                ) : libraryUnlocked && hasLockedVideos && !isOwnProfile ? (
                  <CosmicButton
                    label="Subscribed"
                    variant="success"
                    size="compact"
                    icon="check-circle"
                    onPress={() => Toast.show('You are subscribed.', Toast.SHORT)}
                    numberOfLines={1}
                    style={styles.ctaHalf}
                  />
                ) : (
                  <CosmicButton
                    label={isOwnProfile ? 'Your channel' : 'Subscribe'}
                    variant="secondary"
                    size="compact"
                    icon="star"
                    onPress={() =>
                      Toast.show(
                        isOwnProfile ? 'This is your channel.' : 'Nothing to subscribe here.',
                        Toast.SHORT,
                      )
                    }
                    numberOfLines={1}
                    style={styles.ctaHalf}
                  />
                )}

                <CosmicButton
                  label="Book Session"
                  variant="premium"
                  size="compact"
                  icon="calendar-today"
                  onPress={goBook}
                  disabled={isOwnProfile}
                  numberOfLines={1}
                  style={[styles.ctaHalf, isOwnProfile && { opacity: 0.45 }]}
                />
              </ProfileFadeIn>

              {memberVideos.length > 0 && (
                <View style={styles.videoRailSection}>
                  <SectionHeaderRow title="Members Only" onSeeAll={seeAll} delayIndex={4} />
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.videoRailScroll}
                    contentContainerStyle={styles.hRailPad}
                  >
                    {memberVideos.map((v, idx) => {
                      const globIdx = videos.findIndex(x => x.id === v.id);
                      return (
                        <PortraitVideoCard
                          key={v.id}
                          video={v}
                          index={globIdx >= 0 ? globIdx : 0}
                          isUnlocked={libraryUnlocked}
                          isOwnChannel={isOwnProfile}
                          onPlay={handlePlayVideo}
                          locked={!libraryUnlocked}
                          cardWidth={compactRailW}
                          thumbAspect={0.82}
                          animDelay={Math.min(4 + idx, 9)}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {previewVideos.length > 0 && (
                <View style={styles.videoRailSection}>
                  <SectionHeaderRow title="Free Preview Videos" onSeeAll={seeAll} delayIndex={5} />
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.videoRailScroll}
                    contentContainerStyle={styles.hRailPad}
                  >
                    {previewVideos.map((v, idx) => {
                      const globIdx = videos.findIndex(x => x.id === v.id);
                      return (
                        <PortraitVideoCard
                          key={v.id}
                          video={v}
                          index={globIdx >= 0 ? globIdx : 0}
                          isUnlocked={libraryUnlocked}
                          isOwnChannel={isOwnProfile}
                          onPlay={handlePlayVideo}
                          locked={false}
                          cardWidth={compactRailW}
                          thumbAspect={0.82}
                          animDelay={Math.min(5 + idx, 10)}
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              )}


              {videos.length === 0 && (
                <View style={styles.emptyVideos}>
                  <MaterialIcons name="videocam-off" size={28} color={C.text.muted} />
                  <Text style={styles.emptyVideosTxt}>No videos published yet.</Text>
                </View>
              )}

              {libraryUnlocked && hasLockedVideos && !isOwnProfile && (
                <View style={styles.subNote}>
                  <MaterialIcons name="check-circle" size={14} color={C.accent.success} />
                  <Text style={styles.subNoteTxt}>Subscribed — watch all locked videos.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </SafeScreen>

      {/* ── Subscribe Bottom Sheet ── */}
      <Modal
        visible={showSubSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubSheet(false)}
      >
        <TouchableOpacity
          style={sheet.backdrop}
          activeOpacity={1}
          onPress={() => setShowSubSheet(false)}
        />
        <View style={sheet.container}>
          <View style={sheet.handle} />

          {/* Mentor row */}
          <View style={sheet.mentorRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={sheet.avatar} />
            ) : (
              <View style={[sheet.avatar, sheet.avatarFallback]}>
                <MaterialIcons name="person" size={22} color={C.accent.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={sheet.mentorName}>{name}</Text>
              <Text style={sheet.mentorSpec} numberOfLines={1}>{mentor?.specialization || ''}</Text>
            </View>
            <View style={sheet.pricePill}>
              <Text style={sheet.priceText}>₹{unlockPrice}/mo</Text>
            </View>
          </View>

          <View style={sheet.divider} />

          <Text style={sheet.title}>Subscribe to video library</Text>
          <Text style={sheet.sub}>Monthly subscription · Access all of {name}'s videos</Text>

          <View style={sheet.perks}>
            {['All current videos', 'All future uploads', 'Cancel anytime'].map(p => (
              <View key={p} style={sheet.perkRow}>
                <MaterialIcons name="check-circle" size={16} color={C.accent.success} />
                <Text style={sheet.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          <CosmicButton
            label={`Subscribe · ₹${unlockPrice}/mo`}
            variant="nebula"
            onPress={() => {
              setShowSubSheet(false);
              handleUnlock();
            }}
            loading={unlocking}
            disabled={unlocking}
            style={sheet.payBtn}
          />

          <CosmicButton
            label="Maybe later"
            variant="goldOutline"
            size="compact"
            onPress={() => setShowSubSheet(false)}
            style={sheet.cancelBtnWrap}
          />
        </View>
      </Modal>

      <ReportUserSheet
        visible={showReportSheet}
        reportedUserId={mentorId}
        reportedUserName={name}
        contextType="profile"
        contextId={mentorId}
        onClose={() => setShowReportSheet(false)}
      />

    </>
  );
}

function createMentorSheetStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  container: {
    backgroundColor: C.surface.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: C.border.light,
  },
  handle: { width: 40, height: 4, backgroundColor: C.border.default, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  mentorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: C.surface.accentViolet, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border.light },
  mentorName: { color: C.text.primary, fontSize: 15, fontWeight: '700' },
  mentorSpec: { color: C.text.muted, fontSize: 12, marginTop: 2 },
  pricePill: { backgroundColor: C.surface.accentTeal, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border.default },
  priceText: { color: C.accent.secondary, fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: C.border.light, marginBottom: 16 },
  title: { color: C.text.primary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  sub: { color: C.text.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  perks: { gap: 10, marginBottom: 24 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { color: C.text.secondary, fontSize: 13 },
  payBtn: { marginBottom: 8, marginVertical: 0 },
  cancelBtnWrap: { marginVertical: 0 },
});
}

function createMentorProfileStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  root: { backgroundColor: 'transparent' },
  ownProfileScrollPad: { paddingBottom: T.spacing.xxxl },
  mainColumn: {},
  bodyFlex: { width: '100%' },
  videoRailSection: { flexShrink: 0, marginTop: T.spacing.md, marginBottom: T.spacing.sm },
  videoRailScroll: { flexGrow: 0 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: T.spacing.xl, gap: T.spacing.md },
  errTxt: { color: C.text.secondary, fontSize: 15, textAlign: 'center', paddingHorizontal: T.spacing.lg },
  retryBtn: { marginTop: T.spacing.sm, paddingVertical: 10, paddingHorizontal: T.spacing.xl, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.2)' },
  retryTxt: { color: PURPLE_LINK, fontWeight: '800', fontSize: 14 },
  retryTxtMuted: { color: C.text.muted, fontWeight: '600', fontSize: 13 },
  hero: { width: SCREEN_W },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.md,
  },
  heroBarActions: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.sm },
  heroCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: 'rgba(12,12,40,0.55)',
    borderWidth: 1,
    borderColor: softBorder(theme),
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCircleBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(109,74,255,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(109,74,255,0.2)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  identityBlock: {
    marginTop: -48,
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.md,
    alignItems: 'flex-start',
  },
  avatarRingWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,14,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.45)',
  },
  avatarRingGrad: {
    padding: 3,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 8 } }),
  },
  avatarFallbackLarge: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SCREEN_BG,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: SCREEN_BG },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarOnlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: SCREEN_BG,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.md,
    marginBottom: 2,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  usernameHandle: {
    fontSize: 13,
    color: PURPLE_LINK,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  titleGold: {
    marginTop: 2,
    color: GOLD,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  heroBio: {
    marginTop: 8,
    color: C.text.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  tagStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: T.spacing.sm,
    paddingVertical: 0,
    gap: 0,
  },
  tagSep: {
    color: C.text.muted,
    fontSize: 11,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  tagTxt: {
    color: C.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  tagOverflowTxt: {
    color: PURPLE_LINK,
  },
  dualCtas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.spacing.sm,
    marginTop: T.spacing.md,
    marginBottom: T.spacing.md,
    paddingHorizontal: T.spacing.lg,
    alignItems: 'stretch',
  },
  ctaHalf: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '46%',
    minWidth: 148,
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  ctaHalfInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: T.spacing.sm,
    minHeight: 46,
  },
  ctaHalfInnerCompact: {
    paddingVertical: 13,
    paddingHorizontal: T.spacing.sm,
    minHeight: 46,
    gap: 6,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: T.spacing.sm,
    minHeight: 46,
    backgroundColor: TEAL_DEEP,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL,
  },
  bookBtnTxt: { color: TEAL, fontWeight: '800', fontSize: 12 },
  ctaHalfMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: T.spacing.sm,
    minHeight: 46,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: C.border.light,
    borderRadius: 12,
  },
  ctaHalfTxtDark: { color: '#0c1228', fontWeight: '800', fontSize: 12 },
  ctaHalfTxtMuted: { color: C.text.muted, fontWeight: '700', fontSize: 12 },
  singleScreenBody: {
    paddingTop: 2,
    paddingBottom: T.spacing.md,
  },
  hRailPad: {
    paddingLeft: T.spacing.lg,
    paddingRight: T.spacing.lg,
    paddingBottom: T.spacing.sm,
    paddingTop: 6,
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  pastSessionList: {
    paddingHorizontal: 0,
    gap: T.spacing.xs,
  },
  emptyVideos: {
    alignItems: 'center',
    paddingVertical: T.spacing.md,
    gap: T.spacing.xs,
  },
  emptyVideosTxt: { color: C.text.muted, fontSize: 12 },
  subNote: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: T.spacing.lg,
    marginTop: T.spacing.xs,
    alignItems: 'center',
  },
  subNoteTxt: { color: C.accent.success, fontSize: 12, fontWeight: '600' },
});
}
