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
  useWindowDimensions,
  Platform,
  AppState,
  Pressable,
  PixelRatio,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
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
import {
  CONTENT_VIDEO_AUDIO_PROPS,
  isAppForegroundForMedia,
} from '../../utils/videoPlayback';

const WELCOME_VIDEO = require('../../assets/videos/welcome.mp4');
/** welcome.mp4 is 400×368 — keep the card at the same ratio so cover fills edge-to-edge. */
const WELCOME_VIDEO_ASPECT = 400 / 368;
const VIDEO_RADIUS = 26;
const MAX_FONT = 1.12;

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

const WELCOME_HIGHLIGHTS = [
  { value: '20+', label: 'Skill Categories' },
  { value: '1:1', label: 'Video Sessions' },
  { value: 'Zero', label: 'Hidden Fees' },
  { value: '24/7', label: 'Booking Available' },
];

/** Approximate purple → coral value color from the marketing banner. */
const STAT_VALUE_COLOR = '#C026A8';

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

function useWelcomeMetrics() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const usableH = Math.max(480, height - insets.top - insets.bottom);
    const isNarrow = width < 360;
    const isSmall = width < 390;
    const isCompact = usableH < 740 || width < 420;
    const isShort = usableH < 640;
    const isTall = usableH >= 760;
    const isXTall = usableH >= 840;
    const hPad = isNarrow ? 12 : isSmall ? 14 : 18;
    const heroGap = isNarrow ? 8 : isSmall ? 10 : 12;

    // Typography scale from a 390×780 reference; clamp so tiny/huge phones stay readable.
    const widthScale = width / 390;
    const heightScale = usableH / 780;
    const scale = Math.min(
      1.1,
      Math.max(0.88, Math.min(widthScale, 1.05) * (isShort ? 0.94 : isCompact ? 0.97 : 1)),
    );

    // Video card: larger share of the hero, while leaving room for the headline.
    const copyMinW = Math.round(width * (isNarrow ? 0.42 : 0.44));
    const maxVideoFromWidth = width - hPad * 2 - heroGap - copyMinW;
    const targetVideoW = Math.round(
      width * (isNarrow ? 0.4 : isSmall ? 0.42 : isCompact ? 0.44 : 0.46),
    );
    let videoW = Math.min(maxVideoFromWidth, Math.max(isNarrow ? 136 : 148, targetVideoW));
    // Absolute caps for tablets / large phones.
    videoW = Math.min(videoW, Math.round(width * 0.48), 236);
    let videoH = Math.round(videoW / WELCOME_VIDEO_ASPECT);

    // Height budget: allow a taller hero, still leave room for CTA + creators + stats.
    const maxVideoH = Math.round(
      usableH * (isShort ? 0.24 : isCompact ? 0.28 : isXTall ? 0.34 : 0.3),
    );
    if (videoH > maxVideoH) {
      videoH = maxVideoH;
      videoW = Math.round(videoH * WELCOME_VIDEO_ASPECT);
      if (videoW < (isNarrow ? 128 : 140)) {
        videoW = isNarrow ? 128 : 140;
        videoH = Math.round(videoW / WELCOME_VIDEO_ASPECT);
      }
    }

    videoW = PixelRatio.roundToNearestPixel(videoW);
    videoH = PixelRatio.roundToNearestPixel(videoH);

    const creatorGap = isNarrow ? 6 : 8;
    const cardsPerView = width < 360 ? 3 : width < 400 ? 3 : 4;
    const rowWidth = width - hPad * 2;
    const creatorCardW = Math.floor(
      (rowWidth - creatorGap * (cardsPerView - 1)) / cardsPerView,
    );
    const creatorImageH = Math.round(creatorCardW * (isShort ? 0.78 : 0.88));
    const videoRadius = Math.max(14, Math.min(VIDEO_RADIUS, Math.round(videoW * 0.14)));
    const showChips = !isShort;

    return {
      width,
      usableH,
      isNarrow,
      isSmall,
      isCompact,
      isShort,
      isTall,
      isXTall,
      scale,
      hPad,
      heroGap,
      videoW,
      videoH,
      videoRadius,
      creatorCardW,
      creatorImageH,
      creatorGap,
      showChips,
      sectionGap: isShort ? 8 : isCompact ? 10 : isXTall ? 18 : 14,
      textGap: isShort ? 4 : isCompact ? 6 : 9,
    };
  }, [width, height, insets.top, insets.bottom]);
}

function CreatorSkeleton({ styles }) {
  return (
    <View style={styles.creatorCard}>
      <View style={[styles.creatorImage, styles.skeletonBone]} />
      <View style={styles.creatorBody}>
        <View style={[styles.skeletonLine, { width: '78%' }]} />
        <View style={[styles.skeletonLine, { width: '55%', marginTop: 6 }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
        <View style={[styles.skeletonBtn, styles.skeletonBone]} />
      </View>
    </View>
  );
}

export default function WelcomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const metrics = useWelcomeMetrics();
  const styles = useMemo(() => createThemedStyles(theme, metrics), [theme, metrics]);
  const brandLogo = getBrandLogo(isDark);
  const isFocused = useIsFocused();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const STAR = C.accent.warning;
  const { isCompact, showChips } = metrics;

  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [appActive, setAppActive] = useState(
    isAppForegroundForMedia(AppState.currentState),
  );
  const [previewReady, setPreviewReady] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [videoAttempt, setVideoAttempt] = useState(0);

  const heroO = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(18)).current;
  const ctaO = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(14)).current;
  const trendO = useRef(new Animated.Value(0)).current;
  const trendY = useRef(new Animated.Value(12)).current;
  const videoRef = useRef(null);

  /** Autoplay + loop while the welcome screen is visible. */
  const videoPaused = !isFocused || !appActive;

  /** A paused iOS player shows a blank surface until it renders a frame. */
  const onVideoLoad = useCallback(() => {
    setPreviewReady(true);
    setVideoError(null);
    videoRef.current?.seek?.(0);
  }, []);

  const onVideoError = useCallback(err => {
    const detail =
      err?.error?.errorString ||
      err?.error?.localizedDescription ||
      err?.error?.errorCode ||
      'Playback failed';
    console.warn('Welcome video error:', JSON.stringify(err));
    setPreviewReady(false);
    setVideoError(String(detail));
  }, []);

  const retryVideo = useCallback(() => {
    setVideoError(null);
    setPreviewReady(false);
    setVideoAttempt(n => n + 1);
  }, []);

  const goSignup = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Signup);
  }, [navigation]);

  const goLogin = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Login);
  }, [navigation]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setAppActive(isAppForegroundForMedia(next));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setPreviewReady(false);
    }
  }, [isFocused]);

  useEffect(() => {
    Animated.stagger(80, [
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
        activeOpacity={0.88}
        onPress={goSignup}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.creatorImage} />
        ) : (
          <LinearGradient
            colors={isDark ? ['#2a2450', '#1a1640'] : ['#ebe6ff', '#d9d0ff']}
            style={[styles.creatorImage, styles.creatorImagePlaceholder]}
          >
            <Text style={styles.creatorInitials}>
              {name
                .split(' ')
                .map(p => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </LinearGradient>
        )}
        <View style={styles.creatorBody}>
          <View style={styles.creatorNameRow}>
            <Text style={styles.creatorName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
              {name}
            </Text>
            <MaterialIcons name="verified" size={11} color={PURPLE_LINK} />
          </View>
          <Text style={styles.creatorTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
            {title}
          </Text>
          <View style={styles.creatorMeta}>
            <MaterialIcons name="star" size={10} color={STAR} />
            <Text style={styles.creatorRating} maxFontSizeMultiplier={MAX_FONT}>
              {rating.toFixed(1)}
              {sessions > 0 ? ` (${sessionsLabel})` : ''}
            </Text>
          </View>
          <Text style={styles.creatorPrice} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
            {formatCurrency(price)}
            <Text style={styles.creatorPriceUnit}> / session</Text>
          </Text>
          <TouchableOpacity style={styles.bookNowBtn} onPress={goSignup} activeOpacity={0.85}>
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
        <ScrollView
          style={styles.verticalScroll}
          contentContainerStyle={styles.verticalContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.screen}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={brandLogo} style={styles.headerLogo} resizeMode="contain" />
              <Text style={styles.headerBrand} maxFontSizeMultiplier={MAX_FONT}>
                Connectiqo
              </Text>
            </View>
          </View>

          <Animated.View
            style={[styles.heroRow, { opacity: heroO, transform: [{ translateY: heroY }] }]}
          >
            <View style={styles.heroCopy}>
              <View style={styles.badge}>
                <MaterialIcons name="bolt" size={12} color={PURPLE_LINK} />
                <Text style={styles.badgeText} maxFontSizeMultiplier={MAX_FONT}>
                  1-ON-1 LIVE MENTORSHIP
                </Text>
              </View>

              <Text
                style={styles.headline}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                maxFontSizeMultiplier={MAX_FONT}
              >
                Connect with{'\n'}
                <Text style={styles.headlineAccent}>Connectiqo</Text>
              </Text>

              <Text
                style={styles.subtitle}
                numberOfLines={isCompact ? 3 : 4}
                maxFontSizeMultiplier={MAX_FONT}
              >
                Meet top creators, mentors and experts in live 1-on-1 video sessions.
              </Text>

              {showChips ? (
                <View style={styles.chipsCol}>
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
              ) : null}
            </View>

            <View style={styles.videoCol}>
              <View style={styles.videoFrame}>
                {isFocused ? (
                  <Video
                    key={`welcome-hero-${videoAttempt}`}
                    ref={videoRef}
                    source={WELCOME_VIDEO}
                    style={styles.video}
                    resizeMode="cover"
                    repeat
                    paused={videoPaused}
                    controls={false}
                    shutterColor="transparent"
                    {...CONTENT_VIDEO_AUDIO_PROPS}
                    muted
                    volume={0}
                    onLoad={onVideoLoad}
                    onError={onVideoError}
                  />
                ) : null}
                {!previewReady && !videoError ? (
                  <View style={styles.videoPlaceholder} />
                ) : null}
                {videoError ? (
                  <Pressable
                    style={styles.videoErrorBox}
                    onPress={retryVideo}
                    accessibilityRole="button"
                    accessibilityLabel="Retry welcome video"
                  >
                    <MaterialIcons name="error-outline" size={22} color={PURPLE_LINK} />
                    <Text style={styles.videoErrorText} numberOfLines={2}>
                      Couldn’t load video
                    </Text>
                    <Text style={styles.videoErrorHint}>Tap to retry</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={[styles.ctaBlock, { opacity: ctaO, transform: [{ translateY: ctaY }] }]}
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
            <TouchableOpacity onPress={goLogin} activeOpacity={0.7} style={styles.signInRow}>
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </Animated.View>

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
              <ScrollView
                horizontal
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.creatorList}
              >
                {[0, 1, 2, 3].map(i => (
                  <CreatorSkeleton key={i} styles={styles} />
                ))}
              </ScrollView>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.creatorScroll}
                contentContainerStyle={styles.creatorList}
                nestedScrollEnabled
                directionalLockEnabled
                decelerationRate="fast"
                snapToInterval={metrics.creatorCardW + metrics.creatorGap}
                disableIntervalMomentum
              >
                {displayMentors.map(renderCreatorCard)}
              </ScrollView>
            )}
          </Animated.View>

          <View style={styles.statsContainer}>
            {WELCOME_HIGHLIGHTS.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 ? <View style={styles.statDivider} /> : null}
                <View style={styles.statItem}>
                  <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT} numberOfLines={1}>
                    {item.value}
                  </Text>
                  <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT} numberOfLines={2}>
                    {item.label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          </View>
        </ScrollView>
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
  const {
    isNarrow,
    isCompact,
    isShort,
    isTall,
    isXTall,
    scale,
    hPad,
    heroGap,
    videoW,
    videoH,
    videoRadius,
    creatorCardW,
    creatorImageH,
    creatorGap,
    textGap,
  } = metrics;

  const fs = n => Math.round(n * scale);
  const btnH = Math.min(
    Math.round(PLATFORM_LAYOUT.buttonMinHeight * (isTall ? 1.06 : 1)),
    isCompact ? 48 : isXTall ? 54 : 50,
  );

  const cardShadow = Platform.select({
    ios: {
      shadowColor: '#1a1642',
      shadowOpacity: isLight ? 0.1 : 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 4 },
  });

  const softShadow = Platform.select({
    ios: {
      shadowColor: '#1a1642',
      shadowOpacity: isLight ? 0.06 : 0.28,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 2 },
  });

  return StyleSheet.create({
    background: { flex: 1 },
    overlay: { flex: 1 },
    verticalScroll: {
      flex: 1,
    },
    verticalContent: {
      flexGrow: 1,
    },
    screen: {
      flexGrow: 1,
      minHeight: metrics.usableH,
      paddingHorizontal: hPad,
      paddingTop: Platform.OS === 'android' ? 6 : 4,
      paddingBottom: Platform.OS === 'ios' ? 8 : 14,
      justifyContent: 'space-between',
      gap: isShort ? 6 : 8,
    },
    header: {
      paddingBottom: 2,
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
      fontSize: fs(20),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.5,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: heroGap,
      marginBottom: 4,
    },
    heroCopy: {
      ...iosFlexChild(),
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: 0,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: isShort ? 4 : 5,
      paddingHorizontal: isNarrow ? 9 : 11,
      borderRadius: 999,
      backgroundColor: isLight ? 'rgba(109,74,255,0.1)' : S.accentViolet,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isLight ? 'rgba(109,74,255,0.18)' : 'rgba(167,139,250,0.28)',
      marginBottom: textGap + 1,
      maxWidth: '100%',
    },
    badgeText: {
      fontSize: fs(isNarrow ? 8 : 9),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: 0.6,
      flexShrink: 1,
    },
    headline: {
      fontSize: fs(isShort ? 20 : isCompact ? 22 : 25),
      fontWeight: '700',
      color: C.text.primary,
      lineHeight: fs(isShort ? 25 : isCompact ? 28 : 31),
      letterSpacing: -0.5,
      marginBottom: textGap,
    },
    headlineAccent: {
      fontSize: fs(isShort ? 22 : isCompact ? 25 : 29),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: fs(isShort ? 11 : isCompact ? 12 : 13),
      color: C.text.secondary,
      lineHeight: fs(isShort ? 16 : isCompact ? 17 : 19),
      marginBottom: textGap + 3,
      letterSpacing: 0.1,
    },
    chipsCol: {
      gap: 8,
      alignItems: 'flex-start',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: isLight ? '#FFFFFF' : softFill(theme),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    chipAccent: {
      backgroundColor: S.accentGold,
      borderColor: isLight ? 'rgba(245,158,11,0.28)' : 'rgba(240,216,117,0.28)',
    },
    chipText: {
      fontSize: fs(11),
      color: C.text.primary,
      fontWeight: '700',
    },
    videoCol: {
      width: videoW,
      flexShrink: 0,
      alignSelf: 'center',
    },
    videoFrame: {
      width: videoW,
      height: videoH,
      borderRadius: videoRadius,
      overflow: 'hidden',
      backgroundColor: '#0b0a14',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isLight ? 'rgba(109,74,255,0.12)' : 'rgba(255,255,255,0.08)',
      ...cardShadow,
    },
    video: {
      ...StyleSheet.absoluteFillObject,
    },
    videoPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: softFillStrong(theme),
    },
    videoErrorBox: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      backgroundColor: softFillStrong(theme),
    },
    videoErrorText: {
      fontSize: fs(10),
      color: C.text.secondary,
      textAlign: 'center',
    },
    videoErrorHint: {
      fontSize: fs(10),
      fontWeight: '700',
      color: PURPLE_LINK,
    },
    ctaBlock: {
      width: '100%',
      paddingTop: 2,
      paddingBottom: 2,
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
      marginTop: 10,
      paddingVertical: 4,
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
      marginTop: 2,
    },
    trendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    trendingTitle: {
      fontSize: fs(16),
      fontWeight: '800',
      color: C.text.primary,
      letterSpacing: -0.2,
    },
    viewAll: {
      fontSize: fs(12.5),
      fontWeight: '700',
      color: PURPLE_LINK,
    },
    creatorScroll: {
      flexGrow: 0,
    },
    creatorList: {
      gap: creatorGap,
      alignItems: 'flex-start',
      paddingVertical: 2,
    },
    creatorCard: {
      width: creatorCardW,
      alignSelf: 'flex-start',
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    creatorImage: {
      width: '100%',
      height: creatorImageH,
      backgroundColor: softFillStrong(theme),
    },
    creatorImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    creatorInitials: {
      fontSize: fs(17),
      fontWeight: '800',
      color: PURPLE_LINK,
    },
    creatorBody: {
      paddingHorizontal: 7,
      paddingTop: 7,
      paddingBottom: 8,
    },
    creatorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    creatorName: {
      ...iosFlexChild(),
      fontSize: fs(10.5),
      fontWeight: '800',
      color: C.text.primary,
    },
    creatorTitle: {
      fontSize: fs(8.5),
      color: C.text.muted,
      marginTop: 2,
      marginBottom: 4,
    },
    creatorMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: 4,
    },
    creatorRating: {
      fontSize: fs(8.5),
      fontWeight: '600',
      color: C.text.secondary,
    },
    creatorPrice: {
      fontSize: fs(10.5),
      fontWeight: '800',
      color: PURPLE_LINK,
      marginBottom: 6,
    },
    creatorPriceUnit: {
      fontSize: fs(7.5),
      fontWeight: '600',
      color: C.text.muted,
    },
    bookNowBtn: {
      backgroundColor: PURPLE_LINK,
      borderRadius: 9,
      paddingVertical: 6,
      alignItems: 'center',
    },
    bookNowText: {
      color: B.nebulaText,
      fontSize: fs(9.5),
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    skeletonBone: {
      backgroundColor: softFillStrong(theme),
    },
    skeletonLine: {
      height: 7,
      borderRadius: 4,
      backgroundColor: softFillStrong(theme),
    },
    skeletonBtn: {
      marginTop: 8,
      height: 22,
      borderRadius: 7,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      marginTop: 4,
      paddingVertical: isXTall ? 16 : isShort ? 10 : isCompact ? 12 : 14,
      paddingHorizontal: isNarrow ? 4 : 6,
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 2,
      minWidth: 0,
    },
    statValue: {
      fontSize: fs(isNarrow ? 15 : isCompact ? 16 : 18),
      fontWeight: '800',
      color: STAT_VALUE_COLOR,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: fs(isNarrow ? 8 : 9),
      fontWeight: '500',
      color: C.text.muted,
      textAlign: 'center',
      lineHeight: fs(isNarrow ? 11 : 12),
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: isLight ? 'rgba(15,23,42,0.12)' : softBorder(theme),
      marginVertical: 4,
    },
  });
}
