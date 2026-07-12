import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Animated,
  Easing,
  Platform,
  Pressable,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { useNotification } from '../../hooks/useNotification';
import { notificationApi } from '../../api/notificationApi';
import { useAuth } from '../../hooks/useAuth';
import { homeApi } from '../../api/homeApi';
import { videoApi } from '../../api/videoApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import { ThunderTransition } from '../../components/ThunderTransition';
import { UNIFIED_THEME } from '../../unifiedTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { iosFlexChild, HOME_TAB_LAYOUT } from '../../utils/platformLayout';
import { scaleUi } from '../../utils/iosUiScale';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const TB = C.tabBar;

/** Match mentor profile accent cycle (reserved for future category chips) */
const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const SESSION_CARD_W = 160;
const THUMB_PLACEHOLDER = ['#3d3666', '#16122c'];

const HOW_IT_WORKS_STEPS = [
  { icon: 'travel-explore', label: 'Discover' },
  { icon: 'event-available', label: 'Book' },
  { icon: 'groups', label: 'Connect' },
];

function usePressScale(down = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;

  const onInteractIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: down,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [scale, down]);

  const onInteractOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return { scale, onInteractIn, onInteractOut };
}

function AnimatedPressable({
  children,
  style,
  onPress,
  scaleDown = 0.96,
  accessibilityRole = 'button',
  accessibilityLabel,
  hitSlop,
}) {
  const { scale, onInteractIn, onInteractOut } = usePressScale(scaleDown);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onInteractIn}
        onPressOut={onInteractOut}
        onHoverIn={onInteractIn}
        onHoverOut={onInteractOut}
        style={style}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        hitSlop={hitSlop}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function TrustIcon({ name, color, delay = 0 }) {
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(floatY, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatY, delay]);

  const translateY = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <MaterialIcons name={name} size={20} color={color} />
    </Animated.View>
  );
}

function SectionHeaderRow({ title, onSeeAll, icon }) {
  return (
    <View style={styles.secHdrRow}>
      <View style={styles.secHdrLeft}>
        {icon ? (
          <View style={styles.secHdrIcon}>
            <MaterialIcons name={icon} size={14} color={PURPLE_LINK} />
          </View>
        ) : null}
        <Text style={styles.secHdrTitle}>{title}</Text>
      </View>
      {onSeeAll ? (
        <AnimatedPressable
          onPress={onSeeAll}
          scaleDown={0.94}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`See all ${title}`}
        >
          <Text style={styles.secHdrLink}>See all &gt;</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

function IntroPlayButton({ playGlowOpacity, playGlowScale }) {
  const glowTransform =
    Platform.OS === 'ios' ? [] : [{ scale: playGlowScale }];

  return (
    <View style={styles.howItWorksPlayWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.howItWorksPlayGlow,
          { opacity: playGlowOpacity, transform: glowTransform },
        ]}
      >
        <LinearGradient
          colors={[PURPLE_LINK, GOLD, C.accent.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.howItWorksPlayGlowGrad}
        />
      </Animated.View>
      <View style={styles.howItWorksPlay}>
        <LinearGradient
          colors={B.nebulaGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <MaterialIcons
          name="play-arrow"
          size={Platform.OS === 'ios' ? scaleUi(20) : 18}
          color={B.nebulaText}
          style={styles.howItWorksPlayIcon}
        />
      </View>
    </View>
  );
}

function HowItWorksCard({ video, onPress }) {
  const stepLine = HOW_IT_WORKS_STEPS.map(s => s.label).join(' · ');
  const cardScale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const navigatingRef = useRef(false);

  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [breathe]);

  const haloOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.38],
  });
  const haloScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });
  const playGlowOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.58],
  });
  const playGlowScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  const onInteractIn = () => {
    Animated.spring(cardScale, {
      toValue: 0.97,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onInteractOut = () => {
    if (navigatingRef.current) return;
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 0.95, duration: 90, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1.02, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigatingRef.current = false;
      onPress();
    });
  };

  const haloScaleTransform =
    Platform.OS === 'ios' ? [] : [{ scale: haloScale }];

  return (
    <View style={styles.howItWorksOuter}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.howItWorksHalo,
          { opacity: haloOpacity, transform: haloScaleTransform },
        ]}
      >
        <LinearGradient
          colors={['rgba(167,139,250,0.5)', 'rgba(240,216,117,0.25)', 'rgba(94,234,212,0.15)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
        <Pressable
          onPress={handlePress}
          onPressIn={onInteractIn}
          onPressOut={onInteractOut}
          onHoverIn={onInteractIn}
          onHoverOut={onInteractOut}
          accessibilityRole="button"
          accessibilityLabel={`Play ${video.title}`}
          style={styles.howItWorksPressable}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.howItWorksBorderRing, { opacity: haloOpacity }]}
          />
          <View style={styles.howItWorksCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.2)', 'rgba(12,12,40,0.72)', 'rgba(94,234,212,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.howItWorksRow}>
              <IntroPlayButton
                playGlowOpacity={playGlowOpacity}
                playGlowScale={playGlowScale}
              />
              <View style={styles.howItWorksCopy}>
                <Text style={styles.howItWorksEyebrowTxt}>Connectiqo intro</Text>
                <Text
                  style={styles.howItWorksTitle}
                  numberOfLines={Platform.OS === 'ios' ? 2 : 1}
                >
                  {video.title}
                </Text>
                <Text
                  style={styles.howItWorksStepsLine}
                  numberOfLines={Platform.OS === 'ios' ? 2 : 1}
                >
                  {stepLine}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={PURPLE_LINK}
                style={styles.howItWorksChevron}
              />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SessionOverlayCard({ item, onPress }) {
  const cardH = Math.round(SESSION_CARD_W * 1.28);
  const { scale, onInteractIn, onInteractOut } = usePressScale(0.95);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.sessionCard, { width: SESSION_CARD_W, height: cardH }]}
        onPress={() => onPress(item)}
        onPressIn={onInteractIn}
        onPressOut={onInteractOut}
        onHoverIn={onInteractIn}
        onHoverOut={onInteractOut}
        accessibilityRole="button"
        accessibilityLabel={`Browse ${item.label}`}
      >
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.sessionCardImg}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={THUMB_PLACEHOLDER}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sessionCardImg}
          >
            <MaterialIcons name="videocam" size={30} color="rgba(255,255,255,0.32)" />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(3,2,12,0.88)']}
          style={styles.sessionCardGrad}
          pointerEvents="none"
        />
        <View style={styles.sessionCardPlay} pointerEvents="none">
          <MaterialIcons name="play-circle-outline" size={26} color="rgba(255,255,255,0.92)" />
        </View>
        <View style={styles.sessionCardMeta} pointerEvents="none">
          <Text style={styles.sessionCardTitle} numberOfLines={2}>
            {item.title || item.label}
          </Text>
          <Text style={styles.sessionCardSub} numberOfLines={1}>
            {item.profiles?.name || 'Featured'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
const SLIDE_H = 200;
const SLIDE_GAP = T.spacing.md;
const SLIDE_SIDE = T.spacing.lg;
const AUTO_PLAY_MS = 5000;

const FALLBACK_SLIDES = [
  {
    id: 'fallback-1',
    title: 'Expert mentors',
    subtitle: 'Live 1-on-1 video sessions',
    image: require('../../assets/images/logo.png'),
  },
  {
    id: 'fallback-2',
    title: 'Learn & grow',
    subtitle: 'Verified mentors · Secure payments',
    image: require('../../assets/images/logo.png'),
  },
  {
    id: 'fallback-3',
    title: 'Connectiqo',
    subtitle: 'Connect · Learn · Grow',
    image: require('../../assets/images/logo.png'),
  },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function useShimmer() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return anim;
}

function SkeletonBox({ style }) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }, style, { opacity }]}
    />
  );
}

function HomeSkeleton({ screenWidth }) {
  return (
    <>
      <SkeletonBox
        style={{
          width: screenWidth - SLIDE_SIDE * 2,
          height: SLIDE_H,
          borderRadius: T.borderRadius.lg,
          marginHorizontal: SLIDE_SIDE,
          marginBottom: T.spacing.md,
        }}
      />
      <View style={[styles.skeletonBelowHero, { paddingHorizontal: T.spacing.lg }]}>
        <SkeletonBox
          style={{
            height: 64,
            borderRadius: T.borderRadius.md,
            marginTop: T.spacing.lg,
            marginBottom: T.spacing.lg,
          }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.spacing.md }}>
          <SkeletonBox style={{ width: 130, height: 14, borderRadius: 6 }} />
          <SkeletonBox style={{ width: 44, height: 12, borderRadius: 6 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: T.spacing.md }}>
          {[0, 1, 2].map(i => (
            <SkeletonBox
              key={i}
              style={{ width: SESSION_CARD_W, height: Math.round(SESSION_CARD_W * 1.28), borderRadius: T.borderRadius.lg }}
            />
          ))}
        </View>
      </View>
    </>
  );
}

function HeroSlide({ slide, slideWidth, isRemote }) {
  const [imgLoading, setImgLoading] = useState(!!slide.image_url);
  const source = slide.image_url ? { uri: slide.image_url } : slide.image;

  return (
    <View style={[styles.heroSlide, { width: slideWidth }]}>
      {isRemote ? (
        <Image
          source={source}
          style={styles.heroSlideImage}
          resizeMode="cover"
          onLoadStart={() => setImgLoading(true)}
          onLoadEnd={() => setImgLoading(false)}
          onError={() => setImgLoading(false)}
        />
      ) : (
        <View style={styles.heroSlideFallbackBg}>
          <Image source={source} style={styles.heroSlideLogo} resizeMode="contain" />
        </View>
      )}

      {imgLoading ? (
        <View style={styles.heroSlideLoader}>
          <ActivityIndicator size="small" color={C.accent.secondary} />
        </View>
      ) : null}

      <LinearGradient
        colors={['transparent', 'rgba(3,3,8,0.55)', 'rgba(3,3,8,0.92)']}
        locations={[0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {(slide.title || slide.subtitle) ? (
        <View style={styles.heroSlideCaption} pointerEvents="none">
          {slide.title ? (
            <Text style={styles.heroSlideTitle} numberOfLines={1}>{slide.title}</Text>
          ) : null}
          {slide.subtitle ? (
            <Text style={styles.heroSlideSub} numberOfLines={2}>{slide.subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function HeroDot({ active, onPress, index, count }) {
  const { scale, onInteractIn, onInteractOut } = usePressScale(0.88);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onInteractIn}
        onPressOut={onInteractOut}
        onHoverIn={onInteractIn}
        onHoverOut={onInteractOut}
        style={styles.heroDotHit}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`Banner ${index + 1} of ${count}`}
      >
        {active ? (
          <LinearGradient
            colors={TB.topNavActiveWash}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroDotActive}
          />
        ) : (
          <View style={styles.heroDot} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function HeroPagination({ count, activeIndex, onSelect }) {
  if (count <= 1) return null;
  return (
    <View style={styles.heroDots} accessibilityRole="tablist">
      {Array.from({ length: count }).map((_, i) => (
        <HeroDot
          key={i}
          active={i === activeIndex}
          index={i}
          count={count}
          onPress={() => onSelect(i)}
        />
      ))}
    </View>
  );
}

function HeroSlider({ screenWidth, slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef(null);
  const userDragging = useRef(false);
  const autoTimer = useRef(null);

  const slideWidth = screenWidth - SLIDE_SIDE * 2;
  const snapInterval = slideWidth + SLIDE_GAP;

  const scrollToIndex = useCallback((index, animated = true) => {
    const safe = Math.max(0, Math.min(index, slides.length - 1));
    listRef.current?.scrollToOffset({
      offset: safe * snapInterval,
      animated,
    });
    setActiveIndex(safe);
  }, [slides.length, snapInterval]);

  const clearAutoPlay = useCallback(() => {
    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    clearAutoPlay();
    if (slides.length <= 1) return;
    autoTimer.current = setInterval(() => {
      if (userDragging.current) return;
      setActiveIndex(prev => {
        const next = (prev + 1) % slides.length;
        listRef.current?.scrollToOffset({
          offset: next * snapInterval,
          animated: true,
        });
        return next;
      });
    }, AUTO_PLAY_MS);
  }, [clearAutoPlay, slides.length, snapInterval]);

  useEffect(() => {
    startAutoPlay();
    return clearAutoPlay;
  }, [startAutoPlay, clearAutoPlay]);

  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [slides.length, snapInterval]);

  if (!slides.length) {
    return (
      <View style={[styles.heroSliderWrap, styles.heroSliderEmpty]}>
        <View style={[styles.heroSlide, styles.heroSlideEmpty, { width: slideWidth }]}>
          <View style={styles.heroSlideFallbackBg}>
            <Image source={FALLBACK_SLIDES[0].image} style={styles.heroSlideLogo} resizeMode="contain" />
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(3,3,8,0.55)', 'rgba(3,3,8,0.92)']}
            locations={[0.35, 0.72, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroSlideCaption} pointerEvents="none">
            <Text style={styles.heroSlideTitle}>Discover mentors</Text>
            <Text style={styles.heroSlideSub}>Live 1-on-1 sessions on Connectiqo</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.heroSliderWrap}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={s => String(s.id)}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={slides.length > 1}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: SLIDE_SIDE,
          gap: SLIDE_GAP,
        }}
        getItemLayout={(_, i) => ({
          length: snapInterval,
          offset: snapInterval * i,
          index: i,
        })}
        onScrollBeginDrag={() => {
          userDragging.current = true;
          clearAutoPlay();
        }}
        onScrollEndDrag={() => {
          userDragging.current = false;
          startAutoPlay();
        }}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
          setActiveIndex(Math.max(0, Math.min(i, slides.length - 1)));
        }}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => scrollToIndex(index, false), 50);
        }}
        renderItem={({ item }) => (
          <HeroSlide
            slide={item}
            slideWidth={slideWidth}
            isRemote={!!item.image_url}
          />
        )}
      />
      <HeroPagination
        count={slides.length}
        activeIndex={activeIndex}
        onSelect={scrollToIndex}
      />
    </View>
  );
}



const TRUST = [
  { icon: 'verified-user', label: 'Verified Mentors' },
  { icon: 'lock', label: 'Secure Payments' },
  { icon: 'videocam', label: 'Live HD Video' },
  { icon: 'star', label: 'Rated & Reviewed' },
];

const DURATION = 420;
const EASE = Easing.out(Easing.cubic);

function anim(opacity, translateY, delay = 0) {
  return Animated.parallel([
    Animated.timing(opacity, { toValue: 1, delay, duration: DURATION, easing: EASE, useNativeDriver: true }),
    Animated.timing(translateY, { toValue: 0, delay, duration: DURATION, easing: EASE, useNativeDriver: true }),
  ]);
}

function useEntrance() {
  const o = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(18)).current;
  return { o, y, style: { opacity: o, transform: [{ translateY: y }] } };
}

const BORDER_SPIN_COLORS = [
  B.premiumGradient[0],
  GOLD,
  C.accent.secondary,
  '#f9a8d4',
  B.premiumGradient[0],
];

function RotatingBorderIconButton({ onPress, accessibilityLabel, children }) {
  const spin = useRef(new Animated.Value(0)).current;
  const { scale, onInteractIn, onInteractOut } = usePressScale(0.92);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onInteractIn}
        onPressOut={onInteractOut}
        onHoverIn={onInteractIn}
        onHoverOut={onInteractOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.appBarBtnShell}
      >
        <Animated.View style={[styles.appBarBtnSpinner, { transform: [{ rotate }] }]}>
          <LinearGradient
            colors={BORDER_SPIN_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.appBarBtnGradientPlate}
          />
        </Animated.View>
        <View style={styles.appBarBtn}>
          {children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { unreadCount, syncUnreadCount } = useNotification();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [urlPlayback, setUrlPlayback] = useState(null);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [heroSlides, setHeroSlides] = useState(FALLBACK_SLIDES);
  const [introVideo, setIntroVideo] = useState(null);
  const [sessionVideos, setSessionVideos] = useState([]);
  const [thunderVisible, setThunderVisible] = useState(false);
  const [thunderOrigin, setThunderOrigin] = useState(null);
  const thunderBusy = useRef(false);
  const thunderBtnRef = useRef(null);
  const boltPulse = useRef(new Animated.Value(1)).current;

  const s0 = useEntrance(); // app bar
  const s1 = useEntrance(); // hero
  const s2 = useEntrance(); // video card
  const s2b = useEntrance(); // video categories
  const s3 = useEntrance(); // dual role
  const s4 = useEntrance(); // how it works
  const s5 = useEntrance(); // trust strip

  useEffect(() => {
    Animated.stagger(80, [
      anim(s0.o, s0.y),
      anim(s1.o, s1.y),
      anim(s2.o, s2.y),
      anim(s2b.o, s2b.y),
      anim(s3.o, s3.y),
      anim(s4.o, s4.y),
      anim(s5.o, s5.y),
    ]).start();
  }, []);

  const loadHome = useCallback((isRefresh = false) => {
    let cancelled = false;
    if (isRefresh) setRefreshing(true);
    Promise.allSettled([
      homeApi.getVideos(),
      videoApi.getFreeVideos(),
      homeApi.getHeroSlides(),
    ]).then(([homeResult, freeResult, slidesResult]) => {
      if (cancelled) return;
      const sessions = homeResult.status === 'fulfilled' ? homeResult.value.sessions : [];
      const freeVideos = freeResult.status === 'fulfilled' ? freeResult.value : [];
      if (homeResult.status === 'fulfilled' && homeResult.value.intro) {
        setIntroVideo(homeResult.value.intro);
      }
      if (sessions.length || freeVideos.length) {
        const seen = new Set();
        const merged = [...sessions, ...freeVideos]
          .filter(v => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setSessionVideos(merged.slice(0, 10));
      }
      if (slidesResult.status === 'fulfilled') {
        const slides = slidesResult.value?.length ? slidesResult.value : FALLBACK_SLIDES;
        setHeroSlides(slides);
      }
      setDataLoaded(true);
      setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cancelLoad = loadHome(false);
      if (profile?.id) {
        notificationApi.getNotifications(profile.id).then(syncUnreadCount).catch(() => {});
      }
      return () => {
        cancelLoad();
        setPlayerVisible(false);
        setUrlPlayback(null);
        setPlayerError(false);
      };
    }, [loadHome, profile?.id, syncUnreadCount]),
  );

  const openNotificationsWithThunder = useCallback(() => {
    if (thunderBusy.current) return;
    thunderBusy.current = true;
    Animated.sequence([
      Animated.timing(boltPulse, {
        toValue: 1.45,
        duration: 60,
        easing: Easing.out(Easing.back(1.8)),
        useNativeDriver: true,
      }),
      Animated.timing(boltPulse, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const launch = (origin) => {
      setThunderOrigin(origin);
      setThunderVisible(true);
    };

    if (thunderBtnRef.current?.measureInWindow) {
      thunderBtnRef.current.measureInWindow((x, y, w, h) => {
        launch({ x: x + w / 2, y: y + h / 2 });
      });
    } else {
      launch(null);
    }
  }, [boltPulse]);

  const handleThunderStrike = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.Notifications);
  }, [navigation]);

  const handleThunderDismiss = useCallback(() => {
    setThunderVisible(false);
    thunderBusy.current = false;
  }, []);

  return (
    <SafeScreen scrollable={false} padding={HOME_TAB_LAYOUT.safeScreenPadding} hasBottomTabs={false}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: insets.bottom + 52,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHome(true)}
            tintColor={C.accent.primary}
            colors={[C.accent.primary]}
          />
        }
      >

        {/* ── APP BAR ── */}
        <Animated.View style={[styles.appBar, s0.style]}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoMark}
              resizeMode="cover"
            />
          </View>
          <View style={styles.appBarTitles}>
            <Text style={styles.appName} numberOfLines={1}>
              Connectiqo
            </Text>
            <Text style={styles.appTagline} numberOfLines={1}>
              Connect · Learn · Grow
            </Text>
          </View>
          <View ref={thunderBtnRef} collapsable={false}>
            <RotatingBorderIconButton
              onPress={openNotificationsWithThunder}
              accessibilityLabel="Notifications"
            >
              <Animated.View style={[styles.appBarBtnIconPulse, { transform: [{ scale: boltPulse }] }]}>
                <MaterialIcons name="bolt" size={22} color={GOLD} />
              </Animated.View>
              {unreadCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </RotatingBorderIconButton>
          </View>
        </Animated.View>

        {!dataLoaded ? <HomeSkeleton screenWidth={width} /> : (
        <>
        {/* ── HERO SLIDER ── */}
        <Animated.View style={[s1.style, styles.heroSection]}>
          <HeroSlider screenWidth={width} slides={heroSlides} />
        </Animated.View>

        {/* ── padded wrapper for all content below the slider ── */}
        <View style={styles.belowHeroPad}>
        {/* ── WATCH HOW IT WORKS ── */}
        {introVideo && (
        <Animated.View style={[styles.introSection, s2.style]}>
          <HowItWorksCard
            video={introVideo}
            onPress={() => {
              setUrlPlayback(introVideo.video_url);
              setPlayerError(false);
              setPlayerVisible(true);
            }}
          />
        </Animated.View>
        )}

        {/* ── VIDEO CATEGORIES ── */}
        {sessionVideos.length > 0 && (
        <Animated.View style={[styles.catSection, s2b.style]}>
          <SectionHeaderRow
            title="Recent Sessions"
            icon="history"
            onSeeAll={() =>
              navigation.navigate(SCREEN_NAMES.LearnerSection, {
                screen: SCREEN_NAMES.LearnerVideos,
                params: { filterMentorId: null },
              })
            }
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tileRow}
          >
            {sessionVideos.map(item => (
              <SessionOverlayCard
                key={item.id}
                item={item}
                onPress={cat => {
                  navigation.navigate(SCREEN_NAMES.LearnerSection, {
                    screen: SCREEN_NAMES.LearnerVideos,
                    params: { startVideoId: cat.id, filterMentorId: null },
                  });
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>
        )}


        {/* ── TRUST STRIP ── */}
        <Animated.View style={[styles.trustStrip, s5.style]}>
          {TRUST.map((t, i) => (
            <React.Fragment key={t.label}>
              <View style={styles.trustItem}>
                <TrustIcon
                  name={t.icon}
                  color={i % 2 === 0 ? C.accent.primary : C.accent.secondary}
                  delay={i * 220}
                />
                <Text style={styles.trustLabel}>{t.label}</Text>
              </View>
              {i < TRUST.length - 1 ? <View style={styles.trustDivider} /> : null}
            </React.Fragment>
          ))}
        </Animated.View>

        </View>{/* end padded wrapper */}
        </>
        )}{/* end dataLoaded conditional */}

      </ScrollView>

      {/* ── VIDEO PLAYER MODAL ── */}
      <Modal
        visible={playerVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setPlayerVisible(false);
          setUrlPlayback(null);
        }}
      >
        <View style={[styles.playerScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {playerVisible && urlPlayback ? (
            <Video
              source={{ uri: urlPlayback }}
              style={styles.playerVideo}
              controls
              resizeMode="contain"
              playInBackground={false}
              playWhenInactive={false}
              onError={() => setPlayerError(true)}
            />
          ) : null}
          {/* Close button overlay */}
          <TouchableOpacity
            style={[styles.playerCloseOverlay, { top: insets.top + 10 }]}
            onPress={() => {
              setPlayerVisible(false);
              setUrlPlayback(null);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="close" size={20} color={C.text.primary} />
          </TouchableOpacity>

          {playerError ? (
            <View style={styles.playerError}>
              <MaterialIcons name="error-outline" size={22} color={C.accent.error} />
              <Text style={styles.playerErrorText}>Could not load video.</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <ThunderTransition
        visible={thunderVisible}
        origin={thunderOrigin}
        onStrike={handleThunderStrike}
        onDismiss={handleThunderDismiss}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 0,
  },

  // App bar — logo height matches title block (headingSm + tagline ≈ 44px) and action button
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: T.spacing.lg,
    marginBottom: T.spacing.sm,
    gap: T.spacing.sm + 2,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
  },
  logoMark: {
    width: '112%',
    height: '112%',
    marginLeft: '-6%',
    marginTop: '-6%',
  },
  appBarTitles: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  appName: {
    ...T.typography.headingSm,
    color: C.text.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  appTagline: {
    ...T.typography.bodyXs,
    color: PURPLE_LINK,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  appBarBtnShell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ ios: T.shadows.small, android: { elevation: 3 } }),
  },
  appBarBtnSpinner: {
    position: 'absolute',
    width: '130%',
    height: '130%',
    left: '-15%',
    top: '-15%',
  },
  appBarBtnGradientPlate: {
    flex: 1,
  },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(12,12,40,0.92)',
    position: 'relative',
  },
  appBarBtnIconPulse: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: C.accent.error,
    borderWidth: 1.5,
    borderColor: 'rgba(12,12,40,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 11,
  },

  heroSection: {
    marginBottom: T.spacing.sm,
  },
  heroSliderWrap: {
    marginBottom: T.spacing.xs,
  },
  heroSliderEmpty: {
    paddingHorizontal: SLIDE_SIDE,
  },
  heroSlideEmpty: {
    alignSelf: 'center',
  },
  skeletonBelowHero: {
    width: '100%',
  },
  belowHeroPad: {
    paddingHorizontal: T.spacing.lg,
  },

  heroSlide: {
    height: SLIDE_H,
    borderRadius: T.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    backgroundColor: C.primary.dark,
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 8 } }),
  },
  heroSlideImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroSlideFallbackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.primary.nebula,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSlideLogo: {
    width: 72,
    height: 72,
    opacity: 0.9,
  },
  heroSlideLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(1,0,14,0.35)',
  },
  heroSlideCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: T.spacing.md,
    paddingBottom: T.spacing.md,
    paddingTop: T.spacing.xl,
  },
  heroSlideTitle: {
    ...T.typography.headingSm,
    color: C.text.primary,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSlideSub: {
    ...T.typography.bodySm,
    color: C.text.secondary,
    lineHeight: 18,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: T.spacing.md,
    paddingHorizontal: SLIDE_SIDE,
  },
  heroDotHit: {
    padding: 4,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroDotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },

  secHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: T.spacing.xs,
    marginBottom: T.spacing.sm,
  },
  secHdrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  secHdrIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(167,139,250,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secHdrTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
  },
  secHdrLink: {
    fontSize: 13,
    fontWeight: '700',
    color: PURPLE_LINK,
  },

  introSection: {
    marginBottom: T.spacing.md,
    ...Platform.select({
      ios: { marginTop: T.spacing.xs },
      default: {},
    }),
  },
  howItWorksOuter: {
    position: 'relative',
    width: '100%',
  },
  howItWorksPressable: {
    position: 'relative',
    width: '100%',
  },
  howItWorksHalo: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: T.borderRadius.md + 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: PURPLE_LINK,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  howItWorksBorderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.55)',
    zIndex: 2,
  },
  howItWorksCard: {
    borderRadius: T.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    position: 'relative',
    width: '100%',
    ...Platform.select({
      ios: { minHeight: scaleUi(80) },
      default: {},
    }),
  },
  howItWorksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: Platform.OS === 'ios' ? scaleUi(14) : 10,
    paddingHorizontal: Platform.OS === 'ios' ? T.spacing.md : T.spacing.sm + 2,
    ...Platform.select({
      ios: { minHeight: scaleUi(80) },
      default: { gap: T.spacing.sm + 2 },
    }),
  },
  howItWorksPlayWrap: {
    width: Platform.OS === 'ios' ? scaleUi(40) : 36,
    height: Platform.OS === 'ios' ? scaleUi(40) : 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({
      ios: { marginRight: T.spacing.md },
      default: {},
    }),
  },
  howItWorksPlayGlow: {
    position: 'absolute',
    width: Platform.OS === 'ios' ? scaleUi(40) : 36,
    height: Platform.OS === 'ios' ? scaleUi(40) : 36,
    borderRadius: Platform.OS === 'ios' ? scaleUi(20) : 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  howItWorksPlayGlowGrad: {
    flex: 1,
    borderRadius: Platform.OS === 'ios' ? scaleUi(20) : 18,
  },
  howItWorksPlay: {
    width: Platform.OS === 'ios' ? scaleUi(38) : 34,
    height: Platform.OS === 'ios' ? scaleUi(38) : 34,
    borderRadius: Platform.OS === 'ios' ? scaleUi(19) : 17,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  howItWorksPlayIcon: {
    zIndex: 2,
    marginLeft: Platform.OS === 'ios' ? 3 : 2,
  },
  howItWorksCopy: {
    ...iosFlexChild(),
    justifyContent: 'center',
    ...Platform.select({
      ios: { marginRight: T.spacing.sm, paddingVertical: 2 },
      default: { gap: 1 },
    }),
  },
  howItWorksChevron: {
    flexShrink: 0,
    ...Platform.select({
      ios: { marginLeft: T.spacing.xs },
      default: {},
    }),
  },
  howItWorksEyebrowTxt: {
    fontSize: Platform.OS === 'ios' ? scaleUi(11) : 9,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    marginBottom: Platform.OS === 'ios' ? scaleUi(3) : 0,
  },
  howItWorksTitle: {
    fontSize: Platform.OS === 'ios' ? scaleUi(15) : 13,
    fontWeight: '800',
    color: C.text.primary,
    lineHeight: Platform.OS === 'ios' ? scaleUi(20) : 17,
    marginBottom: Platform.OS === 'ios' ? scaleUi(2) : 0,
  },
  howItWorksStepsLine: {
    fontSize: Platform.OS === 'ios' ? scaleUi(12) : 10,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: 1,
    lineHeight: Platform.OS === 'ios' ? scaleUi(16) : 14,
  },

  catSection: {
    marginBottom: T.spacing.sm,
  },
  tileRow: {
    gap: 12,
    paddingRight: T.spacing.xs,
    paddingTop: 2,
  },
  sessionCard: {
    borderRadius: T.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: C.primary.dark,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  sessionCardImg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCardGrad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
  },
  sessionCardPlay: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  sessionCardMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: T.spacing.md,
  },
  sessionCardTitle: {
    color: C.text.primary,
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 3,
  },
  sessionCardSub: {
    fontSize: 10,
    color: C.text.muted,
    fontWeight: '600',
  },

  // Trust strip (mentor profile stats bar pattern)
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  trustLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: C.text.muted,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  trustDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: 6,
    alignSelf: 'stretch',
  },

  // Player modal
  playerScreen: {
    flex: 1,
    backgroundColor: C.primary.void,
    justifyContent: 'center',
  },
  playerVideo: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  playerCloseOverlay: {
    position: 'absolute',
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  playerError: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  playerErrorText: {
    ...T.typography.bodySm,
    color: C.text.primary,
  },
});
