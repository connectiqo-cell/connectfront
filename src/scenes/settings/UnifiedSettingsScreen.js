import { SafeScreen } from '../../components/SafeScreen';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Linking,
  Share,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { pickProfileAvatar } from '../../utils/pickProfileAvatar';
import { UNIFIED_THEME } from '../../unifiedTheme';
import Button from '../../components/Button';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { profileApi } from '../../api/profileApi';
import { videoApi } from '../../api/videoApi';
import { paymentApi } from '../../api/paymentApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { formatDate } from '../../utils/dateHelpers';
import { CircularProfileImage } from '../../components/CircularGradientFrame';
import { useAvatarPreview } from '../../contexts/AvatarPreviewContext';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';

const APP_VERSION = '0.0.1';
const SUPPORT_EMAIL = 'contact@connectiqo.com';
const PRIVACY_URL = 'https://connectiqo.com/privacy';
const TERMS_URL = 'https://connectiqo.com/terms';

const ACCENT_COLORS = { gold: GOLD, teal: TEAL, purple: PURPLE_LINK };
const ACCENT_BG = {
  gold: S.accentGold,
  teal: S.accentTeal,
  purple: S.accentViolet,
};

async function openExternal(url, fallback) {
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Toast.show(fallback || 'Link unavailable');
    }
  } catch {
    Toast.show(fallback || 'Could not open link');
  }
}

function runEntrance(opacity, translateY, delay = 0) {
  opacity.setValue(0);
  translateY.setValue(16);
  Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}

function AnimatedPressable({
  children,
  style,
  onPress,
  disabled,
  pressScale = 0.96,
  hoverScale = 1.04,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const springTo = useCallback(
    toValue => {
      Animated.spring(scale, {
        toValue,
        friction: 7,
        tension: 260,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  const onPressIn = () => {
    if (disabled) return;
    springTo(pressScale);
  };

  const onPressOut = () => {
    if (disabled) return;
    springTo(hovered.current ? hoverScale : 1);
  };

  const onHoverIn = () => {
    if (disabled) return;
    hovered.current = true;
    springTo(hoverScale);
  };

  const onHoverOut = () => {
    hovered.current = false;
    springTo(1);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function FadeSlideIn({ children, delay = 0, style, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, delay);
      return;
    }
    if (replayToken > 0) {
      runEntrance(opacity, translateY, delay);
    }
  }, [replayToken, delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function SectionHeaderRow({ title, count, subtitle, replayToken = 0, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-8)).current;
  const hasEntered = useRef(false);

  const play = useCallback(() => {
    opacity.setValue(0);
    translateX.setValue(-8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 300,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateX]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) {
      play();
    }
  }, [replayToken, play]);

  return (
    <Animated.View style={[styles.secHdrWrap, { opacity, transform: [{ translateX }] }]}>
      <View style={styles.secHdrRow}>
        <Text style={styles.secHdrTitle}>{title}</Text>
        {count != null ? (
          <View style={styles.secHdrCount}>
            <Text style={styles.secHdrCountText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.secHdrSub}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

function QuickStat({ label, value, loading }) {
  return (
    <View style={styles.quickStat}>
      {loading ? (
        <ActivityIndicator size="small" color={TEAL} style={styles.quickStatLoader} />
      ) : (
        <Text style={styles.quickStatValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

function PulseBadge({ count, style, textStyle, max = 9 }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!count) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [count, pulse]);

  if (!count) return null;

  const label = count > max ? `${max}+` : String(count);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulse }] }]}>
      <Text style={textStyle}>{label}</Text>
    </Animated.View>
  );
}

function MenuRow({
  icon,
  accent,
  label,
  subtitle,
  onPress,
  badge,
  noBorder,
  destructive,
  index = 0,
  replayToken = 0,
}) {
  const iconColor = destructive ? C.accent.error : ACCENT_COLORS[accent] || PURPLE_LINK;
  const iconBg = destructive ? 'rgba(248,113,113,0.12)' : ACCENT_BG[accent] || S.accentViolet;
  const scale = useRef(new Animated.Value(1)).current;
  const chevronX = useRef(new Animated.Value(0)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowY = useRef(new Animated.Value(10)).current;
  const hovered = useRef(false);
  const iconScale = useRef(new Animated.Value(1)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(rowOpacity, rowY, 40 + index * 35);
      return;
    }
    if (replayToken > 0) {
      runEntrance(rowOpacity, rowY, 40 + index * 35);
    }
  }, [replayToken, index, rowOpacity, rowY]);

  useEffect(() => {
    if (!onPress) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronX, {
          toValue: 4,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chevronX, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [onPress, chevronX]);

  const springTo = toValue => {
    Animated.spring(scale, { toValue, friction: 7, tension: 260, useNativeDriver: true }).start();
  };

  const setHighlight = active => {
    Animated.timing(highlight, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.spring(iconScale, {
      toValue: active ? 1.08 : 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const highlightOpacity = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={{ opacity: rowOpacity, transform: [{ translateY: rowY }] }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        onPressIn={() => {
          if (!onPress) return;
          springTo(0.98);
          setHighlight(true);
        }}
        onPressOut={() => {
          springTo(hovered.current ? 1.01 : 1);
          if (!hovered.current) setHighlight(false);
        }}
        onHoverIn={() => {
          if (!onPress) return;
          hovered.current = true;
          springTo(1.01);
          setHighlight(true);
        }}
        onHoverOut={() => {
          hovered.current = false;
          springTo(1);
          setHighlight(false);
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Animated.View
            pointerEvents="none"
            style={[styles.menuHighlightOverlay, { opacity: highlightOpacity }]}
          />
          <View style={[styles.menuItem, noBorder && styles.noBorder]}>
            <View style={styles.menuLeft}>
              <Animated.View
                style={[styles.menuIconWrap, { backgroundColor: iconBg, transform: [{ scale: iconScale }] }]}
              >
                <MaterialIcons name={icon} size={20} color={iconColor} />
              </Animated.View>
              <View style={styles.menuTextWrap}>
                <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>{label}</Text>
                {subtitle ? (
                  <Text style={styles.menuSubtitle} numberOfLines={2}>{subtitle}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.menuRight}>
              {badge != null && badge > 0 ? (
                <PulseBadge count={badge} max={99} style={styles.menuBadge} textStyle={styles.menuBadgeText} />
              ) : null}
              {onPress ? (
                <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
                  <MaterialIcons name="chevron-right" size={22} color={C.text.muted} />
                </Animated.View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function AvatarGlowRing() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.avatarGlowRing,
        { opacity: ringOpacity, transform: [{ scale: ringScale }] },
      ]}
    />
  );
}

function RefreshButton({ onPress, refreshing }) {
  const spin = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  useEffect(() => {
    if (refreshing) {
      spinLoop.current = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spin.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [refreshing, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AnimatedPressable
      style={styles.headerRefreshBtn}
      onPress={onPress}
      disabled={refreshing}
      hoverScale={1.08}
      pressScale={0.92}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <MaterialIcons name="refresh" size={20} color={refreshing ? C.text.disabled : TEAL} />
      </Animated.View>
    </AnimatedPressable>
  );
}

function SubsRow({ row, onPress, index, replayToken = 0 }) {
  const m = row.profiles;
  const name = m?.name || 'Mentor';
  const expLabel = row.expires_at
    ? `Access until ${formatDate(row.expires_at)}`
    : 'Full access active';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;
  const chevronX = useRef(new Animated.Value(0)).current;
  const hasEntered = useRef(false);

  const playEntrance = useCallback(() => {
    opacity.setValue(0);
    translateX.setValue(-12);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      playEntrance();
      return;
    }
    if (replayToken > 0) {
      playEntrance();
    }
  }, [replayToken, playEntrance]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronX, { toValue: 3, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(chevronX, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [chevronX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <AnimatedPressable style={styles.subsRow} onPress={onPress} hoverScale={1.01} pressScale={0.98}>
        <LinearGradient colors={B.premiumGradient} style={styles.subsAvatarRing}>
          <View style={styles.subsAvatarInner}>
            {m?.avatar_url ? (
              <Image source={{ uri: m.avatar_url }} style={styles.subsAvatar} />
            ) : (
              <View style={[styles.subsAvatar, styles.subsAvatarPh]}>
                <MaterialIcons name="person" size={20} color={PURPLE_LINK} />
              </View>
            )}
          </View>
        </LinearGradient>
        <View style={styles.subsMeta}>
          <Text style={styles.subsName} numberOfLines={1}>{name}</Text>
          <Text style={styles.subsExpiry} numberOfLines={1}>{expLabel}</Text>
        </View>
        <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
          <MaterialIcons name="chevron-right" size={22} color={C.text.muted} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function FloatingEmptyIcon() {
  const floatY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(floatY, { toValue: -6, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatY, scale]);

  return (
    <Animated.View
      style={[styles.subsEmptyIcon, { transform: [{ translateY: floatY }, { scale }] }]}
    >
      <MaterialIcons name="subscriptions" size={28} color={PURPLE_LINK} />
    </Animated.View>
  );
}

export default function UnifiedSettingsScreen({ navigation }) {
  const { showAvatarPreview } = useAvatarPreview();
  const { profile, signOut, refreshProfile } = useAuth();
  const { unreadCount } = useNotification();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [subsLoading, setSubsLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [replayToken, setReplayToken] = useState(0);
  const subsLoadedRef = useRef(false);
  const walletLoadedRef = useRef(false);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url || '');
  }, [profile?.avatar_url]);

  useEffect(() => {
    subsLoadedRef.current = false;
    walletLoadedRef.current = false;
  }, [profile?.id]);

  const loadSubscriptions = useCallback(async () => {
    if (!profile?.id) {
      setSubscriptions([]);
      subsLoadedRef.current = false;
      setSubsLoading(false);
      return;
    }
    if (!subsLoadedRef.current) {
      setSubsLoading(true);
    }
    try {
      const rows = await videoApi.getLearnerActiveSubscriptionsDetail(profile.id);
      setSubscriptions(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('UnifiedSettings: subscriptions load failed', e?.message || e);
      if (!subsLoadedRef.current) {
        setSubscriptions([]);
      }
    } finally {
      setSubsLoading(false);
      subsLoadedRef.current = true;
    }
  }, [profile?.id]);

  const loadWallet = useCallback(async () => {
    if (!profile?.id) {
      setWalletBalance(null);
      walletLoadedRef.current = false;
      setWalletLoading(false);
      return;
    }
    if (!walletLoadedRef.current) {
      setWalletLoading(true);
    }
    try {
      const w = await paymentApi.getWallet(profile.id);
      setWalletBalance(parseFloat(w?.balance || 0));
    } catch {
      if (!walletLoadedRef.current) {
        setWalletBalance(null);
      }
    } finally {
      setWalletLoading(false);
      walletLoadedRef.current = true;
    }
  }, [profile?.id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshProfile?.(), loadSubscriptions(), loadWallet()]);
  }, [refreshProfile, loadSubscriptions, loadWallet]);

  useEffect(() => {
    if (profile?.id) {
      loadSubscriptions();
      loadWallet();
    }
  }, [profile?.id, loadSubscriptions, loadWallet]);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
      loadWallet();
    }, [loadSubscriptions, loadWallet])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      subsLoadedRef.current = false;
      walletLoadedRef.current = false;
      await refreshAll();
      setReplayToken(t => t + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const goToVideos = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.LearnerSection, {
      screen: SCREEN_NAMES.LearnerVideos,
    });
  }, [navigation]);

  const goToBookings = useCallback(() => {
    navigation.navigate(SCREEN_NAMES.LearnerSection, {
      screen: SCREEN_NAMES.LearnerBookings,
    });
  }, [navigation]);

  const openMentor = useCallback(
    mentorId => {
      navigation.navigate(SCREEN_NAMES.MentorProfile, { mentorId });
    },
    [navigation]
  );

  const handlePickImage = async () => {
    try {
      const picked = await pickProfileAvatar();
      if (!picked) return;
      setLoading(true);
      const url = await profileApi.uploadAvatar({
        userId: profile.id,
        base64: picked.base64,
        mimeType: picked.mimeType,
        fileName: picked.fileName,
      });
      setAvatarUrl(url);
      await refreshProfile();
      Toast.show('Photo updated');
    } catch {
      Toast.show('Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: Platform.select({
          ios: 'Join me on Connectiqo — connect with mentors, book sessions, and learn together.',
          default: 'Join me on Connectiqo — connect with mentors, book sessions, and learn together.\nconnectiqo://home',
        }),
        title: 'Connectiqo',
      });
    } catch {
      /* user dismissed */
    }
  };

  const handleHelpSupport = () => {
    openExternal(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Connectiqo Support')}`,
      `Email us at ${SUPPORT_EMAIL}`
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Policy',
      'We respect your privacy. Your profile, session data, and payment details are stored securely and never sold to third parties.',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Read full policy', onPress: () => openExternal(PRIVACY_URL, 'Privacy policy link unavailable') },
      ]
    );
  };

  const handleTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using Connectiqo you agree to our community guidelines, booking policies, and mentor–learner conduct standards.',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Read full terms', onPress: () => openExternal(TERMS_URL, 'Terms link unavailable') },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Toast.show('Failed to sign out');
          }
        },
      },
    ]);
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';

  const walletLabel = walletLoading
    ? '…'
    : `₹${(walletBalance ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const subsCountLabel = subsLoading ? '…' : String(subscriptions.length);

  return (
    <SafeScreen scrollable={false} padding={T.spacing.lg} hasBottomTabs={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} />
        }
      >
        <FadeSlideIn replayToken={replayToken} delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={styles.screenTitle}>Settings</Text>
              <Text style={styles.screenSubtitle}>Manage your account and preferences</Text>
            </View>
            <RefreshButton onPress={handleRefresh} refreshing={refreshing} />
          </View>
        </FadeSlideIn>

        {/* Profile Card */}
        <FadeSlideIn replayToken={replayToken} delay={60} style={styles.profileCardWrap}>
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(167,139,250,0.18)', 'rgba(94,234,212,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCardGlow}
            />
            <View style={styles.avatarRow}>
              <View style={styles.avatarWrapper}>
                <AvatarGlowRing />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (avatarUrl) {
                      showAvatarPreview({ uri: avatarUrl, name: profile?.name || 'User' });
                    } else {
                      handlePickImage();
                    }
                  }}
                  disabled={loading}
                >
                  <CircularProfileImage
                    size={76}
                    ringWidth={2}
                    colors={B.premiumGradient}
                    innerBg={C.primary.void}
                    uri={avatarUrl}
                    previewName={profile?.name || 'User'}
                    pressable={false}
                  imageProps={{ key: avatarUrl, cache: 'reload' }}
                  fallback={
                    <View style={[styles.avatarPlaceholder, styles.avatarFallback]}>
                      <MaterialIcons name="person" size={36} color={PURPLE_LINK} />
                    </View>
                  }
                />
                </TouchableOpacity>
                <AnimatedPressable
                  style={styles.cameraBtn}
                  onPress={handlePickImage}
                  disabled={loading}
                  hoverScale={1.12}
                  pressScale={0.9}
                >
                  <MaterialIcons name="camera-alt" size={14} color={C.text.primary} />
                </AnimatedPressable>
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{profile?.name || 'User'}</Text>
                {profile?.username ? (
                  <Text style={styles.profileUsername}>@{profile.username}</Text>
                ) : null}
                <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <MaterialIcons name="workspace-premium" size={12} color={GOLD} />
                    <Text style={styles.badgeText}>Mentor & Learner</Text>
                  </View>
                  {profile?.phone ? (
                    <View style={[styles.badge, styles.badgeMuted]}>
                      <MaterialIcons name="phone" size={11} color={TEAL} />
                      <Text style={[styles.badgeText, styles.badgeTextMuted]} numberOfLines={1}>
                        {profile.phone}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.statsRow}>
              <QuickStat label="Subscriptions" value={subsCountLabel} loading={subsLoading} />
              <View style={styles.statsDivider} />
              <QuickStat label="Wallet" value={walletLabel} loading={walletLoading} />
              <View style={styles.statsDivider} />
              <QuickStat label="Member since" value={memberSince} loading={false} />
            </View>

            <AnimatedPressable
              style={styles.editProfileBtn}
              onPress={() => navigation.navigate(SCREEN_NAMES.EditProfile)}
              hoverScale={1.02}
              pressScale={0.97}
            >
              <Text style={styles.editProfileBtnText}>Edit profile</Text>
            </AnimatedPressable>
          </View>
        </FadeSlideIn>

        <SectionHeaderRow
          title="Video subscriptions"
          count={subscriptions.length || null}
          subtitle="Mentors whose video libraries you can access"
          replayToken={replayToken}
          delay={160}
        />
        <FadeSlideIn replayToken={replayToken} delay={180}>
          <View style={styles.subsCard}>
            {subsLoading ? (
              <View style={styles.subsLoading}>
                <ActivityIndicator size="small" color={TEAL} />
                <Text style={styles.subsLoadingText}>Checking subscriptions…</Text>
              </View>
            ) : subscriptions.length === 0 ? (
              <View style={styles.subsEmptyWrap}>
                <FloatingEmptyIcon />
                <Text style={styles.subsEmptyTitle}>No active subscriptions</Text>
                <Text style={styles.subsEmpty}>
                  Subscribe from a mentor’s profile or browse the{' '}
                  <Text style={styles.subsEmptyEm}>Videos</Text> tab to unlock libraries.
                </Text>
              </View>
            ) : (
              subscriptions.map((row, index) => (
                <SubsRow
                  key={`${row.mentor_id}`}
                  row={row}
                  index={index}
                  replayToken={replayToken}
                  onPress={() => openMentor(row.mentor_id)}
                />
              ))
            )}
            {!subsLoading && (
              <AnimatedPressable
                style={styles.subsExplore}
                onPress={goToVideos}
                hoverScale={1.03}
                pressScale={0.97}
              >
                <MaterialIcons name="play-circle-outline" size={18} color={TEAL} />
                <Text style={styles.subsExploreText}>Browse video library</Text>
              </AnimatedPressable>
            )}
          </View>
        </FadeSlideIn>

        <SectionHeaderRow
          title="Payments & earnings"
          subtitle="Wallet, payouts, and transaction history"
          replayToken={replayToken}
          delay={220}
        />
        <FadeSlideIn replayToken={replayToken} delay={240}>
          <View style={styles.card}>
            <MenuRow
              icon="account-balance-wallet"
              accent="gold"
              label="My Wallet"
              subtitle={!walletLoading ? `Available balance: ${walletLabel}` : 'View balance and withdraw earnings'}
              onPress={() => navigation.navigate(SCREEN_NAMES.Wallet)}
              index={0}
              replayToken={replayToken}
            />
            <MenuRow
              icon="account-balance"
              accent="teal"
              label="Payout Setup"
              subtitle="Configure UPI for mentor withdrawals"
              onPress={() => navigation.navigate(SCREEN_NAMES.PayoutSetup)}
              index={1}
              replayToken={replayToken}
            />
            <MenuRow
              icon="history"
              accent="purple"
              label="Transaction History"
              subtitle="Sessions, subscriptions, and payouts"
              onPress={() => navigation.navigate(SCREEN_NAMES.TransactionHistory)}
              noBorder
              index={2}
              replayToken={replayToken}
            />
          </View>
        </FadeSlideIn>

        <SectionHeaderRow
          title="Content & library"
          subtitle="Your videos and recorded sessions"
          replayToken={replayToken}
          delay={280}
        />
        <FadeSlideIn replayToken={replayToken} delay={300}>
          <View style={styles.card}>
            <MenuRow
              icon="video-library"
              accent="gold"
              label="Recorded Session"
              subtitle="Replay past live sessions"
              onPress={() => navigation.navigate(SCREEN_NAMES.RecordedLectures)}
              index={0}
              replayToken={replayToken}
            />
            <MenuRow
              icon="video-camera-back"
              accent="teal"
              label="My Videos"
              subtitle="Manage your mentor video library"
              onPress={() => navigation.navigate(SCREEN_NAMES.MentorVideos)}
              noBorder
              index={1}
              replayToken={replayToken}
            />
          </View>
        </FadeSlideIn>

        <SectionHeaderRow
          title="Preferences"
          subtitle="Notifications and app diagnostics"
          replayToken={replayToken}
          delay={340}
        />
        <FadeSlideIn replayToken={replayToken} delay={360}>
          <View style={styles.card}>
            <MenuRow
              icon="notifications"
              accent="purple"
              label="Notifications"
              subtitle="Session updates, bookings, and reminders"
              badge={unreadCount}
              onPress={() => navigation.navigate(SCREEN_NAMES.Notifications)}
              index={0}
              replayToken={replayToken}
            />
            <MenuRow
              icon="event"
              accent="gold"
              label="My Bookings"
              subtitle="Upcoming and past sessions"
              onPress={goToBookings}
              noBorder
              index={1}
              replayToken={replayToken}
            />
          </View>
        </FadeSlideIn>

        <SectionHeaderRow
          title="Support & legal"
          subtitle="Help, policies, and sharing"
          replayToken={replayToken}
          delay={400}
        />
        <FadeSlideIn replayToken={replayToken} delay={420}>
          <View style={styles.card}>
            <MenuRow
              icon="contact-support"
              accent="gold"
              label="Help & Support"
              subtitle={`Contact us at ${SUPPORT_EMAIL}`}
              onPress={handleHelpSupport}
              index={0}
              replayToken={replayToken}
            />
            <MenuRow
              icon="privacy-tip"
              accent="purple"
              label="Privacy Policy"
              subtitle="How we handle your data"
              onPress={handlePrivacy}
              index={1}
              replayToken={replayToken}
            />
            <MenuRow
              icon="gavel"
              accent="teal"
              label="Terms of Service"
              subtitle="Usage guidelines and policies"
              onPress={handleTerms}
              index={2}
              replayToken={replayToken}
            />
            <MenuRow
              icon="share"
              accent="gold"
              label="Share Connectiqo"
              subtitle="Invite friends to join the platform"
              onPress={handleShareApp}
              noBorder
              index={3}
              replayToken={replayToken}
            />
          </View>
        </FadeSlideIn>

        <FadeSlideIn replayToken={replayToken} delay={480}>
          <Button
            text="Sign Out"
            onPress={handleLogout}
            variant="goldOutline"
            style={styles.signOutBtn}
          />
        </FadeSlideIn>

        <FadeSlideIn replayToken={replayToken} delay={520}>
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Connectiqo</Text>
            <Text style={styles.footerVersion}>
              Version {APP_VERSION} · {Platform.OS === 'ios' ? 'iOS' : 'Android'}
            </Text>
            <Text style={styles.footerTagline}>Connect · Learn · Grow</Text>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <LoadingOverlay visible={loading} message="Uploading photo…" />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: T.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: T.spacing.lg,
  },
  screenTitle: {
    fontSize: 26,
    color: C.text.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: C.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  headerRefreshBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  secHdrWrap: {
    marginBottom: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
  },
  secHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secHdrTitle: {
    fontSize: 15,
    color: C.text.primary,
    fontWeight: '800',
  },
  secHdrSub: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 3,
    lineHeight: 17,
  },
  secHdrCount: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
  },
  secHdrCountText: {
    fontSize: 12,
    color: PURPLE_LINK,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    padding: T.spacing.lg,
    overflow: 'hidden',
  },
  profileCardWrap: {
    marginBottom: T.spacing.md,
  },
  profileCardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.lg,
  },
  avatarWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarGlowRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: TEAL,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFallback: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.primary.void,
  },
  avatarInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary.void,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  profileMeta: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: 18,
    color: C.text.primary,
    fontWeight: '800',
    marginBottom: 2,
  },
  profileUsername: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: C.text.secondary,
    marginBottom: T.spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: S.accentGold,
    paddingHorizontal: T.spacing.sm,
    paddingVertical: 4,
    borderRadius: T.borderRadius.chip,
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.25)',
  },
  badgeMuted: {
    backgroundColor: S.accentTeal,
    borderColor: 'rgba(94,234,212,0.2)',
    maxWidth: '100%',
  },
  badgeText: {
    fontSize: 11,
    color: GOLD,
    fontWeight: '700',
  },
  badgeTextMuted: {
    color: TEAL,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: T.spacing.lg,
    paddingTop: T.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167,139,250,0.15)',
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickStatLoader: {
    height: 20,
    marginBottom: 4,
  },
  quickStatValue: {
    fontSize: 15,
    color: C.text.primary,
    fontWeight: '800',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 10,
    color: C.text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: T.spacing.md,
    paddingVertical: T.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.25)',
    backgroundColor: S.accentGold,
  },
  editProfileBtnText: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '700',
  },
  card: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    paddingHorizontal: T.spacing.sm,
    marginBottom: T.spacing.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: T.spacing.md,
    paddingHorizontal: T.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.15)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  menuHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(94,234,212,0.1)',
    borderRadius: 10,
  },
  noBorder: { borderBottomWidth: 0 },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    flex: 1,
    minWidth: 0,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  menuLabel: {
    fontSize: 15,
    color: C.text.primary,
    fontWeight: '600',
  },
  menuLabelDestructive: {
    color: C.accent.error,
  },
  menuSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: T.spacing.sm,
  },
  menuBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: 'center',
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: C.text.onAccent,
  },
  signOutBtn: { marginBottom: T.spacing.lg },
  subsCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    padding: T.spacing.lg,
    marginBottom: T.spacing.lg,
  },
  subsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm,
  },
  subsLoadingText: {
    fontSize: 13,
    color: C.text.secondary,
  },
  subsEmptyWrap: {
    alignItems: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm,
  },
  subsEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  subsEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  subsEmpty: {
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  subsEmptyEm: {
    color: TEAL,
    fontWeight: '700',
  },
  subsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.15)',
    gap: T.spacing.md,
  },
  subsAvatarRing: {
    padding: 2,
    borderRadius: 24,
  },
  subsAvatarInner: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  subsAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primary.void,
  },
  subsAvatarPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  subsMeta: { flex: 1, minWidth: 0 },
  subsName: {
    fontSize: 15,
    color: C.text.primary,
    fontWeight: '700',
  },
  subsExpiry: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
  },
  subsExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: T.spacing.md,
    paddingVertical: T.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
    backgroundColor: S.accentTeal,
  },
  subsExploreText: {
    fontSize: 13,
    color: TEAL,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingTop: T.spacing.sm,
    paddingBottom: T.spacing.md,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.secondary,
    letterSpacing: 0.5,
  },
  footerVersion: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 4,
  },
  footerTagline: {
    fontSize: 11,
    color: C.text.disabled,
    marginTop: 2,
    fontStyle: 'italic',
  },
});
