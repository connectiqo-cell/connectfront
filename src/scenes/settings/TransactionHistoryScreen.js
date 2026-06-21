import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import { bookingApi } from '../../api/bookingApi';
import { videoApi } from '../../api/videoApi';

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
  completed: { label: 'Completed', color: C.accent.success, bg: S.accentSuccess },
  confirmed: { label: 'Confirmed', color: C.accent.info, bg: 'rgba(56,189,248,0.12)' },
  pending: { label: 'Pending', color: C.accent.warning, bg: S.accentWarning },
  cancelled: { label: 'Cancelled', color: C.accent.error, bg: 'rgba(248,113,113,0.12)' },
  active: { label: 'Active', color: TEAL, bg: S.accentTeal },
  expired: { label: 'Expired', color: C.accent.error, bg: 'rgba(248,113,113,0.12)' },
};

const TX_TYPE = {
  SESSION_EARNED: 'session_earned',
  SESSION_PAID: 'session_paid',
  SUBSCRIPTION: 'subscription',
};

const fmt = n =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

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

function PulseGlow({ color = TEAL, size = 68 }) {
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

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

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
          opacity: glowOpacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function AnimatedBalanceText({ value, style, replayToken = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, replayToken, scale, opacity]);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ scale }] }]}>
      {value}
    </Animated.Text>
  );
}

function PulseBadge({ children, style }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
  }, [pulse]);

  return (
    <Animated.View style={[style, { transform: [{ scale: pulse }] }]}>
      {children}
    </Animated.View>
  );
}

function HoverHighlight({
  children,
  style,
  onPress,
  disabled,
  pressScale = 0.98,
  hoverScale = 1.02,
  highlightRadius = 18,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const hovered = useRef(false);

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
  };

  const highlightOpacity = highlight.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const content = (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverHighlight, { opacity: highlightOpacity, borderRadius: highlightRadius }]}
      />
      {children}
    </Animated.View>
  );

  if (!onPress) {
    return (
      <Pressable
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

function AnimatedPressable({ children, style, onPress, disabled, hoverScale = 1.06, pressScale = 0.94 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const springTo = toValue => {
    Animated.spring(scale, { toValue, friction: 7, tension: 260, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && springTo(pressScale)}
      onPressOut={() => !disabled && springTo(hovered.current ? hoverScale : 1)}
      onHoverIn={() => { if (!disabled) { hovered.current = true; springTo(hoverScale); } }}
      onHoverOut={() => { hovered.current = false; springTo(1); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
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

function SectionBlock({ icon, title, subtitle, accent, accentBg, children, delay = 0, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const iconBob = useRef(new Animated.Value(0)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, delay);
      return;
    }
    if (replayToken > 0) runEntrance(opacity, translateY, delay);
  }, [replayToken, delay, opacity, translateY]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconBob, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconBob, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconBob]);

  const iconTranslateY = iconBob.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <Animated.View style={[styles.sectionBlock, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.sectionHeader}>
        <Animated.View
          style={[
            styles.sectionIcon,
            { backgroundColor: accentBg || S.accentViolet, transform: [{ translateY: iconTranslateY }] },
          ]}
        >
          <MaterialIcons name={icon} size={16} color={accent || PURPLE_LINK} />
        </Animated.View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </Animated.View>
  );
}

function StatTile({ icon, label, value, color, accentBg, delay = 0, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const hasEntered = useRef(false);

  const play = useCallback(() => {
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 180,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale]);

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
        Animated.timing(iconScale, {
          toValue: 1.12,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [iconScale]);

  return (
    <HoverHighlight style={styles.statTileWrap} hoverScale={1.04} pressScale={0.97} highlightRadius={14}>
      <Animated.View style={[styles.statTile, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={[styles.statIconWrap, { backgroundColor: accentBg, transform: [{ scale: iconScale }] }]}>
          <MaterialIcons name={icon} size={18} color={color} />
        </Animated.View>
        <Text style={[styles.statValue, { color }]} numberOfLines={1}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Animated.View>
    </HoverHighlight>
  );
}

function statusConfig(status) {
  return STATUS_CONFIG[status] || { label: status, color: C.text.muted, bg: S.accentViolet };
}

function getSessionDate(booking) {
  return booking?.availability_slots?.date || booking?.created_at;
}

function normalizeTransactions(mentorTx, learnerTx, videoSubs) {
  const items = [];

  mentorTx.forEach(booking => {
    const price = booking?.mentor_profiles?.price_per_hour ?? 0;
    const status = booking?.status || 'pending';
    const dateRaw = getSessionDate(booking) || booking?.created_at;
    items.push({
      id: `earned_${booking.id}`,
      type: TX_TYPE.SESSION_EARNED,
      person: booking?.profiles,
      dateRaw,
      time: booking?.availability_slots?.start_time,
      amount: status === 'cancelled' ? 0 : price,
      status,
      sortDate: new Date(dateRaw || 0),
    });
  });

  learnerTx.forEach(booking => {
    const price = booking?.mentor_profiles?.price_per_hour ?? 0;
    const status = booking?.status || 'pending';
    const dateRaw = getSessionDate(booking) || booking?.created_at;
    items.push({
      id: `paid_${booking.id}`,
      type: TX_TYPE.SESSION_PAID,
      person: booking?.profiles,
      dateRaw,
      time: booking?.availability_slots?.start_time,
      amount: status === 'cancelled' ? 0 : price,
      status,
      sortDate: new Date(dateRaw || 0),
    });
  });

  videoSubs.forEach(sub => {
    const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
    items.push({
      id: `sub_${sub.id}`,
      type: TX_TYPE.SUBSCRIPTION,
      person: sub.profiles,
      dateRaw: sub.unlocked_at,
      amount: sub.amount_paid ?? 0,
      status: isExpired ? 'expired' : 'active',
      expiresAt: sub.expires_at,
      sortDate: new Date(sub.unlocked_at || 0),
    });
  });

  return items.sort((a, b) => b.sortDate - a.sortDate);
}

function formatDateLabel(item) {
  if (!item.dateRaw) return '—';
  const base = moment(item.dateRaw);
  if (!base.isValid()) return '—';
  if (item.time) {
    const [h, m] = item.time.split(':');
    return base.clone().hour(parseInt(h, 10)).minute(parseInt(m, 10)).format('DD MMM · hh:mm A');
  }
  return base.format('DD MMM YYYY');
}

function TransactionRow({ item, index = 0, replayToken = 0 }) {
  const isCredit = item.type === TX_TYPE.SESSION_EARNED;
  const isSubscription = item.type === TX_TYPE.SUBSCRIPTION;
  const cfg = statusConfig(item.status);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;
  const hasEntered = useRef(false);
  const isRecent = item.dateRaw && moment(item.dateRaw).isAfter(moment().subtract(7, 'days'));

  const typeMeta = (() => {
    if (isSubscription) {
      return {
        icon: 'videocam',
        iconBg: S.accentTeal,
        iconColor: TEAL,
        title: 'Video library',
        amountLabel: 'Subscribed',
      };
    }
    if (isCredit) {
      return {
        icon: 'south-west',
        iconBg: S.accentSuccess,
        iconColor: C.accent.success,
        title: 'Session earning',
        amountLabel: 'Received',
      };
    }
    return {
      icon: 'north-east',
      iconBg: S.accentViolet,
      iconColor: PURPLE_LINK,
      title: 'Session payment',
      amountLabel: 'Paid',
    };
  })();

  const amountColor = item.status === 'cancelled'
    ? C.text.muted
    : isCredit
      ? C.accent.success
      : GOLD;

  const amountPrefix = item.status === 'cancelled' ? '' : isCredit ? '+' : '−';

  useEffect(() => {
    const delay = 60 + index * 50;
    const play = () => {
      opacity.setValue(0);
      translateX.setValue(-12);
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
    };
    if (!hasEntered.current) {
      hasEntered.current = true;
      play();
      return;
    }
    if (replayToken > 0) play();
  }, [replayToken, index, opacity, translateX]);

  const subtitle = item.person?.name || 'Unknown';
  const dateLabel = formatDateLabel(item);
  const expiryNote = isSubscription && item.expiresAt
    ? item.status === 'expired'
      ? ' · Expired'
      : ` · Expires ${moment(item.expiresAt).format('DD MMM')}`
    : '';

  return (
    <HoverHighlight style={styles.txRow} hoverScale={1.01} pressScale={0.99} highlightRadius={12}>
      <Animated.View style={[styles.txRowInner, { opacity, transform: [{ translateX }] }]}>
        <View style={[styles.txIcon, { backgroundColor: typeMeta.iconBg }]}>
          <MaterialIcons name={typeMeta.icon} size={16} color={typeMeta.iconColor} />
        </View>

        <View style={styles.txBody}>
          <View style={styles.txTitleRow}>
            <Text style={styles.txTitle} numberOfLines={1}>{typeMeta.title}</Text>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={styles.txPerson} numberOfLines={1}>{subtitle}</Text>
          <Text style={styles.txDate}>{dateLabel}{expiryNote}</Text>
        </View>

        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {amountPrefix}{fmt(item.amount)}
          </Text>
          <Text style={styles.txAmountSub}>{typeMeta.amountLabel}</Text>
          {isRecent ? (
            <PulseBadge style={styles.recentBadge}>
              <Text style={styles.recentBadgeText}>Recent</Text>
            </PulseBadge>
          ) : null}
        </View>
      </Animated.View>
    </HoverHighlight>
  );
}

function EmptyState() {
  const float = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, opacity]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <Animated.View style={[styles.emptyState, { opacity }]}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY }] }]}>
        <PulseGlow color={PURPLE_LINK} size={72} />
        <MaterialIcons name="receipt-long" size={30} color={PURPLE_LINK} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No transactions yet</Text>
      <Text style={styles.emptySubtitle}>
        Book a session, host a session, or subscribe to a video library — your activity will appear here.
      </Text>
    </Animated.View>
  );
}

export default function TransactionHistoryScreen({ navigation }) {
  const { profile } = useAuth();
  const [mentorTx, setMentorTx] = useState([]);
  const [learnerTx, setLearnerTx] = useState([]);
  const [videoSubs, setVideoSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [mentorRes, learnerRes, subsRes] = await Promise.allSettled([
      bookingApi.getTransactionsAsMentor(profile.id),
      bookingApi.getTransactionsAsLearner(profile.id),
      videoApi.getLearnerSubscriptions(profile.id),
    ]);

    if (mentorRes.status === 'fulfilled') setMentorTx(mentorRes.value);
    else console.error('[TransactionHistory] mentor fetch failed:', mentorRes.reason?.message);

    if (learnerRes.status === 'fulfilled') setLearnerTx(learnerRes.value);
    else console.error('[TransactionHistory] learner fetch failed:', learnerRes.reason?.message);

    if (subsRes.status === 'fulfilled') setVideoSubs(subsRes.value);
    else console.error('[TransactionHistory] subs fetch failed:', subsRes.reason?.message);

    loadedRef.current = true;
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!loadedRef.current) setLoading(true);
          await load();
        } catch (err) {
          if (!cancelled) {
            console.error(err);
            Toast.show('Failed to load transactions');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      setReplayToken(t => t + 1);
    } catch {
      Toast.show('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const transactions = useMemo(
    () => normalizeTransactions(mentorTx, learnerTx, videoSubs),
    [mentorTx, learnerTx, videoSubs],
  );

  const { totalReceived, totalSpent } = useMemo(() => {
    let received = 0;
    let spent = 0;

    mentorTx
      .filter(b => b.status === 'completed')
      .forEach(b => { received += b?.mentor_profiles?.price_per_hour || 0; });

    learnerTx
      .filter(b => b.status === 'completed' || b.status === 'confirmed')
      .forEach(b => { spent += b?.mentor_profiles?.price_per_hour || 0; });

    videoSubs.forEach(s => { spent += s.amount_paid || 0; });

    return { totalReceived: received, totalSpent: spent };
  }, [mentorTx, learnerTx, videoSubs]);

  const netFlow = totalReceived - totalSpent;

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Transaction history</Text>
            <Text style={styles.headerSubtitle}>Sessions, earnings & video subscriptions</Text>
          </View>
          <AnimatedPressable
            onPress={handleRefresh}
            style={styles.refreshBtn}
            hoverScale={1.08}
            pressScale={0.92}
            disabled={refreshing}
          >
            {refreshing ? (
              <RotatingRefreshIcon spinning />
            ) : (
              <MaterialIcons name="refresh" size={20} color={TEAL} />
            )}
          </AnimatedPressable>
        </View>
      </FadeSlideIn>
      </StackScreenHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} colors={[TEAL]} />
        }
      >
        <FadeSlideIn delay={60} replayToken={replayToken}>
          <HoverHighlight style={styles.heroCard} hoverScale={1.005} pressScale={0.998} highlightRadius={18}>
            <LinearGradient
              colors={['rgba(124,58,237,0.45)', 'rgba(94,234,212,0.22)', PANEL_BG]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBanner}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.heroShimmer, { transform: [{ translateX: bannerShimmerX }] }]}
            />
            <LinearGradient
              colors={['transparent', 'rgba(15,14,42,0.9)', PANEL_BG]}
              style={styles.heroFade}
            />

            <View style={styles.heroTopRow}>
              <View style={styles.heroIconWrap}>
                <PulseGlow color={GOLD} size={72} />
                <View style={styles.heroIconRing}>
                  <LinearGradient colors={B.premiumGradient} style={styles.heroIconGrad}>
                    <MaterialIcons name="receipt-long" size={24} color={GOLD} />
                  </LinearGradient>
                </View>
              </View>
              <View style={styles.heroMeta}>
                <Text style={styles.heroLabel}>Net activity</Text>
                <AnimatedBalanceText
                  value={`${netFlow >= 0 ? '+' : '−'}${fmt(Math.abs(netFlow))}`}
                  style={[styles.heroAmount, netFlow >= 0 && { color: C.accent.success }]}
                  replayToken={replayToken}
                />
                <Text style={styles.heroNote}>
                  {transactions.length} transaction{transactions.length === 1 ? '' : 's'} on record
                </Text>
              </View>
            </View>
          </HoverHighlight>
        </FadeSlideIn>

        <View style={styles.statsRow}>
          <StatTile
            icon="south-west"
            label="Received"
            value={fmt(totalReceived)}
            color={C.accent.success}
            accentBg={S.accentSuccess}
            delay={120}
            replayToken={replayToken}
          />
          <StatTile
            icon="north-east"
            label="Spent"
            value={fmt(totalSpent)}
            color={GOLD}
            accentBg={S.accentGold}
            delay={170}
            replayToken={replayToken}
          />
          <StatTile
            icon="swap-vert"
            label="Total"
            value={String(transactions.length)}
            color={TEAL}
            accentBg={S.accentTeal}
            delay={220}
            replayToken={replayToken}
          />
        </View>

        <SectionBlock
          icon="history"
          title="All transactions"
          subtitle={transactions.length
            ? 'Sorted by most recent first'
            : 'Your payment activity will appear here'}
          accent={TEAL}
          accentBg={S.accentTeal}
          delay={280}
          replayToken={replayToken}
        >
          {transactions.length > 0 ? (
            transactions.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                index={index}
                replayToken={replayToken}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </SectionBlock>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading transactions…" />
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
  heroBanner: { ...StyleSheet.absoluteFillObject },
  heroShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ skewX: '-16deg' }],
  },
  heroFade: { ...StyleSheet.absoluteFillObject },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconRing: { borderRadius: 16, overflow: 'hidden' },
  heroIconGrad: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: { flex: 1 },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.5,
  },
  heroNote: {
    fontSize: 13,
    color: C.text.muted,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    marginBottom: T.spacing.lg,
  },
  statTileWrap: { flex: 1, overflow: 'hidden' },
  statTile: {
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    padding: T.spacing.md,
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: C.text.muted,
    textAlign: 'center',
    fontWeight: '600',
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
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
  },

  txRow: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  txRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBody: { flex: 1, minWidth: 0 },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text.primary,
    flexShrink: 1,
  },
  statusPill: {
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  txPerson: {
    fontSize: 12,
    color: C.text.secondary,
    marginTop: 1,
  },
  txDate: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 2,
  },
  txRight: { alignItems: 'flex-end', minWidth: 72 },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
  },
  txAmountSub: {
    fontSize: 10,
    color: C.text.muted,
    marginTop: 1,
    fontWeight: '600',
  },
  recentBadge: {
    marginTop: 4,
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.round,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  recentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: TEAL,
    textTransform: 'uppercase',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.xl,
    gap: T.spacing.sm,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.xs,
    overflow: 'visible',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: T.spacing.md,
  },
});
