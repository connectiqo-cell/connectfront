import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Linking,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { payoutApi } from '../../api/payoutApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';
const INPUT_BG = '#0f0e2a';

const STATUS_CONFIG = {
  active: {
    color: C.accent.success,
    bg: S.accentSuccess,
    border: 'rgba(52,211,153,0.3)',
    icon: 'verified',
    label: 'Active',
    heroGradient: ['rgba(52,211,153,0.35)', 'rgba(94,234,212,0.18)', PANEL_BG],
    glow: C.accent.success,
    title: 'Payouts are live',
    subtitle: 'Withdrawals from your wallet will be sent to your UPI.',
  },
  pending: {
    color: C.accent.warning,
    bg: S.accentWarning,
    border: 'rgba(251,191,36,0.35)',
    icon: 'hourglass-top',
    label: 'KYC pending',
    heroGradient: ['rgba(251,191,36,0.28)', 'rgba(167,139,250,0.15)', PANEL_BG],
    glow: C.accent.warning,
    title: 'Almost there',
    subtitle: 'Complete Razorpay KYC to activate payouts to your UPI.',
  },
  not_started: {
    color: C.text.muted,
    bg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.12)',
    icon: 'account-balance',
    label: 'Not set up',
    heroGradient: ['rgba(124,58,237,0.4)', 'rgba(94,234,212,0.18)', PANEL_BG],
    glow: TEAL,
    title: 'Set up payouts',
    subtitle: 'Link your UPI so session earnings can reach your bank.',
  },
};

const PAYOUT_STEPS = [
  { icon: 'payments', text: 'Learner pays when they book your session.' },
  { icon: 'call-split', text: 'Your share is credited after the session completes.' },
  { icon: 'account-balance-wallet', text: 'Request withdrawal from My Wallet (min ₹5,000).' },
  { icon: 'send', text: 'Funds arrive on your UPI within 1–2 business days.' },
];

function runEntrance(opacity, translateY, delay = 0) {
  opacity.setValue(0);
  translateY.setValue(14);
  Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}

function FadeSlideIn({ children, delay = 0, style, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, delay);
      return;
    }
    if (replayToken > 0) runEntrance(opacity, translateY, delay);
  }, [replayToken, delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function HoverHighlight({ children, style, onPress, disabled, pressScale = 0.98, hoverScale = 1.02 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
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

  const setHighlight = active => {
    Animated.timing(highlight, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const highlightOpacity = highlight.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const content = (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Animated.View pointerEvents="none" style={[styles.hoverHighlight, { opacity: highlightOpacity }]} />
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        springTo(pressScale);
        setHighlight(true);
      }}
      onPressOut={() => {
        springTo(hovered.current ? hoverScale : 1);
        if (!hovered.current) setHighlight(false);
      }}
      onHoverIn={() => {
        if (disabled) return;
        hovered.current = true;
        springTo(hoverScale);
        setHighlight(true);
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
        setHighlight(false);
      }}
    >
      {content}
    </Pressable>
  );
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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && springTo(pressScale)}
      onPressOut={() => !disabled && springTo(hovered.current ? hoverScale : 1)}
      onHoverIn={() => {
        if (disabled) return;
        hovered.current = true;
        springTo(hoverScale);
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function PulseGlow({ color = TEAL, size = 72 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseGlow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        },
      ]}
    />
  );
}

function PulseBadge({ children, style, animate = true }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, pulse]);

  return (
    <Animated.View style={[style, animate && { transform: [{ scale: pulse }] }]}>
      {children}
    </Animated.View>
  );
}

function StatusBadge({ status, large = false }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const inner = (
    <View style={[styles.statusBadge, large && styles.statusBadgeLarge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <MaterialIcons name={cfg.icon} size={large ? 15 : 13} color={cfg.color} />
      <Text style={[styles.statusBadgeText, large && styles.statusBadgeTextLarge, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
  if (status === 'pending') return <PulseBadge animate>{inner}</PulseBadge>;
  return inner;
}

function AnimatedHeroTitle({ text }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [text, scale, opacity]);

  return (
    <Animated.Text style={[styles.heroTitle, { opacity, transform: [{ scale }] }]}>{text}</Animated.Text>
  );
}

function SectionBlock({ icon, title, subtitle, accent, accentBg, children, delay = 0, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const hasEntered = useRef(false);

  const play = useCallback(() => {
    opacity.setValue(0);
    translateY.setValue(14);
    runEntrance(opacity, translateY, delay);
  }, [delay, opacity, translateY]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) play();
  }, [replayToken, play]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconScale]);

  return (
    <Animated.View style={[styles.sectionBlock, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.sectionHeader}>
        <Animated.View
          style={[styles.sectionIcon, { backgroundColor: accentBg || S.accentViolet, transform: [{ scale: iconScale }] }]}
        >
          <MaterialIcons name={icon} size={16} color={accent || PURPLE_LINK} />
        </Animated.View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <HoverHighlight style={styles.sectionCard} hoverScale={1.005} pressScale={0.998}>
        {children}
      </HoverHighlight>
    </Animated.View>
  );
}

function StepRow({ icon, text, index = 0, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-10)).current;
  const hasEntered = useRef(false);

  const play = useCallback(() => {
    opacity.setValue(0);
    translateX.setValue(-10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 80 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 300, delay: 80 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateX]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) play();
  }, [replayToken, play]);

  return (
    <HoverHighlight style={styles.stepRowWrap} hoverScale={1.01} pressScale={0.99}>
      <Animated.View style={[styles.stepRow, { opacity, transform: [{ translateX }] }]}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepIcon}>
          <MaterialIcons name={icon} size={17} color={TEAL} />
        </View>
        <Text style={styles.stepText}>{text}</Text>
      </Animated.View>
    </HoverHighlight>
  );
}

function Field({ icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize, hint, index = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const borderGlow = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay: 100 + index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: 100 + index * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  useEffect(() => {
    Animated.timing(borderGlow, { toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [focused, borderGlow]);

  const borderColor = borderGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(167,139,250,0.22)', 'rgba(94,234,212,0.55)'],
  });

  return (
    <Animated.View style={[styles.fieldBlock, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View style={[styles.inputWrap, { borderColor }]}>
        <MaterialIcons name={icon} size={18} color={focused ? TEAL : C.text.muted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.text.muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'sentences'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </Animated.View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </Animated.View>
  );
}

function InfoRow({ label, value, mono, index = 0, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(10)).current;
  const hasEntered = useRef(false);

  const play = useCallback(() => {
    opacity.setValue(0);
    translateX.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay: 60 + index * 50, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 280, delay: 60 + index * 50, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateX]);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) play();
  }, [replayToken, play]);

  return (
    <HoverHighlight style={styles.infoRowWrap} hoverScale={1.005} pressScale={0.998}>
      <Animated.View style={[styles.infoRow, { opacity, transform: [{ translateX }] }]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={2}>
          {value}
        </Text>
      </Animated.View>
    </HoverHighlight>
  );
}

function NoticeCard({ variant, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const cardStyle = variant === 'success' ? styles.noticeSuccess : styles.noticeWarning;

  return (
    <HoverHighlight style={styles.noticeWrap} hoverScale={1.01} pressScale={0.99}>
      <Animated.View style={[cardStyle, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>
    </HoverHighlight>
  );
}

function WalletLinkRow({ onPress }) {
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevron, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(chevron, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [chevron]);

  const nudge = chevron.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });

  return (
    <HoverHighlight onPress={onPress} style={styles.walletLink} hoverScale={1.02} pressScale={0.98}>
      <MaterialIcons name="account-balance-wallet" size={18} color={TEAL} />
      <Text style={styles.walletLinkText}>Go to My Wallet</Text>
      <Animated.View style={{ transform: [{ translateX: nudge }] }}>
        <MaterialIcons name="chevron-right" size={20} color={C.text.muted} />
      </Animated.View>
    </HoverHighlight>
  );
}

function GradientButton({ label, icon, onPress, disabled, loading, colors, textColor, borderColor }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.gradientBtn, (disabled || loading) && styles.gradientBtnDisabled]}
      hoverScale={1.02}
      pressScale={0.97}
    >
      <LinearGradient
        colors={colors || B.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradientBtnInner, borderColor && { borderColor }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor || B.primaryText} />
        ) : (
          <>
            {icon ? <MaterialIcons name={icon} size={18} color={textColor || B.primaryText} /> : null}
            <Text style={[styles.gradientBtnText, { color: textColor || B.primaryText }]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

function RotatingRefreshIcon({ spinning }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spinning) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialIcons name="refresh" size={20} color={TEAL} />
    </Animated.View>
  );
}

export default function PayoutSetupScreen({ navigation }) {
  const { profile } = useAuth();
  const [status, setStatus] = useState('not_started');
  const [accountId, setAccountId] = useState(null);
  const [kycUrl, setKycUrl] = useState(null);
  const [upiIdDisplay, setUpiIdDisplay] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const loadedRef = useRef(false);
  const bannerShimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bannerShimmer, {
        toValue: 1,
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [bannerShimmer]);

  const bannerShimmerX = bannerShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 280],
  });

  const [legalName, setLegalName] = useState(profile?.name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [upiId, setUpiId] = useState('');

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const isSetUp = status !== 'not_started';

  useEffect(() => {
    if (profile?.name) setLegalName(prev => prev || profile.name);
    if (profile?.email) setEmail(prev => prev || profile.email);
  }, [profile?.name, profile?.email]);

  const loadStatus = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) return;
      if (!isRefresh && !loadedRef.current) setLoading(true);
      if (isRefresh) setRefreshing(true);
      try {
        const res = await payoutApi.getAccountStatus(profile.id);
        setStatus(res.status || 'not_started');
        setAccountId(res.accountId || null);
        setKycUrl(res.kycUrl || null);
        setUpiIdDisplay(res.upiId || '');
        if (res.upiId) setUpiId(prev => prev || res.upiId);
        loadedRef.current = true;
      } catch {
        setStatus('not_started');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.id],
  );

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) loadStatus(loadedRef.current);
    }, [profile?.id, loadStatus]),
  );

  const handleRefresh = async () => {
    await loadStatus(true);
    setReplayToken(t => t + 1);
  };

  const handleSetup = async () => {
    if (!legalName.trim()) {
      Toast.show('Enter your legal / business name');
      return;
    }
    if (!email.trim()) {
      Toast.show('Enter your email');
      return;
    }
    if (!upiId.trim()) {
      Toast.show('Enter your UPI ID (e.g. name@upi)');
      return;
    }

    try {
      setSubmitting(true);
      const res = await payoutApi.createLinkedAccount({
        mentorId: profile.id,
        legalName: legalName.trim(),
        email: email.trim(),
        upiId: upiId.trim(),
      });
      setAccountId(res.accountId);
      setKycUrl(res.kycUrl);
      setStatus('pending');
      setUpiIdDisplay(upiId.trim());
      Toast.show('Account created! Complete KYC to activate payouts.');
    } catch (e) {
      Toast.show(e.message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenKyc = () => {
    if (!kycUrl) return;
    Linking.openURL(kycUrl).catch(() => Toast.show('Could not open KYC link'));
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payout Setup</Text>
            <Text style={styles.headerSubtitle}>Connect UPI & complete KYC for mentor earnings</Text>
          </View>
          <AnimatedPressable
            onPress={handleRefresh}
            style={styles.refreshBtn}
            hoverScale={1.08}
            pressScale={0.92}
            disabled={refreshing}
          >
            {refreshing ? <RotatingRefreshIcon spinning /> : <MaterialIcons name="refresh" size={20} color={TEAL} />}
          </AnimatedPressable>
        </View>
      </FadeSlideIn>
      </StackScreenHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} colors={[TEAL]} />
        }
      >
        <FadeSlideIn delay={60} replayToken={replayToken}>
          <HoverHighlight style={styles.heroCard} hoverScale={1.005} pressScale={0.998}>
            <LinearGradient
              colors={statusCfg.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.heroShimmer, { transform: [{ translateX: bannerShimmerX }] }]}
            />
            <LinearGradient colors={['transparent', 'rgba(15,14,42,0.92)', PANEL_BG]} style={styles.heroFade} />

            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                {(status === 'pending' || status === 'active' || status === 'not_started') && (
                  <PulseGlow color={statusCfg.glow} size={76} />
                )}
                <LinearGradient colors={B.premiumGradient} style={styles.heroIconRing}>
                  <MaterialIcons name={statusCfg.icon} size={28} color={GOLD} />
                </LinearGradient>
              </View>
              <View style={styles.heroText}>
                <AnimatedHeroTitle text={statusCfg.title} />
                <Text style={styles.heroSubtitle}>{statusCfg.subtitle}</Text>
              </View>
            </View>

            <View style={styles.heroFooter}>
              <StatusBadge status={status} large />
              {status === 'active' ? (
                <PulseBadge style={styles.secureChip} animate>
                  <MaterialIcons name="lock" size={12} color={TEAL} />
                  <Text style={styles.secureChipText}>Secured by Razorpay</Text>
                </PulseBadge>
              ) : null}
            </View>
          </HoverHighlight>
        </FadeSlideIn>

        <SectionBlock
          icon="route"
          title="How payouts work"
          subtitle="From session booking to your UPI"
          accent={TEAL}
          accentBg={S.accentTeal}
          delay={140}
          replayToken={replayToken}
        >
          {PAYOUT_STEPS.map((step, index) => (
            <StepRow key={step.icon} icon={step.icon} text={step.text} index={index} replayToken={replayToken} />
          ))}
        </SectionBlock>

        {isSetUp ? (
          <SectionBlock
            icon="account-balance"
            title="Account details"
            subtitle="Your linked Razorpay payout account"
            accent={GOLD}
            accentBg={S.accentGold}
            delay={220}
            replayToken={replayToken}
          >
            {accountId ? (
              <InfoRow label="Account ID" value={accountId} mono index={0} replayToken={replayToken} />
            ) : null}
            {upiIdDisplay ? (
              <InfoRow label="UPI ID" value={upiIdDisplay} index={1} replayToken={replayToken} />
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <StatusBadge status={status} />
            </View>

            {status === 'pending' ? (
              <NoticeCard variant="warning">
                <MaterialIcons name="info-outline" size={18} color={C.accent.warning} />
                <Text style={styles.noticeWarningText}>
                  Complete KYC on Razorpay to activate payouts. This is a one-time verification required by law.
                </Text>
              </NoticeCard>
            ) : null}

            {status === 'active' ? (
              <NoticeCard variant="success">
                <MaterialIcons name="check-circle" size={18} color={C.accent.success} />
                <Text style={styles.noticeSuccessText}>
                  Your account is active. Withdraw earnings anytime from My Wallet.
                </Text>
              </NoticeCard>
            ) : null}

            {status !== 'active' && kycUrl && accountId ? (
              <GradientButton
                label="Complete KYC on Razorpay"
                icon="open-in-new"
                onPress={handleOpenKyc}
                colors={B.warningGradient || [C.accent.warning, GOLD]}
                textColor={B.warningGradientText || B.primaryText}
                borderColor="rgba(251,191,36,0.4)"
              />
            ) : null}

            {status === 'active' ? (
              <WalletLinkRow onPress={() => navigation.navigate(SCREEN_NAMES.Wallet)} />
            ) : null}
          </SectionBlock>
        ) : (
          <SectionBlock
            icon="edit"
            title="Create payout account"
            subtitle="Details are sent securely to Razorpay"
            accent={PURPLE_LINK}
            accentBg={S.accentViolet}
            delay={220}
            replayToken={replayToken}
          >
            <Field
              icon="badge"
              label="Legal / business name"
              value={legalName}
              onChangeText={setLegalName}
              placeholder="Your full name or business name"
              hint="Must match your bank / UPI account holder name"
              index={0}
            />
            <Field
              icon="email"
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Used for Razorpay account notifications"
              index={1}
            />
            <Field
              icon="phone-android"
              label="UPI ID"
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Where withdrawal amounts will be sent"
              index={2}
            />

            <HoverHighlight style={styles.trustNote} hoverScale={1.01} pressScale={0.99}>
              <MaterialIcons name="shield" size={16} color={TEAL} />
              <Text style={styles.trustNoteText}>
                After setup you'll complete a quick KYC on Razorpay. We never store your banking password.
              </Text>
            </HoverHighlight>

            <GradientButton
              label={submitting ? 'Creating account…' : 'Create payout account'}
              icon="account-balance"
              onPress={handleSetup}
              loading={submitting}
              disabled={submitting}
            />
          </SectionBlock>
        )}

        <FadeSlideIn delay={320} replayToken={replayToken}>
          <View style={styles.footerNote}>
            <MaterialIcons name="info-outline" size={15} color={C.text.muted} />
            <Text style={styles.footerNoteText}>
              Payouts are processed by Razorpay. Platform fee applies per session as shown at booking.
            </Text>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading payout status…" />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.18)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.lg,
    paddingBottom: T.spacing.xxxl,
  },
  hoverHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.1)',
    borderRadius: 18,
  },
  pulseGlow: {
    position: 'absolute',
    borderWidth: 2,
  },

  heroCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    backgroundColor: PANEL_BG,
    padding: T.spacing.lg,
    marginBottom: T.spacing.lg,
  },
  heroShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ skewX: '-16deg' }],
  },
  heroBanner: { ...StyleSheet.absoluteFillObject },
  heroFade: { ...StyleSheet.absoluteFillObject },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginBottom: T.spacing.md,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconRing: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text.primary,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.spacing.sm,
    flexWrap: 'wrap',
  },
  secureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.3)',
  },
  secureChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEAL,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: T.borderRadius.round,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextLarge: {
    fontSize: 13,
  },

  sectionBlock: { marginBottom: T.spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
    paddingHorizontal: 2,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    padding: T.spacing.lg,
    gap: T.spacing.sm,
    overflow: 'hidden',
  },

  stepRowWrap: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    paddingVertical: 6,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: PURPLE_LINK,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 18,
  },

  infoRowWrap: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.spacing.md,
    paddingVertical: T.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(167,139,250,0.15)',
  },
  infoLabel: {
    fontSize: 13,
    color: C.text.muted,
  },
  infoValue: {
    fontSize: 13,
    color: C.text.primary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  infoValueMono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },

  noticeWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: T.spacing.xs,
  },
  noticeWarning: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    backgroundColor: S.accentWarning,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
    borderRadius: 12,
    padding: T.spacing.md,
  },
  noticeWarningText: {
    flex: 1,
    fontSize: 13,
    color: C.accent.warning,
    lineHeight: 18,
  },
  noticeSuccess: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
    borderRadius: 12,
    padding: T.spacing.md,
  },
  noticeSuccessText: {
    flex: 1,
    fontSize: 13,
    color: C.accent.success,
    lineHeight: 18,
  },

  walletLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginTop: T.spacing.sm,
    paddingVertical: T.spacing.sm,
    paddingHorizontal: T.spacing.md,
    borderRadius: 12,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
    overflow: 'hidden',
  },
  walletLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: TEAL,
  },

  fieldBlock: { marginBottom: T.spacing.sm },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE_LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 4,
    lineHeight: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    paddingHorizontal: T.spacing.md,
  },
  inputIcon: { marginRight: T.spacing.sm },
  input: {
    flex: 1,
    paddingVertical: T.spacing.sm + 2,
    color: C.text.primary,
    fontSize: 15,
  },

  trustNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.22)',
    borderRadius: 12,
    padding: T.spacing.md,
    marginTop: T.spacing.xs,
    marginBottom: T.spacing.sm,
  },
  trustNoteText: {
    flex: 1,
    fontSize: 12,
    color: C.text.secondary,
    lineHeight: 17,
  },

  gradientBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: T.spacing.xs,
  },
  gradientBtnDisabled: { opacity: 0.7 },
  gradientBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: T.spacing.md,
    borderWidth: 1,
    borderColor: B.primaryBorder,
  },
  gradientBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 12,
    color: C.text.muted,
    lineHeight: 17,
  },
});
