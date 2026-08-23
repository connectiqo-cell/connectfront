import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
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
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill } from '../../theme/surfaceStyles';
import { payoutApi } from '../../api/payoutApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

function getStatusConfig(theme) {
  const C = theme.colors;
  const S = C.surface;
  const PANEL_BG = S.panel;
  const isLight = theme.mode === 'light';
  return {
    active: {
      color: C.accent.success,
      bg: S.accentSuccess,
      border: 'rgba(52,211,153,0.3)',
      icon: 'verified',
      label: 'Active',
      heroGradient: isLight
        ? ['rgba(16,185,129,0.18)', 'rgba(109,74,255,0.08)', PANEL_BG]
        : ['rgba(52,211,153,0.35)', 'rgba(94,234,212,0.18)', PANEL_BG],
      glow: C.accent.success,
      title: 'Payouts are ready',
      subtitle: 'Withdrawals from your wallet will be sent to this UPI ID.',
    },
    not_started: {
      color: C.text.muted,
      bg: softFill(theme),
      border: softBorder(theme),
      icon: 'account-balance',
      label: 'Not set up',
      heroGradient: isLight
        ? ['rgba(109,74,255,0.16)', 'rgba(139,92,246,0.08)', PANEL_BG]
        : ['rgba(124,58,237,0.4)', 'rgba(94,234,212,0.18)', PANEL_BG],
      glow: C.accent.secondary,
      title: 'Set up payouts',
      subtitle: 'Add your UPI ID so withdrawals have somewhere to go.',
    },
  };
}

const PAYOUT_STEPS = [
  { icon: 'payments', text: 'Learner pays when they book your session.' },
  { icon: 'call-split', text: 'Your share is credited after the session completes.' },
  { icon: 'account-balance-wallet', text: 'Request withdrawal from My Wallet (min ₹5,000).' },
  { icon: 'send', text: 'We settle it to your UPI within 1–2 business days.' },
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
  const styles = useThemedStyles(createPayoutStyles);
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

function PulseGlow({ color, size = 72 }) {
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const ringColor = color ?? theme.colors.accent.secondary;
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
          borderColor: ringColor,
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const STATUS_CONFIG = getStatusConfig(theme);
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
  const styles = useThemedStyles(createPayoutStyles);
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const TEAL = C.accent.secondary;
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
          autoCorrect={!keyboardType || keyboardType === 'default'}
          spellCheck={!keyboardType || keyboardType === 'default'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </Animated.View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </Animated.View>
  );
}

function InfoRow({ label, value, mono, index = 0, replayToken = 0 }) {
  const styles = useThemedStyles(createPayoutStyles);
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
  const styles = useThemedStyles(createPayoutStyles);
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const TEAL = C.accent.secondary;
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const B = theme.colors.buttons;
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
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
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
  const styles = useThemedStyles(createPayoutStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const STATUS_CONFIG = getStatusConfig(theme);
  const isLight = theme.mode === 'light';
  const heroFade = isLight
    ? ['transparent', 'rgba(248,249,255,0.92)', PANEL_BG]
    : ['transparent', 'rgba(15,14,42,0.92)', PANEL_BG];
  const { profile } = useAuth();
  const [status, setStatus] = useState('not_started');
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

  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountDisplay, setBankAccountDisplay] = useState('');
  const [ifscDisplay, setIfscDisplay] = useState('');
  const [editMode, setEditMode] = useState(false);

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const isSetUp = status !== 'not_started';

  const startEdit = () => {
    setUpiId(upiIdDisplay);
    setBankAccount(bankAccountDisplay);
    setIfsc(ifscDisplay);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setUpiId(upiIdDisplay);
    setBankAccount(bankAccountDisplay);
    setIfsc(ifscDisplay);
    setEditMode(false);
  };

  const loadStatus = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) return;
      if (!isRefresh && !loadedRef.current) setLoading(true);
      if (isRefresh) setRefreshing(true);
      try {
        const res = await payoutApi.getAccountStatus(profile.id);
        setStatus(res.status || 'not_started');
        setUpiIdDisplay(res.upiId || '');
        setBankAccountDisplay(res.bankAccount || '');
        setIfscDisplay(res.ifsc || '');
        if (res.upiId) setUpiId(prev => prev || res.upiId);
        if (res.bankAccount) setBankAccount(prev => prev || res.bankAccount);
        if (res.ifsc) setIfsc(prev => prev || res.ifsc);
        if (res.accountHolderName) setAccountHolderName(prev => prev || res.accountHolderName);
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
    const hasBank = bankAccount.trim() || ifsc.trim();
    if (!upiId.trim() && !hasBank) {
      Toast.show('Enter a UPI ID or a bank account + IFSC');
      return;
    }
    if (hasBank && (!bankAccount.trim() || !ifsc.trim())) {
      Toast.show('Bank account number and IFSC are both required together');
      return;
    }

    try {
      setSubmitting(true);
      const res = await payoutApi.createLinkedAccount({
        mentorId: profile.id,
        upiId: upiId.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        ifsc: ifsc.trim() || undefined,
        accountHolderName: accountHolderName.trim() || undefined,
      });
      setStatus(res.status || 'active');
      setUpiIdDisplay(res.upiId || upiId.trim());
      setBankAccountDisplay(res.bankAccount || bankAccount.trim());
      setIfscDisplay(res.ifsc || ifsc.trim());
      setEditMode(false);
      Toast.show('Payout details saved.');
    } catch (e) {
      Toast.show(e.message || 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Payout Setup</Text>
            <Text style={styles.headerSubtitle}>Add the UPI ID your withdrawals should go to</Text>
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
            <LinearGradient colors={heroFade} style={styles.heroFade} />

            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <PulseGlow color={statusCfg.glow} size={76} />
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
                  <Text style={styles.secureChipText}>We never share your UPI ID</Text>
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

        {isSetUp && !editMode ? (
          <SectionBlock
            icon="account-balance"
            title="Payout details"
            subtitle="Where withdrawals are sent"
            accent={GOLD}
            accentBg={S.accentGold}
            delay={220}
            replayToken={replayToken}
          >
            {upiIdDisplay ? (
              <InfoRow label="UPI ID" value={upiIdDisplay} index={0} replayToken={replayToken} />
            ) : null}
            {bankAccountDisplay ? (
              <InfoRow label="Bank account" value={`${bankAccountDisplay} · ${ifscDisplay}`} index={1} replayToken={replayToken} />
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <StatusBadge status={status} />
            </View>

            <NoticeCard variant="success">
              <MaterialIcons name="check-circle" size={18} color={C.accent.success} />
              <Text style={styles.noticeSuccessText}>
                Withdrawals you request are settled to this payout method by our team.
              </Text>
            </NoticeCard>

            <WalletLinkRow onPress={() => navigation.navigate(SCREEN_NAMES.Wallet)} />

            <AnimatedPressable
              onPress={startEdit}
              style={styles.editDetailsBtn}
              hoverScale={1.02}
              pressScale={0.97}
            >
              <MaterialIcons name="edit" size={16} color={TEAL} />
              <Text style={styles.editDetailsBtnText}>Edit UPI / bank details</Text>
            </AnimatedPressable>
          </SectionBlock>
        ) : isSetUp && editMode ? (
          <SectionBlock
            icon="edit"
            title="Edit payout details"
            subtitle="Update your UPI ID and/or bank account"
            accent={GOLD}
            accentBg={S.accentGold}
            delay={220}
            replayToken={replayToken}
          >
            <Field
              icon="phone-android"
              label="UPI ID"
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Where withdrawal amounts will be sent"
              index={0}
            />

            <Text style={styles.fieldLabel}>Bank account (for NEFT/IMPS) — optional</Text>
            <Field
              icon="account-balance"
              label="Account number"
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="1234567890"
              keyboardType="number-pad"
              index={1}
            />
            <Field
              icon="pin"
              label="IFSC code"
              value={ifsc}
              onChangeText={t => setIfsc(t.toUpperCase())}
              placeholder="HDFC0001234"
              autoCapitalize="characters"
              index={2}
            />
            <Field
              icon="badge"
              label="Account holder name"
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="As per bank records"
              index={3}
            />

            <View style={styles.editActionsRow}>
              <AnimatedPressable
                onPress={cancelEdit}
                style={styles.cancelEditBtn}
                disabled={submitting}
                hoverScale={1.02}
                pressScale={0.97}
              >
                <Text style={styles.cancelEditBtnText}>Cancel</Text>
              </AnimatedPressable>
              <View style={{ flex: 1 }}>
                <GradientButton
                  label={submitting ? 'Saving…' : 'Save changes'}
                  icon="account-balance"
                  onPress={handleSetup}
                  loading={submitting}
                  disabled={submitting}
                />
              </View>
            </View>
          </SectionBlock>
        ) : (
          <SectionBlock
            icon="edit"
            title="Add your payout details"
            subtitle="UPI, bank account, or both — used to send your withdrawals"
            accent={PURPLE_LINK}
            accentBg={S.accentViolet}
            delay={220}
            replayToken={replayToken}
          >
            <Field
              icon="phone-android"
              label="UPI ID"
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              keyboardType="email-address"
              autoCapitalize="none"
              hint="Where withdrawal amounts will be sent"
              index={0}
            />

            <Text style={styles.fieldLabel}>Bank account (for NEFT/IMPS) — optional</Text>
            <Field
              icon="account-balance"
              label="Account number"
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="1234567890"
              keyboardType="number-pad"
              index={1}
            />
            <Field
              icon="pin"
              label="IFSC code"
              value={ifsc}
              onChangeText={t => setIfsc(t.toUpperCase())}
              placeholder="HDFC0001234"
              autoCapitalize="characters"
              index={2}
            />
            <Field
              icon="badge"
              label="Account holder name"
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              placeholder="As per bank records"
              index={3}
            />

            <HoverHighlight style={styles.trustNote} hoverScale={1.01} pressScale={0.99}>
              <MaterialIcons name="shield" size={16} color={TEAL} />
              <Text style={styles.trustNoteText}>
                We never share your payout details outside the payout team.
              </Text>
            </HoverHighlight>

            <GradientButton
              label={submitting ? 'Saving…' : 'Save payout details'}
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
              Payouts are settled manually by our team via UPI/IMPS/NEFT within 1–2 business days.
              Platform fee applies per session as shown at booking.
            </Text>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading payout status…" />
    </SafeScreen>
  );
}

function createPayoutStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  return StyleSheet.create({
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
    backgroundColor: S.accentViolet,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border.default,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.accent.primary,
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
    backgroundColor: softFill(theme),
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
    borderColor: softBorder(theme),
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
    borderColor: softBorder(theme),
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

  editDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    marginTop: T.spacing.sm,
    paddingVertical: T.spacing.sm + 2,
    paddingHorizontal: T.spacing.md,
    borderRadius: 12,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.3)',
  },
  editDetailsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEAL,
  },
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: T.spacing.sm,
    marginTop: T.spacing.xs,
  },
  cancelEditBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: softBorder(theme),
  },
  cancelEditBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text.secondary,
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
    borderColor: softBorder(theme),
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
}