import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  useWindowDimensions,
  Platform,
  AppState,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { useTheme } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { PLATFORM_LAYOUT, iosFlexChild } from '../../utils/platformLayout';
import { getBrandLogo } from '../../utils/brandLogo';
import { formatCurrency } from '../../utils/formatCurrency';
import { mentorApi } from '../../api/mentorApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const WELCOME_VIDEO = require('../../assets/videos/welcome.mp4');
const VIDEO_RADIUS = 22;
/** Keep Dynamic Type from blowing up the fixed (no-scroll) layout on iPhone. */
const MAX_FONT = 1.15;

/** Guest teaser cards when API has no public mentors yet. */
const SHOWCASE_CREATORS = [
  {
    id: 'showcase-1',
    specialization: 'Entrepreneur & Creator',
    rating: 4.9,
    total_sessions: 2100,
    price_per_hour: 499,
    profiles: { name: 'Ankur Warikoo', avatar_url: null },
  },
  {
    id: 'showcase-2',
    specialization: 'Content Creator',
    rating: 4.8,
    total_sessions: 1800,
    price_per_hour: 399,
    profiles: { name: 'Prajakta Koli', avatar_url: null },
  },
  {
    id: 'showcase-3',
    specialization: 'AI Researcher',
    rating: 5.0,
    total_sessions: 950,
    price_per_hour: 999,
    profiles: { name: 'Andrej Karpathy', avatar_url: null },
  },
  {
    id: 'showcase-4',
    specialization: 'Fitness Coach',
    rating: 4.7,
    total_sessions: 1200,
    price_per_hour: 349,
    profiles: { name: 'Yogini Melania', avatar_url: null },
  },
];

const ENTRANCE = {
  duration: 420,
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

function useWelcomeMetrics() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const usableH = height - insets.top - insets.bottom;
    const isCompact = usableH < 700 || width < 375;
    const isTall = usableH >= 760;
    const isXTall = usableH >= 820;
    const hPad = width < 375 ? 14 : isTall ? 20 : 16;

    // Scale content up on taller phones via fonts/spacing (not card stretch).
    const scale = isCompact ? 0.92 : isXTall ? 1.18 : isTall ? 1.1 : 1;

    const videoW = Math.round(
      width * (isCompact ? 0.36 : isTall ? 0.42 : width >= 414 ? 0.4 : 0.38),
    );
    const videoH = Math.round(videoW * (isCompact ? 1.15 : isTall ? 1.3 : 1.22));
    const creatorCardW = Math.round((isCompact ? 112 : isTall ? 140 : 128) * (isXTall ? 1.04 : 1));
    const creatorImageH = Math.round((isCompact ? 78 : isTall ? 112 : 92) * (isXTall ? 1.05 : 1));

    return {
      width,
      usableH,
      isCompact,
      isTall,
      isXTall,
      scale,
      hPad,
      videoW,
      videoH,
      creatorCardW,
      creatorImageH,
      sectionGap: isCompact ? 10 : isXTall ? 22 : isTall ? 18 : 14,
      textGap: isCompact ? 6 : isXTall ? 12 : isTall ? 10 : 8,
    };
  }, [width, height, insets.top, insets.bottom]);
}

export default function WelcomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const metrics = useWelcomeMetrics();
  const styles = useMemo(
    () => createThemedStyles(theme, metrics),
    [theme, metrics],
  );
  const brandLogo = getBrandLogo(isDark);
  const isFocused = useIsFocused();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const STAR = C.accent.warning;
  const VERIFIED = C.accent.info;
  const { isCompact } = metrics;

  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [videoReady, setVideoReady] = useState(false);

  const heroO = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(16)).current;
  const ctaO = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(14)).current;
  const trendO = useRef(new Animated.Value(0)).current;
  const trendY = useRef(new Animated.Value(12)).current;

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
    Animated.stagger(70, [
      runFadeSlide(heroO, heroY, 0),
      runFadeSlide(ctaO, ctaY, 0),
      runFadeSlide(trendO, trendY, 0),
    ]).start();
  }, [heroO, heroY, ctaO, ctaY, trendO, trendY]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await mentorApi.getTopMentors(8);
        if (!cancelled) setMentors(Array.isArray(data) ? data : []);
      } catch (error) {
        // Common cause: RLS blocks anon SELECT on mentor_profiles / profiles.
        if (__DEV__) {
          console.warn('[Welcome] getTopMentors failed:', error?.message || error);
        }
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
    .slice(0, 4);

  const displayMentors = mentors.length > 0 ? mentors : SHOWCASE_CREATORS;

  const renderCreatorCard = mentor => {
    const name = mentor.profiles?.name || 'Mentor';
    const avatar = mentor.profiles?.avatar_url;
    const title = mentor.specialization || 'Creator';
    const rating = Number(mentor.rating) || 0;
    const sessions = mentor.total_sessions || 0;
    const price = mentor.price_per_hour;
    const sessionsLabel =
      sessions >= 1000 ? `${(sessions / 1000).toFixed(1)}k` : String(sessions);

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
            <Text style={styles.creatorInitials}>
              {name
                .split(' ')
                .map(p => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.creatorBody}>
          <View style={styles.creatorNameRow}>
            <Text style={styles.creatorName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
              {name}
            </Text>
            <MaterialIcons name="verified" size={12} color={VERIFIED} />
          </View>
          <Text style={styles.creatorTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
            {title}
          </Text>
          <View style={styles.creatorMeta}>
            <MaterialIcons name="star" size={11} color={STAR} />
            <Text style={styles.creatorRating} maxFontSizeMultiplier={MAX_FONT}>
              {rating.toFixed(1)}
              {sessions > 0 ? ` (${sessionsLabel})` : ''}
            </Text>
          </View>
          <Text style={styles.creatorPrice} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
            {formatCurrency(price)}
            <Text style={styles.creatorPriceUnit}> / session</Text>
          </Text>
          <TouchableOpacity
            style={styles.bookNowBtn}
            onPress={goSignup}
            activeOpacity={0.85}
          >
            <Text style={styles.bookNowText} maxFontSizeMultiplier={MAX_FONT}>
              Book Now
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.screen}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={brandLogo} style={styles.headerLogo} resizeMode="contain" />
              <Text style={styles.headerBrand} maxFontSizeMultiplier={MAX_FONT}>
                Connectiqo
              </Text>
            </View>
          </View>

          {/* Hero: text left + video right */}
          <Animated.View
            style={[
              styles.heroRow,
              { opacity: heroO, transform: [{ translateY: heroY }] },
            ]}
          >
            <View style={styles.heroCopy}>
              <View style={styles.badge}>
                <MaterialIcons name="bolt" size={12} color={PURPLE_LINK} />
                <Text style={styles.badgeText} maxFontSizeMultiplier={MAX_FONT}>
                  1-ON-1 LIVE MENTORSHIP
                </Text>
              </View>

              <Text style={styles.headline} maxFontSizeMultiplier={MAX_FONT}>
                Connect with{'\n'}
                <Text style={styles.headlineAccent}>Connectiqo</Text>
              </Text>

              <Text
                style={styles.subtitle}
                numberOfLines={isCompact ? 3 : 4}
                maxFontSizeMultiplier={MAX_FONT}
              >
                Join 1-on-1 video sessions with top creators, mentors & experts.
                Learn, grow and achieve together.
              </Text>

              <View style={styles.chipsRow}>
                <View style={[styles.chip, styles.chipAccent]}>
                  <MaterialIcons name="bolt" size={12} color={GOLD} />
                  <Text style={styles.chipText} maxFontSizeMultiplier={MAX_FONT}>
                    Live sessions
                  </Text>
                </View>
                <View style={styles.chip}>
                  <MaterialIcons name="verified" size={12} color={TEAL} />
                  <Text style={styles.chipText} maxFontSizeMultiplier={MAX_FONT}>
                    Trusted mentors
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.videoCol}>
              <View style={styles.videoFrame}>
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
                            { marginLeft: index === 0 ? 0 : -8, zIndex: 4 - index },
                          ]}
                        />
                      ))
                    : [0, 1, 2].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.stackAvatar,
                            styles.stackAvatarPlaceholder,
                            { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i },
                          ]}
                        >
                          <MaterialIcons name="person" size={11} color={C.text.muted} />
                        </View>
                      ))}
                </View>
                <View style={styles.floatingTextWrap}>
                  <Text style={styles.floatingTitle} numberOfLines={1}>
                    5K+ Happy Users
                  </Text>
                  <Text style={styles.floatingSub} numberOfLines={1}>
                    Successful Connections
                  </Text>
                </View>
                <MaterialIcons name="favorite" size={13} color={PURPLE_LINK} />
              </View>
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

          {/* Trending — compact cards only (never stretch height) */}
          <Animated.View
            style={[
              styles.trendingSection,
              { opacity: trendO, transform: [{ translateY: trendY }] },
            ]}
          >
            <View style={styles.trendingHeader}>
              <Text style={styles.trendingTitle} maxFontSizeMultiplier={MAX_FONT}>
                Trending Creators 🔥
              </Text>
              <TouchableOpacity onPress={goSignup} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.viewAll} maxFontSizeMultiplier={MAX_FONT}>
                  View all ›
                </Text>
              </TouchableOpacity>
            </View>

            {mentorsLoading ? (
              <View style={styles.trendingLoading}>
                <ActivityIndicator color={PURPLE_LINK} size="small" />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.creatorScroll}
                contentContainerStyle={styles.creatorList}
                nestedScrollEnabled
                directionalLockEnabled
                decelerationRate="fast"
              >
                {displayMentors.map(renderCreatorCard)}
              </ScrollView>
            )}
          </Animated.View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <MaterialIcons name="groups" size={16} color={PURPLE_LINK} />
              <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT}>
                10K+
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT}>
                Active Creators
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="videocam" size={16} color={PURPLE_LINK} />
              <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT}>
                50K+
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT}>
                Sessions Booked
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="favorite" size={16} color={PURPLE_LINK} />
              <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT}>
                100K+
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT}>
                Happy Users
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

function createThemedStyles(theme, metrics) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const isLight = T.mode === 'light';
  const panelFill = cardFill(theme);
  const avatarRing = isLight ? C.component.card : C.surface.panel;
  const {
    isCompact,
    isTall,
    isXTall,
    scale,
    hPad,
    videoW,
    videoH,
    creatorCardW,
    creatorImageH,
    sectionGap,
    textGap,
  } = metrics;

  const fs = (n) => Math.round(n * scale);
  const btnH = Math.min(
    Math.round(PLATFORM_LAYOUT.buttonMinHeight * (isTall ? 1.08 : 1)),
    isCompact ? (Platform.OS === 'ios' ? 48 : 46) : isXTall ? 56 : Platform.OS === 'ios' ? 52 : 50,
  );

  return StyleSheet.create({
    background: { flex: 1 },
    overlay: { flex: 1 },
    screen: {
      flex: 1,
      paddingHorizontal: hPad,
      paddingTop: isTall ? 6 : 2,
      paddingBottom: Platform.OS === 'ios' ? 6 : 10,
      justifyContent: 'space-between',
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 2 : 4,
      paddingBottom: sectionGap * 0.35,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerLogo: {
      width: isTall ? 28 : 24,
      height: isTall ? 28 : 24,
    },
    headerBrand: {
      fontSize: fs(Platform.OS === 'ios' ? 20 : 19),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.3,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: isTall ? 12 : 10,
      marginBottom: sectionGap * 0.2,
    },
    heroCopy: {
      ...iosFlexChild(),
      paddingTop: 2,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: isTall ? 5 : 4,
      paddingHorizontal: isTall ? 10 : 8,
      borderRadius: 999,
      backgroundColor: S.accentViolet,
      borderWidth: 1,
      borderColor: softBorder(theme),
      marginBottom: textGap,
    },
    badgeText: {
      fontSize: fs(9),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: 0.45,
    },
    headline: {
      fontSize: fs(isCompact ? 20 : 23),
      fontWeight: '700',
      color: C.text.primary,
      lineHeight: fs(isCompact ? 26 : 30),
      marginBottom: textGap,
    },
    headlineAccent: {
      fontSize: fs(isCompact ? 23 : 27),
      fontWeight: '800',
      color: PURPLE_LINK,
    },
    subtitle: {
      fontSize: fs(isCompact ? 11 : 13),
      color: C.text.secondary,
      lineHeight: fs(isCompact ? 16 : 19),
      marginBottom: textGap + 2,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: isTall ? 5 : 4,
      paddingHorizontal: isTall ? 9 : 8,
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
      fontSize: fs(10),
      color: C.text.primary,
      fontWeight: '700',
    },
    videoCol: {
      width: videoW,
      paddingBottom: 20,
    },
    videoFrame: {
      width: videoW,
      height: videoH,
      borderRadius: VIDEO_RADIUS,
      overflow: 'hidden',
      backgroundColor: softFillStrong(theme),
      ...(Platform.OS === 'ios' ? { shadowColor: 'transparent' } : null),
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
    floatingCard: {
      position: 'absolute',
      left: -4,
      right: -4,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: isTall ? 8 : 6,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: panelFill,
      borderWidth: 1,
      borderColor: softBorder(theme),
      zIndex: 2,
      ...Platform.select({
        ios: T.shadows.small || T.shadows.medium,
        android: { elevation: 4 },
      }),
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stackAvatar: {
      width: isTall ? 22 : 20,
      height: isTall ? 22 : 20,
      borderRadius: isTall ? 11 : 10,
      borderWidth: 1.5,
      borderColor: avatarRing,
    },
    stackAvatarPlaceholder: {
      backgroundColor: softFill(theme),
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    floatingTitle: {
      fontSize: fs(10),
      fontWeight: '800',
      color: C.text.primary,
    },
    floatingSub: {
      fontSize: fs(8),
      color: C.text.muted,
      marginTop: 1,
    },
    ctaBlock: {
      width: '100%',
      paddingVertical: sectionGap * 0.25,
    },
    welcomeButton: {
      marginVertical: 0,
      height: btnH,
      borderRadius: Math.ceil(btnH / 2),
      overflow: 'hidden',
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: isTall ? 10 : 8,
      paddingVertical: 2,
    },
    signInMuted: {
      fontSize: fs(13),
      color: C.text.muted,
    },
    signInLink: {
      fontSize: fs(13),
      color: PURPLE_LINK,
      fontWeight: '700',
    },
    trendingSection: {
      flexGrow: 0,
      flexShrink: 0,
      paddingTop: sectionGap * 0.2,
    },
    trendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isTall ? 12 : 8,
    },
    trendingTitle: {
      fontSize: fs(16),
      fontWeight: '800',
      color: C.text.primary,
    },
    viewAll: {
      fontSize: fs(13),
      fontWeight: '700',
      color: PURPLE_LINK,
    },
    trendingLoading: {
      height: creatorImageH + 110,
      justifyContent: 'center',
      alignItems: 'center',
    },
    creatorScroll: {
      flexGrow: 0,
    },
    creatorList: {
      paddingRight: 4,
      gap: isTall ? 12 : 10,
      alignItems: 'flex-start',
    },
    creatorCard: {
      width: creatorCardW,
      alignSelf: 'flex-start',
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: panelFill,
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    creatorImage: {
      width: '100%',
      height: creatorImageH,
      backgroundColor: softFillStrong(theme),
    },
    creatorImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: S.accentViolet,
    },
    creatorInitials: {
      fontSize: fs(24),
      fontWeight: '800',
      color: PURPLE_LINK,
    },
    creatorBody: {
      padding: isTall ? 10 : 8,
    },
    creatorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    creatorName: {
      ...iosFlexChild(),
      fontSize: fs(12),
      fontWeight: '800',
      color: C.text.primary,
    },
    creatorTitle: {
      fontSize: fs(10),
      color: C.text.muted,
      marginTop: 2,
      marginBottom: 5,
    },
    creatorMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginBottom: 4,
    },
    creatorRating: {
      fontSize: fs(10),
      fontWeight: '600',
      color: C.text.secondary,
    },
    creatorPrice: {
      fontSize: fs(12),
      fontWeight: '800',
      color: PURPLE_LINK,
      marginBottom: isTall ? 8 : 6,
    },
    creatorPriceUnit: {
      fontSize: fs(10),
      fontWeight: '600',
      color: C.text.muted,
    },
    bookNowBtn: {
      backgroundColor: PURPLE_LINK,
      borderRadius: 8,
      paddingVertical: isTall ? 7 : 5,
      alignItems: 'center',
    },
    bookNowText: {
      color: B.nebulaText,
      fontSize: fs(11),
      fontWeight: '800',
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
      marginTop: sectionGap * 0.35,
      paddingVertical: isXTall ? 16 : isTall ? 14 : isCompact ? 8 : 11,
      paddingHorizontal: 4,
      backgroundColor: S.accentViolet,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    statValue: {
      fontSize: fs(15),
      fontWeight: '800',
      color: C.text.primary,
      marginTop: 2,
    },
    statLabel: {
      fontSize: fs(9),
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
