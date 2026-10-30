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
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { useTheme } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { PLATFORM_LAYOUT, iosFlexChild } from '../../utils/platformLayout';
import { getBrandLogo } from '../../utils/brandLogo';
import { formatCurrency } from '../../utils/formatCurrency';
import { mentorApi } from '../../api/mentorApi';
import { collabHubApi } from '../../api/collabHubApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const HERO_IMAGE = require('../../assets/images/hero-bg.jpg');
const HERO_CALL_IMAGE = require('../../assets/images/call-mentor.jpg');
const HERO_RADIUS = 26;
const HERO_DARK = '#0f0b24';
const MAX_FONT = 1.12;

const SHOWCASE_CREATORS = [
  {
    id: 'showcase-1',
    specialization: 'Entrepreneur',
    rating: 4.9,
    price_per_hour: 499,
    profiles: { name: 'Ankur Warikoo', avatar_url: null },
  },
  {
    id: 'showcase-2',
    specialization: 'Lifestyle',
    rating: 4.8,
    price_per_hour: 399,
    profiles: { name: 'Prajakta Koli', avatar_url: null },
  },
  {
    id: 'showcase-3',
    specialization: 'Beauty',
    rating: 5.0,
    price_per_hour: 999,
    profiles: { name: 'Tanuja Prasad', avatar_url: null },
  },
  {
    id: 'showcase-4',
    specialization: 'Travel',
    rating: 4.7,
    price_per_hour: 349,
    profiles: { name: 'Pratibha Shah', avatar_url: null },
  },
  {
    id: 'showcase-5',
    specialization: 'Comedy',
    rating: 4.8,
    price_per_hour: 299,
    profiles: { name: 'Arunvati Rao', avatar_url: null },
  },
  {
    id: 'showcase-6',
    specialization: 'Fitness',
    rating: 4.9,
    price_per_hour: 449,
    profiles: { name: 'Sneha Chopra', avatar_url: null },
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
    const usableH = Math.max(480, height - insets.top - insets.bottom);
    const isNarrow = width < 360;
    const isSmall = width < 390;
    const isCompact = usableH < 740 || width < 420;
    const isShort = usableH < 640;
    const isTall = usableH >= 760;
    const isXTall = usableH >= 840;
    const hPad = isNarrow ? 12 : isSmall ? 14 : 18;

    // Typography scale from a 390×780 reference; clamp so tiny/huge phones stay readable.
    const scale = Math.min(
      1.1,
      Math.max(0.88, Math.min(width / 390, 1.05) * (isShort ? 0.94 : isCompact ? 0.97 : 1)),
    );

    // Full-bleed hero with the headline sitting on top of it.
    const heroW = width - hPad * 2;
    const heroRadius = Math.max(16, Math.min(HERO_RADIUS, Math.round(heroW * 0.07)));

    const listGap = isNarrow ? 8 : 10;
    const collabCardW = Math.round(Math.min(168, Math.max(130, width * 0.38)));
    const collabImageH = Math.round((collabCardW * 9) / 16);
    const avatarSize = Math.round(Math.min(56, (width - hPad * 2 - listGap * 4) / 5.2));

    return {
      width,
      usableH,
      isNarrow,
      isCompact,
      isShort,
      isTall,
      isXTall,
      scale,
      hPad,
      heroRadius,
      listGap,
      collabCardW,
      collabImageH,
      avatarSize,
      sectionGap: isShort ? 10 : isCompact ? 14 : 18,
    };
  }, [width, height, insets.top, insets.bottom]);
}

const initialsOf = (name) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** "Pratibha Shah" → "Pratibha S." so names fit under a small avatar. */
const shortName = (name) => {
  const [first, second] = name.split(' ');
  return second ? `${first} ${second[0]}.` : first;
};

export default function WelcomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const metrics = useWelcomeMetrics();
  const styles = useMemo(() => createThemedStyles(theme, metrics), [theme, metrics]);
  const brandLogo = getBrandLogo(isDark);
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;

  const [mentors, setMentors] = useState([]);
  const [collabs, setCollabs] = useState([]);
  const [collabsLoading, setCollabsLoading] = useState(true);
  const heroO = useRef(new Animated.Value(0)).current;
  const heroY = useRef(new Animated.Value(18)).current;
  const ctaO = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(14)).current;
  const trendO = useRef(new Animated.Value(0)).current;
  const trendY = useRef(new Animated.Value(12)).current;
  const goSignup = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Signup);
  }, [navigation]);

  const goLogin = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Login);
  }, [navigation]);

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
        const data = await mentorApi.getTrendingMentors(8);
        if (!cancelled && Array.isArray(data)) setMentors(data);
      } catch (error) {
        if (__DEV__) {
          console.warn('[Welcome] getTrendingMentors failed:', error?.message || error);
        }
      }
    })();
    // Campaigns may not be readable before sign-in; the section says so.
    (async () => {
      try {
        const data = await collabHubApi.getPublishedCampaigns({ limit: 6 });
        if (!cancelled && Array.isArray(data)) {
          setCollabs(
            data.map(c => ({
              id: c.id,
              brand: c.brand?.name || 'Brand',
              brandAvatar: c.brand?.avatar_url,
              cover: c.cover_image_url,
              title: c.title,
              category: c.category,
              format: c.video_duration_seconds ? `${c.video_duration_seconds}s video` : null,
              budget: c.budget_per_winner,
            })),
          );
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[Welcome] getPublishedCampaigns failed:', error?.message || error);
        }
      } finally {
        if (!cancelled) setCollabsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayMentors = mentors.length > 0 ? mentors : SHOWCASE_CREATORS;

  const renderCollabCard = item => (
    <TouchableOpacity
      key={item.id}
      style={styles.collabCard}
      activeOpacity={0.88}
      onPress={goSignup}
    >
      <View style={styles.collabCover}>
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={styles.collabCoverImage} resizeMode="contain" />
        ) : (
          <LinearGradient
            colors={isDark ? ['#2a2450', '#1a1640'] : ['#ebe6ff', '#d9d0ff']}
            style={styles.collabCoverImage}
          />
        )}
      </View>

      <View style={styles.collabBody}>
        <View style={styles.collabBrandRow}>
          {item.brandAvatar ? (
            <Image source={{ uri: item.brandAvatar }} style={styles.collabBrandLogo} />
          ) : null}
          <Text style={styles.collabBrandName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
            {item.brand}
          </Text>
        </View>
        {item.category ? (
          <View style={styles.collabTag}>
            <Text style={styles.collabTagText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
              {item.category}
            </Text>
          </View>
        ) : null}
        <Text style={styles.collabTitle} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT}>
          {item.title}
        </Text>
        <Text style={styles.collabPrice} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
          {formatCurrency(item.budget)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderCreatorAvatar = mentor => {
    const name = mentor.profiles?.name || 'Creator';
    const avatar = mentor.profiles?.avatar_url;
    return (
      <TouchableOpacity
        key={mentor.id}
        style={styles.creatorCell}
        activeOpacity={0.85}
        onPress={goSignup}
      >
        <View style={styles.creatorRing}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.creatorAvatar} />
          ) : (
            <View style={[styles.creatorAvatar, styles.creatorAvatarFallback]}>
              <Text style={styles.creatorInitials} maxFontSizeMultiplier={MAX_FONT}>
                {initialsOf(name)}
              </Text>
            </View>
          )}
          <View style={styles.creatorVerified}>
            <MaterialIcons name="verified" size={12} color={PURPLE_LINK} />
          </View>
        </View>
        <Text style={styles.creatorName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT}>
          {shortName(name)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFaceStack = items => (
    <View style={styles.faceStack}>
      {items.slice(0, 3).map((m, i) => (
        <View key={m.id} style={[styles.faceCircle, i > 0 && styles.faceCircleOverlap]}>
          {m.profiles?.avatar_url ? (
            <Image source={{ uri: m.profiles.avatar_url }} style={styles.faceImage} />
          ) : (
            <Text style={styles.faceInitials} maxFontSizeMultiplier={MAX_FONT}>
              {initialsOf(m.profiles?.name || 'C')}
            </Text>
          )}
        </View>
      ))}
      <View style={[styles.faceCircle, styles.faceCircleOverlap, styles.facePlus]}>
        <MaterialIcons name="add" size={14} color={C.text.secondary} />
      </View>
    </View>
  );

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.verticalScroll}
          contentContainerStyle={styles.screen}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
        >
            <View style={styles.header}>
              <Image source={brandLogo} style={styles.headerLogo} resizeMode="contain" />
              <View style={iosFlexChild()}>
                <Text style={styles.headerBrand} maxFontSizeMultiplier={MAX_FONT}>
                  Connectiqo
                </Text>
              </View>
            </View>

            <Animated.View
              style={[styles.hero, { opacity: heroO, transform: [{ translateY: heroY }] }]}
            >
              <View style={styles.heroMedia}>
                <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(15,11,36,0)', 'rgba(15,11,36,0.45)', 'rgba(15,11,36,0.93)']}
                  locations={[0.35, 0.72, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.heroCallCard}>
                  <Image source={HERO_CALL_IMAGE} style={styles.heroCallImage} resizeMode="cover" />
                  <View style={styles.heroCallBadge}>
                    <View style={styles.heroCallDot} />
                    <Text style={styles.heroCallBadgeText} maxFontSizeMultiplier={MAX_FONT}>
                      LIVE
                    </Text>
                  </View>
                  <View style={styles.heroCallControls}>
                    <View style={[styles.heroCallBtn, styles.heroCallBtnEnd]}>
                      <MaterialIcons name="call-end" size={9} color="#fff" />
                    </View>
                    <View style={styles.heroCallBtn}>
                      <MaterialIcons name="mic" size={9} color="#fff" />
                    </View>
                  </View>
                </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroHeadline} maxFontSizeMultiplier={MAX_FONT}>
                  Connect{'\n'}
                  <Text style={styles.heroHeadlineAccent}>Create</Text>
                  {'\n'}Collab
                </Text>
                <Text style={styles.heroSub} maxFontSizeMultiplier={MAX_FONT}>
                  Brand collabs and live 1-on-1 sessions, in one app.
                </Text>
              </View>
              </View>

            </Animated.View>

            <Animated.View
              style={[styles.ctaBlock, { opacity: ctaO, transform: [{ translateY: ctaY }] }]}
            >
              <CosmicButton
                label="Get Started"
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

            <View style={styles.pathRow}>
              <TouchableOpacity
                style={[styles.pathCard, styles.pathCardCollab]}
                activeOpacity={0.88}
                onPress={goSignup}
              >
                <LinearGradient
                  colors={B.premiumGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.pathHeadRow}>
                  <View style={[styles.pathIcon, styles.pathIconOnDark]}>
                    <MaterialIcons name="work-outline" size={18} color="#fff" />
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.8)" />
                </View>
                <Text style={styles.pathTitleOnDark} maxFontSizeMultiplier={MAX_FONT}>
                  Collab Hub
                </Text>
                <Text style={styles.pathCopyOnDark} maxFontSizeMultiplier={MAX_FONT}>
                  Discover and apply for paid brand collaborations
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pathCard} activeOpacity={0.88} onPress={goSignup}>
                <View style={styles.pathHeadRow}>
                  <View style={[styles.pathIcon, { backgroundColor: GOLD }]}>
                    <MaterialIcons name="videocam" size={18} color="#1a1642" />
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={C.text.muted} />
                </View>
                <Text style={styles.pathTitle} maxFontSizeMultiplier={MAX_FONT}>
                  1-on-1 Sessions
                </Text>
                <Text style={styles.pathCopy} maxFontSizeMultiplier={MAX_FONT}>
                  Host live video sessions with your audience
                </Text>
                {renderFaceStack(displayMentors)}
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[styles.section, { opacity: trendO, transform: [{ translateY: trendY }] }]}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT}>
                  Trending Brand Collabs 🔥
                </Text>
                {collabs.length > 0 ? (
                  <TouchableOpacity onPress={goSignup} activeOpacity={0.7} hitSlop={8}>
                    <Text style={styles.viewAll} maxFontSizeMultiplier={MAX_FONT}>
                      View all ›
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {collabsLoading ? (
                <View style={styles.hListContent}>
                  {[0, 1].map(i => (
                    <View key={i} style={styles.collabCard}>
                      <View style={[styles.collabCover, styles.skeletonBone]} />
                      <View style={styles.collabBody}>
                        <View style={[styles.skeletonLine, { width: '50%' }]} />
                        <View style={[styles.skeletonLine, { width: '80%' }]} />
                        <View style={[styles.skeletonBtn, styles.skeletonBone]} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : collabs.length === 0 ? (
                // No live campaign yet — say so instead of inventing brands.
                <TouchableOpacity
                  style={styles.collabEmpty}
                  activeOpacity={0.88}
                  onPress={goSignup}
                >
                  <View style={styles.collabEmptyIcon}>
                    <MaterialIcons name="campaign" size={20} color={PURPLE_LINK} />
                  </View>
                  <View style={iosFlexChild()}>
                    <Text style={styles.collabEmptyTitle} maxFontSizeMultiplier={MAX_FONT}>
                      New brand collabs drop here
                    </Text>
                    <Text style={styles.collabEmptyCopy} maxFontSizeMultiplier={MAX_FONT}>
                      Create your account to get notified the moment a brief opens.
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={C.text.muted} />
                </TouchableOpacity>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.hList}
                  contentContainerStyle={styles.hListContent}
                  nestedScrollEnabled
                  directionalLockEnabled
                  decelerationRate="fast"
                  snapToInterval={metrics.collabCardW + metrics.listGap}
                  disableIntervalMomentum
                >
                  {collabs.map(renderCollabCard)}
                </ScrollView>
              )}
            </Animated.View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT}>
                  Trending Creators 🔥
                </Text>
                <TouchableOpacity onPress={goSignup} activeOpacity={0.7} hitSlop={8}>
                  <Text style={styles.viewAll} maxFontSizeMultiplier={MAX_FONT}>
                    View all ›
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hList}
                contentContainerStyle={styles.hListContent}
                nestedScrollEnabled
                directionalLockEnabled
              >
                {displayMentors.map(renderCreatorAvatar)}
              </ScrollView>
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
    heroRadius,
    listGap,
    collabCardW,
    collabImageH,
    avatarSize,
    sectionGap,
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
    verticalScroll: { flex: 1 },
    screen: {
      flexGrow: 1,
      paddingHorizontal: hPad,
      paddingTop: Platform.OS === 'android' ? 6 : 4,
      paddingBottom: Platform.OS === 'ios' ? 12 : 18,
      gap: sectionGap,
    },

    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerLogo: { width: 30, height: 30 },
    headerBrand: {
      fontSize: fs(21),
      fontWeight: '800',
      color: PURPLE_LINK,
      letterSpacing: -0.5,
    },

    hero: {
      borderRadius: heroRadius,
      overflow: 'hidden',
      backgroundColor: HERO_DARK,
      ...cardShadow,
    },
    heroMedia: {
      width: '100%',
      aspectRatio: 1364 / 853,
      backgroundColor: HERO_DARK,
    },
    heroImage: { width: '100%', height: '100%' },
    heroCallCard: {
      position: 'absolute',
      right: 12,
      top: 12,
      width: '19%',
      aspectRatio: 3 / 4,
      maxHeight: '58%',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.92)',
      backgroundColor: '#0b0a14',
      ...cardShadow,
    },
    heroCallImage: { width: '100%', height: '100%' },
    heroCallBadge: {
      position: 'absolute',
      left: 5,
      top: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(8,6,24,0.66)',
    },
    heroCallDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ff4d4f' },
    heroCallBadgeText: {
      fontSize: fs(7),
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.6,
    },
    heroCallControls: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 5,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    heroCallBtn: {
      width: 17,
      height: 17,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    heroCallBtnEnd: { backgroundColor: '#ef4444' },
    heroCopy: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: isNarrow ? 16 : 20,
      paddingTop: 18,
      paddingBottom: isShort ? 12 : 16,
    },
    heroHeadline: {
      fontSize: fs(isShort ? 26 : isCompact ? 29 : 33),
      lineHeight: fs(isShort ? 29 : isCompact ? 32 : 36),
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -1.1,
    },
    heroHeadlineAccent: { color: '#a78bfa' },
    heroSub: {
      marginTop: 8,
      fontSize: fs(12.5),
      lineHeight: fs(17),
      fontWeight: '600',
      color: 'rgba(255,255,255,0.78)',
    },

    ctaBlock: { width: '100%' },
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
    signInMuted: { fontSize: fs(13), color: C.text.muted },
    signInLink: { fontSize: fs(13), color: PURPLE_LINK, fontWeight: '700' },

    pathRow: { flexDirection: 'row', gap: listGap },
    pathCard: {
      ...iosFlexChild(),
      flex: 1,
      minWidth: 0,
      borderRadius: 16,
      padding: isNarrow ? 10 : 12,
      gap: 4,
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    pathCardCollab: { backgroundColor: PURPLE_LINK, borderColor: 'transparent', overflow: 'hidden' },
    pathHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pathIcon: {
      width: 30,
      height: 30,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pathIconOnDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
    pathTitle: { fontSize: fs(14), fontWeight: '800', color: C.text.primary },
    pathTitleOnDark: { fontSize: fs(14), fontWeight: '800', color: '#FFFFFF' },
    pathCopy: { fontSize: fs(10.5), lineHeight: fs(14), color: C.text.muted },
    pathCopyOnDark: { fontSize: fs(10.5), lineHeight: fs(14), color: 'rgba(255,255,255,0.86)' },

    faceStack: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    faceCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: softFillStrong(theme),
      borderWidth: 1.5,
      borderColor: isLight ? '#FFFFFF' : panelFill,
    },
    faceCircleOverlap: { marginLeft: -8 },
    faceImage: { width: '100%', height: '100%' },
    faceInitials: { fontSize: fs(9), fontWeight: '800', color: PURPLE_LINK },
    facePlus: { backgroundColor: softFill(theme) },

    section: { gap: 8 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      fontSize: fs(16),
      fontWeight: '800',
      color: C.text.primary,
      letterSpacing: -0.2,
    },
    viewAll: { fontSize: fs(12.5), fontWeight: '700', color: PURPLE_LINK },
    hList: { flexGrow: 0 },
    hListContent: { gap: listGap, alignItems: 'flex-start', paddingVertical: 2 },

    collabCard: {
      width: collabCardW,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    collabCover: { width: '100%', height: collabImageH, justifyContent: 'flex-end' },
    collabCoverImage: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isLight ? '#F3F0FF' : softFillStrong(theme),
    },
    collabBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    collabBrandLogo: { width: 14, height: 14, borderRadius: 7 },
    collabBrandName: {
      ...iosFlexChild(),
      fontSize: fs(9.5),
      fontWeight: '800',
      color: C.text.primary,
    },
    collabBody: { paddingHorizontal: 9, paddingTop: 6, paddingBottom: 8, gap: 3 },
    collabTag: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: softFill(theme),
      maxWidth: '100%',
    },
    collabTagText: { fontSize: fs(8.5), fontWeight: '700', color: C.text.secondary },
    collabTitle: { fontSize: fs(11.5), lineHeight: fs(15), fontWeight: '800', color: C.text.primary },
    collabPrice: { fontSize: fs(13), fontWeight: '900', color: PURPLE_LINK },

    collabEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      padding: 14,
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
      ...softShadow,
    },
    collabEmptyIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(theme),
    },
    collabEmptyTitle: { fontSize: fs(13), fontWeight: '800', color: C.text.primary },
    collabEmptyCopy: {
      fontSize: fs(10.5),
      lineHeight: fs(14),
      color: C.text.muted,
      marginTop: 2,
    },
    skeletonBone: { backgroundColor: softFillStrong(theme) },
    skeletonLine: {
      height: 8,
      borderRadius: 4,
      backgroundColor: softFillStrong(theme),
    },
    skeletonBtn: { marginTop: 4, height: 24, borderRadius: 10 },

    creatorCell: { width: avatarSize, alignItems: 'center', gap: 3 },
    creatorRing: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      padding: 2,
      borderWidth: 2,
      borderColor: PURPLE_LINK,
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
    },
    creatorAvatar: {
      width: '100%',
      height: '100%',
      borderRadius: avatarSize / 2,
      backgroundColor: softFillStrong(theme),
    },
    creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    creatorInitials: { fontSize: fs(15), fontWeight: '800', color: PURPLE_LINK },
    creatorVerified: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isLight ? '#FFFFFF' : panelFill,
    },
    creatorName: {
      fontSize: fs(10.5),
      fontWeight: '800',
      color: C.text.primary,
      textAlign: 'center',
    },

  });
}
