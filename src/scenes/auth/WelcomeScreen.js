import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  AppState,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { PLATFORM_LAYOUT, iosFlexChild } from '../../utils/platformLayout';
import { getBrandLogo } from '../../utils/brandLogo';
import { formatCurrency } from '../../utils/formatCurrency';
import { mentorApi } from '../../api/mentorApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const WELCOME_VIDEO = require('../../assets/videos/welcome.mp4');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = Math.min(320, SCREEN_WIDTH * 0.92);
const CREATOR_CARD_WIDTH = 148;
const VIDEO_RADIUS = Platform.OS === 'ios' ? 28 : 28;

const ENTRANCE = {
  duration: 480,
  easing: Easing.out(Easing.cubic),
};

function runFadeSlide(opacity, translateY, delay = 0) {
  return Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      delay,
      duration: ENTRANCE.duration,
      easing: ENTRANCE.easing,
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      delay,
      duration: ENTRANCE.duration,
      easing: ENTRANCE.easing,
      useNativeDriver: true,
    }),
  ]);
}

export default function WelcomeScreen({ navigation }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme, isDark } = useTheme();
  const brandLogo = getBrandLogo(isDark);
  const isFocused = useIsFocused();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const STAR = C.accent.warning;
  const VERIFIED = C.accent.info;

  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [videoReady, setVideoReady] = useState(false);

  const heroO = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(22)).current;
  const videoO = useRef(new Animated.Value(0)).current;
  const videoY = useRef(new Animated.Value(28)).current;
  const ctaO = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(24)).current;
  const trendO = useRef(new Animated.Value(0)).current;
  const trendY = useRef(new Animated.Value(20)).current;

  // iOS: pause when unfocused OR app backgrounded so AVPlayer releases cleanly.
  const shouldPlay = isFocused && appActive;
  const videoPaused = !shouldPlay;

  const goSignup = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Signup);
  }, [navigation]);

  const goLogin = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Login);
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      setAppActive(nextState === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isFocused) setVideoReady(false);
  }, [isFocused]);

  useEffect(() => {
    Animated.stagger(90, [
      runFadeSlide(heroO, heroY, 0),
      runFadeSlide(videoO, videoY, 0),
      runFadeSlide(ctaO, ctaY, 0),
      runFadeSlide(trendO, trendY, 0),
    ]).start();
  }, [heroO, heroY, videoO, videoY, ctaO, ctaY, trendO, trendY]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await mentorApi.getTopMentors(8);
        if (!cancelled) setMentors(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMentors([]);
      } finally {
        if (!cancelled) setMentorsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarStack = mentors
    .map(m => m?.profiles?.avatar_url)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={brandLogo} style={styles.headerLogo} resizeMode="contain" />
              <Text style={styles.headerBrand}>Connectiqo</Text>
            </View>
          </View>

          {/* Hero copy */}
          <Animated.View
            style={[
              styles.heroCopy,
              { opacity: heroO, transform: [{ translateY: heroY }] },
            ]}
          >
            <View style={styles.badge}>
              <MaterialIcons name="bolt" size={14} color={PURPLE_LINK} />
              <Text style={styles.badgeText}>1-ON-1 LIVE MENTORSHIP</Text>
            </View>

            <Text style={styles.headline}>
              Connect with{' '}
              <Text style={styles.headlineAccent}>Connectiqo</Text>
            </Text>

            <Text style={styles.subtitle}>
              Join 1-on-1 video sessions with top creators, mentors & experts.
              Learn, grow and achieve together.
            </Text>

            <View style={styles.chipsRow}>
              <View style={[styles.chip, styles.chipAccent]}>
                <MaterialIcons name="bolt" size={14} color={GOLD} />
                <Text style={styles.chipText}>Live sessions</Text>
              </View>
              <View style={styles.chip}>
                <MaterialIcons name="verified" size={14} color={TEAL} />
                <Text style={styles.chipText}>Trusted mentors</Text>
              </View>
            </View>
          </Animated.View>

          {/* Looping hero video */}
          <Animated.View
            style={[
              styles.videoSection,
              { opacity: videoO, transform: [{ translateY: videoY }] },
            ]}
          >
            <View style={styles.videoFrame}>
              {/*
                Mount only when focused so iOS tears down AVPlayer on navigate away.
                borderRadius on Video itself — parent overflow:hidden does not clip AVPlayerLayer.
              */}
              {isFocused ? (
                <Video
                  key="welcome-hero-video"
                  source={WELCOME_VIDEO}
                  style={styles.video}
                  resizeMode="cover"
                  repeat
                  muted
                  volume={0}
                  paused={videoPaused}
                  controls={false}
                  playInBackground={false}
                  playWhenInactive={false}
                  preventsDisplaySleepDuringVideoPlayback={false}
                  ignoreSilentSwitch="ignore"
                  mixWithOthers="mix"
                  shutterColor="transparent"
                  onLoad={() => setVideoReady(true)}
                  onError={() => setVideoReady(false)}
                  {...(Platform.OS === 'android' ? { disableFocus: true } : null)}
                />
              ) : null}
              {!videoReady && <View style={styles.videoPlaceholder} />}
              <View style={styles.playHint} pointerEvents="none">
                <View style={styles.playHintCircle}>
                  <MaterialIcons name="play-arrow" size={28} color="#fff" />
                </View>
              </View>
            </View>

            <View style={styles.floatingCard}>
              <View style={styles.avatarStack}>
                {avatarStack.length > 0
                  ? avatarStack.map((uri, index) => (
                      <Image
                        key={`${uri}-${index}`}
                        source={{ uri }}
                        style={[
                          styles.stackAvatar,
                          { marginLeft: index === 0 ? 0 : -10, zIndex: 3 - index },
                        ]}
                      />
                    ))
                  : [0, 1, 2].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.stackAvatar,
                          styles.stackAvatarPlaceholder,
                          { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i },
                        ]}
                      >
                        <MaterialIcons name="person" size={14} color={C.text.muted} />
                      </View>
                    ))}
              </View>
              <View style={styles.floatingTextWrap}>
                <Text style={styles.floatingTitle}>5K+ Happy Users</Text>
                <Text style={styles.floatingSub}>Successful Connections Made</Text>
              </View>
              <MaterialIcons name="favorite" size={16} color={PURPLE_LINK} />
            </View>
          </Animated.View>

          {/* CTA */}
          <Animated.View
            style={[
              styles.ctaBlock,
              { opacity: ctaO, transform: [{ translateY: ctaY }] },
            ]}
          >
            <CosmicButton
              label="Get started"
              variant="nebula"
              icon="arrow-forward"
              onPress={goSignup}
              pressScale
              pill
              style={styles.welcomeButton}
            />
            <TouchableOpacity
              onPress={goLogin}
              activeOpacity={0.7}
              style={styles.signInRow}
            >
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Trending creators (guest teaser → Signup) */}
          <Animated.View
            style={[
              styles.trendingSection,
              { opacity: trendO, transform: [{ translateY: trendY }] },
            ]}
          >
            <View style={styles.trendingHeader}>
              <Text style={styles.trendingTitle}>Trending Creators 🔥</Text>
              <TouchableOpacity onPress={goSignup} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.viewAll}>View all ›</Text>
              </TouchableOpacity>
            </View>

            {mentorsLoading ? (
              <View style={styles.trendingLoading}>
                <ActivityIndicator color={PURPLE_LINK} />
              </View>
            ) : mentors.length === 0 ? (
              <Text style={styles.trendingEmpty}>
                Creators will appear here — tap Get started to explore.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.creatorList}
                nestedScrollEnabled
                directionalLockEnabled
                decelerationRate="fast"
              >
                {mentors.map(mentor => {
                  const name = mentor.profiles?.name || 'Mentor';
                  const avatar = mentor.profiles?.avatar_url;
                  const title = mentor.specialization || 'Creator';
                  const rating = Number(mentor.rating) || 0;
                  const sessions = mentor.total_sessions || 0;
                  const price = mentor.price_per_hour;

                  return (
                    <TouchableOpacity
                      key={mentor.id}
                      style={styles.creatorCard}
                      activeOpacity={0.85}
                      onPress={goSignup}
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.creatorImage} />
                      ) : (
                        <View style={[styles.creatorImage, styles.creatorImagePlaceholder]}>
                          <MaterialIcons name="person" size={36} color={C.text.muted} />
                        </View>
                      )}
                      <View style={styles.creatorBody}>
                        <View style={styles.creatorNameRow}>
                          <Text style={styles.creatorName} numberOfLines={1}>
                            {name}
                          </Text>
                          <MaterialIcons name="verified" size={14} color={VERIFIED} />
                        </View>
                        <Text style={styles.creatorTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <View style={styles.creatorMeta}>
                          <MaterialIcons name="star" size={13} color={STAR} />
                          <Text style={styles.creatorRating}>
                            {rating.toFixed(1)}
                            {sessions > 0 ? ` (${sessions})` : ''}
                          </Text>
                        </View>
                        <Text style={styles.creatorPrice}>
                          {formatCurrency(price)} / session
                        </Text>
                        <TouchableOpacity
                          style={styles.bookNowBtn}
                          onPress={goSignup}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.bookNowText}>Book Now</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>

          {/* Platform stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <MaterialIcons name="groups" size={18} color={PURPLE_LINK} />
              <Text style={styles.statValue}>10K+</Text>
              <Text style={styles.statLabel}>Active Creators</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="videocam" size={18} color={PURPLE_LINK} />
              <Text style={styles.statValue}>50K+</Text>
              <Text style={styles.statLabel}>Sessions Booked</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="person" size={18} color={PURPLE_LINK} />
              <Text style={styles.statValue}>100K+</Text>
              <Text style={styles.statLabel}>Happy Users</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const isLight = T.mode === 'light';
  const panelFill = cardFill(theme);
  const avatarRing = isLight ? C.component.card : C.surface.panel;

  return StyleSheet.create({
    background: {
      flex: 1,
    },
    overlay: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: T.spacing.lg,
      paddingBottom: T.spacing.xl,
    },
    header: {
      paddingTop: T.spacing.sm,
      paddingBottom: T.spacing.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerLogo: {
      width: 28,
      height: 28,
    },
    headerBrand: {
      fontSize: 20,
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.3,
    },
    heroCopy: {
      marginBottom: T.spacing.md,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: S.accentViolet,
      borderWidth: 1,
      borderColor: softBorder(theme),
      marginBottom: T.spacing.md,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: 0.6,
    },
    headline: {
      fontSize: 28,
      fontWeight: '700',
      color: C.text.primary,
      lineHeight: 36,
      marginBottom: T.spacing.sm,
    },
    headlineAccent: {
      fontSize: 32,
      fontWeight: '800',
      color: PURPLE_LINK,
    },
    subtitle: {
      fontSize: 14,
      color: C.text.secondary,
      lineHeight: 22,
      marginBottom: T.spacing.md,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: T.spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: T.spacing.sm,
      borderRadius: T.borderRadius.chip,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    chipAccent: {
      backgroundColor: S.accentGold,
      borderColor: isLight ? C.border.default : 'rgba(240,216,117,0.25)',
    },
    chipText: {
      fontSize: 11,
      color: C.text.primary,
      fontWeight: '700',
    },
    videoSection: {
      marginTop: T.spacing.lg,
      marginBottom: T.spacing.xl + 8,
    },
    videoFrame: {
      width: '100%',
      height: VIDEO_HEIGHT,
      borderRadius: VIDEO_RADIUS,
      overflow: 'hidden',
      backgroundColor: softFillStrong(theme),
      ...(Platform.OS === 'ios'
        ? { shadowColor: 'transparent' }
        : null),
    },
    video: {
      width: '100%',
      height: '100%',
      borderRadius: VIDEO_RADIUS,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    videoPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: softFillStrong(theme),
      borderRadius: VIDEO_RADIUS,
    },
    playHint: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 28,
    },
    playHintCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      // Over media (not theme chrome) — light glass reads on both modes.
      backgroundColor: 'rgba(255,255,255,0.28)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingCard: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: -22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: panelFill,
      borderWidth: 1,
      borderColor: softBorder(theme),
      zIndex: 2,
      ...Platform.select({
        ios: T.shadows.medium,
        android: { elevation: 6 },
      }),
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stackAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: avatarRing,
    },
    stackAvatarPlaceholder: {
      backgroundColor: softFill(theme),
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingTextWrap: {
      flex: 1,
    },
    floatingTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: C.text.primary,
    },
    floatingSub: {
      fontSize: 10,
      color: C.text.muted,
      marginTop: 1,
    },
    ctaBlock: {
      width: '100%',
      marginTop: T.spacing.sm,
      marginBottom: T.spacing.lg,
    },
    welcomeButton: {
      marginVertical: 0,
      height: PLATFORM_LAYOUT.buttonMinHeight,
      borderRadius: Math.ceil(PLATFORM_LAYOUT.buttonMinHeight / 2),
      overflow: 'hidden',
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: T.spacing.md,
      paddingVertical: T.spacing.xs,
    },
    signInMuted: {
      fontSize: 14,
      color: C.text.muted,
    },
    signInLink: {
      fontSize: 14,
      color: PURPLE_LINK,
      fontWeight: '700',
    },
    trendingSection: {
      marginBottom: T.spacing.lg,
    },
    trendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: T.spacing.md,
    },
    trendingTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: C.text.primary,
    },
    viewAll: {
      fontSize: 13,
      fontWeight: '700',
      color: PURPLE_LINK,
    },
    trendingLoading: {
      height: 180,
      justifyContent: 'center',
      alignItems: 'center',
    },
    trendingEmpty: {
      fontSize: 13,
      color: C.text.muted,
      lineHeight: 20,
    },
    creatorList: {
      paddingRight: T.spacing.sm,
      gap: 12,
    },
    creatorCard: {
      width: CREATOR_CARD_WIDTH,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: panelFill,
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    creatorImage: {
      width: '100%',
      height: 110,
      backgroundColor: softFillStrong(theme),
    },
    creatorImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    creatorBody: {
      padding: 10,
    },
    creatorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    creatorName: {
      ...iosFlexChild(),
      fontSize: 13,
      fontWeight: '800',
      color: C.text.primary,
    },
    creatorTitle: {
      fontSize: 10,
      color: C.text.muted,
      marginTop: 2,
      marginBottom: 6,
    },
    creatorMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 4,
    },
    creatorRating: {
      fontSize: 11,
      fontWeight: '600',
      color: C.text.secondary,
    },
    creatorPrice: {
      fontSize: 12,
      fontWeight: '800',
      color: C.text.primary,
      marginBottom: 8,
    },
    bookNowBtn: {
      backgroundColor: PURPLE_LINK,
      borderRadius: 8,
      paddingVertical: 7,
      alignItems: 'center',
    },
    bookNowText: {
      color: B.nebulaText,
      fontSize: 11,
      fontWeight: '800',
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
      paddingVertical: 14,
      paddingHorizontal: 6,
      backgroundColor: S.accentViolet,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
      marginBottom: T.spacing.md,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '800',
      color: C.text.primary,
      marginTop: 2,
    },
    statLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: C.text.muted,
      textAlign: 'center',
    },
    statDivider: {
      width: 1,
      backgroundColor: softBorder(theme),
      marginVertical: 4,
    },
  });
}
