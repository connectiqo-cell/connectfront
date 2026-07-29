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
import { isAppForegroundForMedia } from '../../utils/videoPlayback';

const WELCOME_VIDEO = require('../../assets/videos/welcome.mp4');
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
    const usableH = height - insets.top - insets.bottom;
    // Standard iPhones need the compact layout because the side-by-side hero
    // leaves substantially less horizontal room for the copy.
    const isCompact = usableH < 760 || width < 430;
    const isTall = usableH >= 760;
    const isXTall = usableH >= 820;
    const hPad = width < 375 ? 14 : 18;
    const scale = isCompact ? 0.94 : isXTall ? 1.1 : isTall ? 1.05 : 1;

    const videoW = Math.round(width * (isCompact ? 0.37 : 0.4));
    const videoH = Math.round(videoW * (isCompact ? 1.22 : 1.3));

    const creatorGap = 8;
    const visibleCards = 4;
    const rowWidth = width - hPad * 2;
    const creatorCardW = Math.floor((rowWidth - creatorGap * (visibleCards - 1)) / visibleCards);
    const creatorImageH = Math.round(creatorCardW * 0.88);

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
      creatorGap,
      sectionGap: isCompact ? 10 : isXTall ? 18 : 14,
      textGap: isCompact ? 6 : 9,
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
  const { isCompact } = metrics;

  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [appActive, setAppActive] = useState(
    isAppForegroundForMedia(AppState.currentState),
  );
  const [previewReady, setPreviewReady] = useState(false);
  /** User-controlled in-place playback (no fullscreen). Starts paused. */
  const [isPlaying, setIsPlaying] = useState(false);

  const heroO = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(18)).current;
  const ctaO = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(14)).current;
  const trendO = useRef(new Animated.Value(0)).current;
  const trendY = useRef(new Animated.Value(12)).current;
  const playPulse = useRef(new Animated.Value(1)).current;

  const videoPaused = !isPlaying || !isFocused || !appActive;

  const goSignup = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Signup);
  }, [navigation]);

  const goLogin = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Login);
  }, [navigation]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      setAppActive(isAppForegroundForMedia(next));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setPreviewReady(false);
      setIsPlaying(false);
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
    if (isPlaying) {
      playPulse.setValue(1);
      return undefined;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(playPulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(playPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isPlaying, playPulse]);

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
            </View>

            <View style={styles.videoCol}>
              <Pressable
                style={styles.videoFrame}
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause welcome video' : 'Play welcome video'}
              >
                {isFocused ? (
                  <Video
                    key="welcome-hero"
                    source={WELCOME_VIDEO}
                    style={styles.video}
                    resizeMode="contain"
                    repeat
                    paused={videoPaused}
                    controls={false}
                    shutterColor="transparent"
                    playInBackground={false}
                    playWhenInactive
                    ignoreSilentSwitch="ignore"
                    mixWithOthers="inherit"
                    // Android needs audio focus for sound, so disableFocus stays off.
                    muted={!isPlaying}
                    volume={isPlaying ? 1 : 0}
                    onLoad={() => setPreviewReady(true)}
                    onError={() => setPreviewReady(false)}
                  />
                ) : null}
                {!previewReady && <View style={styles.videoPlaceholder} />}

                {!isPlaying ? (
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.35)']}
                    style={styles.videoScrim}
                    pointerEvents="none"
                  />
                ) : null}

                {!isPlaying ? (
                  <View style={styles.playOverlay} pointerEvents="none">
                    <Animated.View style={{ transform: [{ scale: playPulse }] }}>
                      <View style={styles.playBtn}>
                        <MaterialIcons name="play-arrow" size={32} color={PURPLE_LINK} />
                      </View>
                    </Animated.View>
                  </View>
                ) : null}
              </Pressable>

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
                    : [0, 1, 2, 3].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.stackAvatar,
                            styles.stackAvatarPlaceholder,
                            { marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i },
                          ]}
                        >
                          <MaterialIcons name="person" size={10} color={C.text.muted} />
                        </View>
                      ))}
                </View>
                <View style={styles.floatingTextWrap}>
                  <Text style={styles.floatingTitle} numberOfLines={1}>
                    5K+ Happy Users
                  </Text>
                  <Text style={styles.floatingSub} numberOfLines={1}>
                    Successful Connections Made
                  </Text>
                </View>
                <View style={styles.heartWrap}>
                  <MaterialIcons name="favorite" size={12} color={PURPLE_LINK} />
                </View>
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
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <MaterialIcons name="groups" size={16} color={PURPLE_LINK} />
              </View>
              <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT}>
                10K+
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT}>
                Active Creators
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <MaterialIcons name="videocam" size={16} color={PURPLE_LINK} />
              </View>
              <Text style={styles.statValue} maxFontSizeMultiplier={MAX_FONT}>
                50K+
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT}>
                Sessions Booked
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <MaterialIcons name="person" size={16} color={PURPLE_LINK} />
              </View>
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
  const avatarRing = isLight ? '#fff' : C.surface.panel;
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
    creatorGap,
    sectionGap,
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
      shadowOpacity: isLight ? 0.08 : 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
  });

  return StyleSheet.create({
    background: { flex: 1 },
    overlay: { flex: 1 },
    screen: {
      flex: 1,
      paddingHorizontal: hPad,
      paddingTop: 2,
      paddingBottom: Platform.OS === 'ios' ? 6 : 10,
      justifyContent: 'space-between',
    },
    header: {
      paddingBottom: 4,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerLogo: {
      width: 26,
      height: 26,
    },
    headerBrand: {
      fontSize: fs(20),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.4,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    heroCopy: {
      ...iosFlexChild(),
      paddingTop: 2,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: S.accentViolet,
      marginBottom: textGap,
    },
    badgeText: {
      fontSize: fs(9),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: 0.5,
    },
    headline: {
      fontSize: fs(isCompact ? 21 : 24),
      fontWeight: '700',
      color: C.text.primary,
      lineHeight: fs(isCompact ? 27 : 30),
      marginBottom: textGap - 1,
    },
    headlineAccent: {
      fontSize: fs(isCompact ? 24 : 28),
      fontWeight: '800',
      color: PURPLE_LINK,
    },
    subtitle: {
      fontSize: fs(isCompact ? 11 : 12.5),
      color: C.text.secondary,
      lineHeight: fs(isCompact ? 16 : 18),
      marginBottom: textGap + 2,
    },
    chipsCol: {
      gap: 7,
      alignItems: 'flex-start',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    chipAccent: {
      backgroundColor: S.accentGold,
      borderColor: isLight ? 'rgba(245,158,11,0.25)' : 'rgba(240,216,117,0.25)',
    },
    chipText: {
      fontSize: fs(10.5),
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
      ...cardShadow,
    },
    video: {
      width: '100%',
      height: '100%',
    },
    videoPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: softFillStrong(theme),
    },
    videoScrim: {
      ...StyleSheet.absoluteFillObject,
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 8,
    },
    playBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: 2,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        },
        android: { elevation: 6 },
      }),
    },
    floatingCard: {
      position: 'absolute',
      left: -4,
      right: -4,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 8,
      paddingHorizontal: 9,
      borderRadius: 14,
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      zIndex: 2,
      ...cardShadow,
    },
    avatarStack: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stackAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
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
      fontSize: fs(7.5),
      color: C.text.muted,
      marginTop: 1,
    },
    heartWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: S.accentViolet,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaBlock: {
      width: '100%',
      paddingVertical: 2,
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
      marginTop: 8,
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
    },
    creatorCard: {
      width: creatorCardW,
      alignSelf: 'flex-start',
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...cardShadow,
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
      paddingHorizontal: 6,
      paddingTop: 6,
      paddingBottom: 7,
    },
    creatorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    creatorName: {
      ...iosFlexChild(),
      fontSize: fs(10),
      fontWeight: '800',
      color: C.text.primary,
    },
    creatorTitle: {
      fontSize: fs(8),
      color: C.text.muted,
      marginTop: 1,
      marginBottom: 3,
    },
    creatorMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginBottom: 3,
    },
    creatorRating: {
      fontSize: fs(8),
      fontWeight: '600',
      color: C.text.secondary,
    },
    creatorPrice: {
      fontSize: fs(10),
      fontWeight: '800',
      color: PURPLE_LINK,
      marginBottom: 5,
    },
    creatorPriceUnit: {
      fontSize: fs(7.5),
      fontWeight: '600',
      color: C.text.muted,
    },
    bookNowBtn: {
      backgroundColor: PURPLE_LINK,
      borderRadius: 8,
      paddingVertical: 5,
      alignItems: 'center',
    },
    bookNowText: {
      color: B.nebulaText,
      fontSize: fs(9),
      fontWeight: '800',
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
      alignItems: 'stretch',
      width: '100%',
      marginTop: 4,
      paddingVertical: isXTall ? 14 : isCompact ? 9 : 12,
      paddingHorizontal: 2,
      backgroundColor: isLight ? 'rgba(109, 74, 255, 0.06)' : S.accentViolet,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    statIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isLight ? 'rgba(109,74,255,0.1)' : 'rgba(167,139,250,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 1,
    },
    statValue: {
      fontSize: fs(14),
      fontWeight: '800',
      color: C.text.primary,
    },
    statLabel: {
      fontSize: fs(8.5),
      fontWeight: '600',
      color: C.text.muted,
      textAlign: 'center',
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: softBorder(theme),
      marginVertical: 8,
    },
  });
}
