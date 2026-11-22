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
import Toast from 'react-native-simple-toast';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill } from '../../theme/surfaceStyles';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useAuth } from '../../hooks/useAuth';
import { bookingApi } from '../../api/bookingApi';
import { videoApi } from '../../api/videoApi';
import { paymentApi } from '../../api/paymentApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

function getStatusConfigMap(theme) {
  const C = theme.colors;
  const S = C.surface;
  return {
    completed: { label: 'Completed', color: C.accent.success, bg: S.accentSuccess },
    confirmed: { label: 'Confirmed', color: C.accent.info, bg: 'rgba(56,189,248,0.12)' },
    pending: { label: 'Pending', color: C.accent.warning, bg: S.accentWarning },
    cancelled: { label: 'Cancelled', color: C.accent.error, bg: 'rgba(248,113,113,0.12)' },
    active: { label: 'Active', color: C.accent.secondary, bg: S.accentTeal },
    expired: { label: 'Expired', color: C.accent.error, bg: 'rgba(248,113,113,0.12)' },
  };
}

function statusConfig(status, theme) {
  const C = theme.colors;
  const map = getStatusConfigMap(theme);
  return map[status] || { label: status, color: C.text.muted, bg: C.surface.accentViolet };
}

const TX_TYPE = {
  SESSION_EARNED: 'session_earned',
  SESSION_PAID: 'session_paid',
  SUBSCRIPTION: 'subscription',
};

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: TX_TYPE.SESSION_EARNED, label: 'Earnings' },
  { key: TX_TYPE.SESSION_PAID, label: 'Payments' },
  { key: TX_TYPE.SUBSCRIPTION, label: 'Subscriptions' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'Any status' },
  { key: 'completed', label: 'Completed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending', label: 'Pending' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'active', label: 'Active' },
  { key: 'expired', label: 'Expired' },
];

const fmt = n =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function FilterChip({ label, active, onPress, styles, activeColor, activeTextColor }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
        active && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : null,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          active && styles.filterChipTextActive,
          active && activeTextColor ? { color: activeTextColor } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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

function PulseGlow({ color, size = 68 }) {
  const styles = useThemedStyles(createTransactionStyles);
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
          borderColor: ringColor,
          opacity: glowOpacity,
          transform: [{ scale }],
        },
      ]}
    />
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
  const styles = useThemedStyles(createTransactionStyles);
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

function getSessionDate(booking) {
  return booking?.availability_slots?.date || booking?.created_at;
}

function normalizeTransactions(mentorTx, learnerTx, videoSubs, txByBooking) {
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
      tx: txByBooking?.get(booking.id) || null,
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
      tx: txByBooking?.get(booking.id) || null,
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

function receiptNumber(item) {
  const raw = item.tx?.id || item.id;
  return `CIQ-${String(raw).replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

/** Map a history row onto the receipt shape in utils/receipt. */
function buildReceipt(item, selfName) {
  const tx = item.tx;
  const date = moment(tx?.created_at || item.dateRaw);
  const reference = [];
  if (tx?.razorpay_payment_id) reference.push({ label: 'Payment ID', value: tx.razorpay_payment_id });
  if (tx?.razorpay_order_id) reference.push({ label: 'Order ID', value: tx.razorpay_order_id });

  const base = {
    number: receiptNumber(item),
    date: date.isValid() ? date.format('DD MMM YYYY') : '-',
    status: 'Paid',
    billedTo: selfName || 'Connectiqo user',
    reference,
  };

  if (item.type === TX_TYPE.SESSION_EARNED) {
    const gross = tx ? tx.amount_total_paise / 100 : item.amount;
    const fee = tx ? tx.platform_fee_paise / 100 : 0;
    return {
      ...base,
      billedToLabel: 'Paid to',
      counterpartyLabel: 'Learner',
      counterparty: item.person?.name,
      lines: [
        { label: '1:1 mentoring session', amount: gross },
        ...(fee > 0 ? [{ label: 'Platform fee (incl. taxes)', amount: fee }] : []),
      ],
      total: tx ? tx.mentor_earning_paise / 100 : item.amount,
      totalLabel: 'Amount received',
      note: 'Payment receipt. Platform fee is inclusive of applicable taxes.',
    };
  }

  if (item.type === TX_TYPE.SUBSCRIPTION) {
    return {
      ...base,
      billedToLabel: 'Paid by',
      counterpartyLabel: 'Mentor',
      counterparty: item.person?.name,
      lines: [{ label: 'Video library subscription', amount: item.amount }],
      total: item.amount,
      totalLabel: 'Amount paid',
      note: 'Payment receipt. Amount is inclusive of applicable taxes.',
    };
  }

  return {
    ...base,
    billedToLabel: 'Paid by',
    counterpartyLabel: 'Mentor',
    counterparty: item.person?.name,
    lines: [{ label: '1:1 mentoring session', amount: tx ? tx.amount_total_paise / 100 : item.amount }],
    total: tx ? tx.amount_total_paise / 100 : item.amount,
    totalLabel: 'Amount paid',
    note: 'Payment receipt. Amount is inclusive of applicable taxes.',
  };
}

function TransactionRow({ item, index = 0, replayToken = 0, selfName, navigation }) {
  const styles = useThemedStyles(createTransactionStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const isCredit = item.type === TX_TYPE.SESSION_EARNED;
  const isSubscription = item.type === TX_TYPE.SUBSCRIPTION;
  const cfg = statusConfig(item.status, theme);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;
  const hasEntered = useRef(false);
  const isRecent = item.dateRaw && moment(item.dateRaw).isAfter(moment().subtract(7, 'days'));
  // No money actually moved for cancelled/pending rows, so there is nothing to receipt.
  const canReceipt = Boolean(item.tx) || (isSubscription && item.amount > 0);

  const handleReceipt = useCallback(() => {
    navigation?.navigate(SCREEN_NAMES.ReceiptPreview, {
      receipt: buildReceipt(item, selfName),
    });
  }, [item, selfName, navigation]);

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
            {fmt(Math.abs(item.amount || 0))}
          </Text>
          <Text style={styles.txAmountSub}>{typeMeta.amountLabel}</Text>
          {isRecent ? (
            <PulseBadge style={styles.recentBadge}>
              <Text style={styles.recentBadgeText}>Recent</Text>
            </PulseBadge>
          ) : null}
          {canReceipt ? (
            <AnimatedPressable
              onPress={handleReceipt}
              style={styles.receiptBtn}
              hoverScale={1.06}
              pressScale={0.94}
            >
              <MaterialIcons name="receipt-long" size={13} color={TEAL} />
              <Text style={styles.receiptBtnText}>Receipt</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      </Animated.View>
    </HoverHighlight>
  );
}

function EmptyState() {
  const styles = useThemedStyles(createTransactionStyles);
  const { theme } = useTheme();
  const PURPLE_LINK = theme.colors.buttons.nebulaGradient[0];
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
  const styles = useThemedStyles(createTransactionStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const TEAL = C.accent.secondary;
  const { profile } = useAuth();
  const [mentorTx, setMentorTx] = useState([]);
  const [learnerTx, setLearnerTx] = useState([]);
  const [videoSubs, setVideoSubs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [mentorRes, learnerRes, subsRes, payRes] = await Promise.allSettled([
      bookingApi.getTransactionsAsMentor(profile.id),
      bookingApi.getTransactionsAsLearner(profile.id),
      videoApi.getLearnerSubscriptions(profile.id),
      paymentApi.getTransactions(profile.id),
    ]);

    if (mentorRes.status === 'fulfilled') setMentorTx(mentorRes.value);
    else console.error('[TransactionHistory] mentor fetch failed:', mentorRes.reason?.message);

    if (learnerRes.status === 'fulfilled') setLearnerTx(learnerRes.value);
    else console.error('[TransactionHistory] learner fetch failed:', learnerRes.reason?.message);

    if (subsRes.status === 'fulfilled') setVideoSubs(subsRes.value);
    else console.error('[TransactionHistory] subs fetch failed:', subsRes.reason?.message);

    if (payRes.status === 'fulfilled') setPayments(payRes.value);
    else console.error('[TransactionHistory] payments fetch failed:', payRes.reason?.message);

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

  const txByBooking = useMemo(() => {
    const map = new Map();
    payments.forEach(tx => { if (tx.booking_id) map.set(tx.booking_id, tx); });
    return map;
  }, [payments]);

  const transactions = useMemo(
    () => normalizeTransactions(mentorTx, learnerTx, videoSubs, txByBooking),
    [mentorTx, learnerTx, videoSubs, txByBooking],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter]);

  const filtersActive = typeFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setStatusFilter('all');
  }, []);

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Transaction history</Text>
            <Text style={styles.headerSubtitle}>
              {filteredTransactions.length}
              {filtersActive ? ` of ${transactions.length}` : ''}
              {' '}transaction{filteredTransactions.length === 1 ? '' : 's'}
            </Text>
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

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {TYPE_FILTERS.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={typeFilter === f.key}
              onPress={() => setTypeFilter(f.key)}
              styles={styles}
              activeColor={TEAL}
              activeTextColor={C.buttons?.primaryText || '#0B1220'}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={statusFilter === f.key}
              onPress={() => setStatusFilter(f.key)}
              styles={styles}
              activeColor={C.accent.primary}
              activeTextColor="#1A1200"
            />
          ))}
          {filtersActive ? (
            <Pressable onPress={clearFilters} style={styles.clearFiltersBtn} hitSlop={8}>
              <MaterialIcons name="close" size={14} color={C.text.muted} />
              <Text style={styles.clearFiltersText}>Clear</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} colors={[TEAL]} />
        }
      >
        <View style={styles.listCard}>
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                index={index}
                replayToken={replayToken}
                selfName={profile?.name}
                navigation={navigation}
              />
            ))
          ) : transactions.length > 0 ? (
            <View style={styles.filterEmpty}>
              <MaterialIcons name="filter-list-off" size={28} color={C.text.muted} />
              <Text style={styles.filterEmptyTitle}>No matches</Text>
              <Text style={styles.filterEmptySubtitle}>Try another type or status filter.</Text>
              <Pressable onPress={clearFilters} style={styles.clearFiltersBtnLarge}>
                <Text style={[styles.clearFiltersText, { color: TEAL }]}>Clear filters</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState />
          )}
        </View>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading transactions…" />
    </SafeScreen>
  );
}

function createTransactionStyles(theme) {
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

  filtersWrap: {
    paddingTop: T.spacing.sm,
    paddingBottom: T.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(167,139,250,0.16)',
    gap: 8,
  },
  filterRow: {
    paddingHorizontal: T.spacing.lg,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: softBorder(theme),
    backgroundColor: softFill(theme),
  },
  filterChipActive: {
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text.muted,
  },
  filterChipTextActive: {
    color: C.text.primary,
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text.muted,
  },
  clearFiltersBtnLarge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 6,
  },
  filterEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 6,
  },
  filterEmptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
  },

  hoverHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.1)',
  },
  pulseGlow: {
    position: 'absolute',
    borderWidth: 2,
  },

  listCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: softBorder(theme),
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
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: T.borderRadius.sm,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: C.border.default,
  },
  receiptBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEAL,
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
    borderColor: softBorder(theme),
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
}


















































