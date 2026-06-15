import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useAuth } from '../../hooks/useAuth';
import { earningsApi } from '../../api/earningsApi';
import { paymentApi } from '../../api/paymentApi';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/dateHelpers';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const GLASS_BORDER = 'rgba(167,139,250,0.22)';
const PERIODS = ['week', 'month', 'year'];
const PERIOD_TREND_TITLE = {
  week: 'Weekly trend',
  month: 'Monthly trend',
  year: 'Yearly trend',
};
const PERIOD_TOTAL_LABEL = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
};
const CHART_HEIGHT = 140;
const ENTRANCE_STEP_MS = 45;

function FadeSlideIn({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.97)).current;
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

function PressScale({ onPress, children, style, disabled, pill = false, scaleTo = 0.96 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bg = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(bg, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(bg, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  const bgOpacity = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[styles.pressScaleHit, pill && styles.loadMorePill, style]}
      >
        {pill ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.loadMorePillBg, { opacity: bgOpacity }]}
          />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            pill ? styles.loadMoreGlow : styles.pressGlow,
            { opacity: glowOpacity },
          ]}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
}

function PulseIconRing({ children, ringStyle }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseRing,
          ringStyle,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      {children}
    </View>
  );
}

function SkeletonBone({ style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  return <Animated.View style={[sk.bone, style, { opacity }]} />;
}

function EarningsSkeleton() {
  return (
    <View style={sk.wrap}>
      <SkeletonBone style={sk.hero} />
      <SkeletonBone style={sk.statsBar} />
      <SkeletonBone style={sk.periodRow} />
      <SkeletonBone style={sk.chart} />
      <SkeletonBone style={sk.sectionTitle} />
      <SkeletonBone style={sk.txnCard} />
    </View>
  );
}

const sk = StyleSheet.create({
  bone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: T.borderRadius.md,
  },
  wrap: { gap: T.spacing.md },
  hero: { height: 110, borderRadius: 16 },
  statsBar: { height: 72, borderRadius: 14 },
  periodRow: { height: 44, borderRadius: 4 },
  chart: { height: 220, borderRadius: 16 },
  sectionTitle: { height: 18, width: 140, borderRadius: 6 },
  txnCard: { height: 160, borderRadius: 16 },
});

function AnimatedBar({ height, delay, isZero, barWidth }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, height, progress]);

  if (isZero) {
    return (
      <View style={[chart.barEmptyWrap, { width: barWidth }]}>
        <View style={[chart.barEmpty, { width: barWidth }]} />
      </View>
    );
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View style={{ height, width: barWidth, overflow: 'hidden' }}>
      <Animated.View style={{ height, width: barWidth, transform: [{ translateY }] }}>
        <LinearGradient
          colors={[TEAL, PURPLE_LINK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ height, width: barWidth, ...chart.barFill }}
        />
      </Animated.View>
    </View>
  );
}

function CustomBarChart({ data, chartKey }) {
  if (!data || !data.labels || data.labels.length === 0) return null;

  const values = data.datasets[0].data;
  const maxVal = Math.max(...values, 1);
  const barWidth =
    values.length <= 4 ? 26 : values.length <= 7 ? 20 : values.length <= 8 ? 16 : 12;

  return (
    <View style={chart.wrap} key={chartKey}>
      <View style={chart.plotArea}>
        <View style={chart.gridLayer} pointerEvents="none">
          {[0.25, 0.5, 0.75].map(frac => (
            <View
              key={frac}
              style={[chart.gridLine, { bottom: CHART_HEIGHT * frac + 8 }]}
            />
          ))}
        </View>

        <View style={chart.barsRow}>
          {values.map((val, i) => {
            const pct = val / maxVal;
            const barH = Math.max(Math.round(pct * CHART_HEIGHT), val > 0 ? 8 : 2);
            const isZero = val === 0;
            const barDelay = i * 45;

            return (
              <View key={`${chartKey}-${i}`} style={chart.barSlot}>
                <View style={chart.valueRow}>
                  {val > 0 ? (
                    <Text style={chart.valueLabel} numberOfLines={1}>
                      {val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${Math.round(val)}`}
                    </Text>
                  ) : null}
                </View>

                <View style={chart.barTrack}>
                  <AnimatedBar
                    height={barH}
                    barWidth={barWidth}
                    delay={barDelay}
                    isZero={isZero}
                  />
                </View>

                <Text style={chart.xLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {data.labels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function EarningsChartBoard({
  activePeriod,
  onPeriodChange,
  periodTotal,
  periodLoading,
  chartData,
  chartKey,
}) {
  return (
    <View style={styles.chartBoard}>
      <View style={styles.chartBoardHeader}>
        <View style={styles.chartBoardHeaderLeft}>
          <View style={styles.chartBoardIcon}>
            <MaterialIcons name="insights" size={18} color={TEAL} />
          </View>
          <View>
            <Text style={styles.chartBoardEyebrow}>Earnings trend</Text>
            <Text style={styles.chartBoardAmount}>{formatCurrency(periodTotal)}</Text>
          </View>
        </View>
        <Text style={styles.chartBoardPeriod}>{PERIOD_TREND_TITLE[activePeriod]}</Text>
      </View>

      <View style={styles.periodSegment}>
        {PERIODS.map((p, index) => (
          <React.Fragment key={p}>
            {index > 0 ? <View style={styles.periodDivider} /> : null}
            <PeriodTab
              period={p}
              active={activePeriod}
              onPress={() => onPeriodChange(p)}
            />
          </React.Fragment>
        ))}
      </View>

      {periodLoading ? (
        <View style={chart.plotArea}>
          <ChartSkeleton />
        </View>
      ) : chartData ? (
        <CustomBarChart data={chartData} chartKey={chartKey} />
      ) : (
        <View style={[chart.plotArea, styles.emptyChart]}>
          <MaterialIcons name="bar-chart" size={36} color={PURPLE_LINK} />
          <Text style={styles.emptyTxt}>No data for this period</Text>
          <Text style={styles.emptyHint}>Complete sessions to see earnings here</Text>
        </View>
      )}
    </View>
  );
}

function SectionHeader({ title, icon, delay, style, count }) {
  const iconScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      delay: (delay || 0) + 80,
      useNativeDriver: true,
    }).start();
  }, [delay, iconScale]);

  return (
    <FadeSlideIn delay={delay} style={[styles.secHdrRow, style]}>
      <View style={styles.secHdrLeft}>
        <Animated.View style={[styles.secIconBox, { transform: [{ scale: iconScale }] }]}>
          <MaterialIcons name={icon} size={14} color={PURPLE_LINK} />
        </Animated.View>
        <Text style={styles.secHdrTitle}>{title}</Text>
      </View>
      {count != null && count > 0 ? (
        <View style={styles.secHdrCount}>
          <Text style={styles.secHdrCountText}>{count}</Text>
        </View>
      ) : null}
    </FadeSlideIn>
  );
}

function ChartSkeleton() {
  const barHeights = [0.35, 0.62, 0.48, 0.78];
  return (
    <View style={chart.skeletonRow}>
      {barHeights.map((frac, i) => (
        <View key={i} style={chart.barSlot}>
          <SkeletonBone style={[chart.skBar, { height: CHART_HEIGHT * frac }]} />
        </View>
      ))}
    </View>
  );
}

function StatSegment({ icon, iconColor, value, label, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[styles.statSeg, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </Text>
      <View style={styles.statLabelRow}>
        <MaterialIcons name={icon} size={12} color={iconColor} />
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

function PeriodTab({ period, active, onPress }) {
  const label = period.charAt(0).toUpperCase() + period.slice(1);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.periodSeg,
        active && styles.periodSegActive,
        pressed && styles.periodTabPressed,
      ]}
    >
      <Text style={[styles.periodTxt, active && styles.periodTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function TxnRow({ item, index, isLast, baseDelay }) {
  const delay = baseDelay + index * ENTRANCE_STEP_MS;
  const isVideo = item.source === 'video_subscription';
  const iconName = isVideo ? 'play-circle-filled' : 'videocam';
  const iconColor = isVideo ? PURPLE_LINK : TEAL;
  const iconBg = isVideo ? S.accentViolet : S.accentTeal;
  const iconBorder = isVideo ? 'rgba(167,139,250,0.25)' : 'rgba(94,234,212,0.25)';

  return (
    <FadeSlideIn delay={delay}>
      <View style={[styles.txnRow, isLast && styles.txnRowLast]}>
        <View style={[styles.txnIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
          <MaterialIcons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.txnInfo}>
          <Text style={styles.txnDate}>{item.created_at ? formatDate(item.created_at) : '—'}</Text>
          <Text style={styles.txnSub} numberOfLines={1}>
            {isVideo
              ? 'Video subscription'
              : item.bookings?.profiles?.name || `Session #${item.booking_id?.slice(0, 8) || '—'}`}
          </Text>
        </View>
        <Text style={styles.txnAmt}>+{formatCurrency(item.amount)}</Text>
      </View>
    </FadeSlideIn>
  );
}

export default function MentorEarningsScreen() {
  const { profile } = useAuth();
  const [activePeriod, setActivePeriod] = useState('month');
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [periodEarnings, setPeriodEarnings] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [allEarnings, setAllEarnings] = useState([]);
  const [shownCount, setShownCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadEarningsData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      } else {
        setPeriodLoading(true);
      }

      const periodFetch =
        activePeriod === 'week' ? earningsApi.getEarningsByWeek(profile.id)
        : activePeriod === 'month' ? earningsApi.getEarningsByMonth(profile.id)
        : earningsApi.getEarningsByYear(profile.id);

      const [wallet, data, all] = await Promise.all([
        paymentApi.getWallet(profile.id),
        periodFetch,
        earningsApi.getEarningsByMentor(profile.id),
      ]);

      hasLoadedRef.current = true;
      setTotalEarnings(wallet?.total_earned || 0);
      setPeriodEarnings(data || []);
      setAllEarnings(all || []);
      setShownCount(6);

      let labels = [];
      let values = [];

      if (activePeriod === 'week') {
        const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        labels = [...DAY_LABELS];
        const earningsByDate = {};
        (data || []).forEach(d => {
          if (d.date) {
            const [y, m, day] = d.date.split('-').map(Number);
            const dayIdx = new Date(y, m - 1, day).getDay();
            earningsByDate[DAY_LABELS[dayIdx]] = parseFloat(d.amount || 0);
          }
        });
        values = labels.map(lbl => earningsByDate[lbl] || 0);
      } else if (activePeriod === 'month') {
        labels = ['W1', 'W2', 'W3', 'W4'];
        const earningsByWeek = {};
        (data || []).forEach(d => {
          if (d.week) earningsByWeek[d.week.replace('Week ', 'W')] = parseFloat(d.amount || 0);
        });
        values = labels.map(lbl => earningsByWeek[lbl] || 0);
      } else {
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        labels = MONTHS;
        const earningsByMonth = {};
        (data || []).forEach(d => {
          if (d.month) earningsByMonth[d.month.slice(0, 3)] = parseFloat(d.amount || 0);
        });
        values = MONTHS.map(m => earningsByMonth[m] || 0);
      }

      const hasData = values.some(v => v > 0);
      setChartData(hasData ? { labels, datasets: [{ data: values }] } : null);
    } catch {
      Toast.show('Failed to load earnings');
    } finally {
      setLoading(false);
      setPeriodLoading(false);
    }
  }, [profile?.id, activePeriod]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) {
        setLoading(false);
        return undefined;
      }
      loadEarningsData();
      return undefined;
    }, [profile?.id, loadEarningsData]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEarningsData();
    setRefreshing(false);
  };

  const bestPoint = periodEarnings.reduce((max, r) => Math.max(max, parseFloat(r?.amount || 0)), 0);
  const periodTotal = periodEarnings.reduce((sum, r) => sum + parseFloat(r?.amount || 0), 0);
  const visibleTxns = allEarnings.slice(0, shownCount);
  const txnBaseDelay = 8 * ENTRANCE_STEP_MS;

  if (loading && !refreshing) {
    return (
      <SafeScreen hasBottomTabs={false} padding={0} includeTopInset={false}>
        <View style={styles.pagePad}>
          <EarningsSkeleton />
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen hasBottomTabs={false} padding={0} includeTopInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} />
        }
      >
        <FadeSlideIn delay={0}>
          <LinearGradient
            colors={['rgba(52,211,153,0.14)', 'rgba(255,255,255,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalHighlight}
          >
            <View style={styles.heroIconRing}>
              <MaterialIcons name="account-balance-wallet" size={22} color={C.accent.success} />
            </View>
            <Text style={styles.totalLabel}>Total earnings</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalEarnings)}</Text>
            <Text style={styles.totalNote}>Lifetime from completed sessions</Text>
          </LinearGradient>
        </FadeSlideIn>

        <FadeSlideIn delay={ENTRANCE_STEP_MS} style={styles.statsWrap}>
          <View style={styles.statsBar}>
            <StatSegment
              icon="receipt-long"
              iconColor={PURPLE_LINK}
              value={String(allEarnings.length)}
              label="Transactions"
              delay={ENTRANCE_STEP_MS + 40}
            />
            <View style={styles.statDivider} />
            <StatSegment
              icon="star"
              iconColor={GOLD}
              value={formatCurrency(bestPoint)}
              label="Peak"
              delay={ENTRANCE_STEP_MS + 90}
            />
            <View style={styles.statDivider} />
            <StatSegment
              icon="trending-up"
              iconColor={TEAL}
              value={formatCurrency(periodTotal)}
              label={PERIOD_TOTAL_LABEL[activePeriod]}
              delay={ENTRANCE_STEP_MS + 140}
            />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={ENTRANCE_STEP_MS * 2}>
          <EarningsChartBoard
            activePeriod={activePeriod}
            onPeriodChange={setActivePeriod}
            periodTotal={periodTotal}
            periodLoading={periodLoading}
            chartData={chartData}
            chartKey={activePeriod}
          />
        </FadeSlideIn>

        <SectionHeader
          title="Recent activity"
          icon="receipt-long"
          delay={ENTRANCE_STEP_MS * 3}
          count={allEarnings.length}
        />

        <FadeSlideIn delay={ENTRANCE_STEP_MS * 4}>
          <View style={styles.txnCard}>
            {allEarnings.length > 0 ? (
              visibleTxns.map((item, index) => {
                const visibleCount = Math.min(shownCount, allEarnings.length);
                const isLast = index === visibleCount - 1 && shownCount >= allEarnings.length;
                return (
                  <TxnRow
                    key={item.id || index}
                    item={item}
                    index={index}
                    isLast={isLast}
                    baseDelay={txnBaseDelay}
                  />
                );
              })
            ) : (
              <View style={styles.emptyTxn}>
                <PulseIconRing ringStyle={styles.txnPulseRing}>
                  <View style={styles.txnEmptyIcon}>
                    <MaterialIcons name="receipt-long" size={24} color={PURPLE_LINK} />
                  </View>
                </PulseIconRing>
                <Text style={styles.emptyTxt}>No transactions yet</Text>
                <Text style={styles.emptyHint}>Earnings from sessions will show up here</Text>
              </View>
            )}
          </View>
        </FadeSlideIn>

        {shownCount < allEarnings.length ? (
          <FadeSlideIn delay={txnBaseDelay + visibleTxns.length * ENTRANCE_STEP_MS}>
            <PressScale
              pill
              onPress={() => setShownCount(prev => prev + 6)}
              style={styles.loadMoreBtn}
            >
              <Text style={styles.loadMoreTxt}>Show more</Text>
              <MaterialIcons name="expand-more" size={18} color={PURPLE_LINK} />
            </PressScale>
          </FadeSlideIn>
        ) : null}
      </ScrollView>
    </SafeScreen>
  );
}

const chart = StyleSheet.create({
  wrap: {
    paddingBottom: T.spacing.xs,
  },
  plotArea: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.sm,
    paddingHorizontal: T.spacing.xs,
    minHeight: CHART_HEIGHT + 72,
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    top: T.spacing.md,
    bottom: T.spacing.sm + 22,
  },
  gridLine: {
    position: 'absolute',
    left: T.spacing.xs,
    right: T.spacing.xs,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: CHART_HEIGHT + 24,
    paddingTop: 18,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 1,
  },
  valueRow: {
    height: 16,
    justifyContent: 'center',
    marginBottom: 4,
  },
  valueLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: TEAL,
    textAlign: 'center',
  },
  barTrack: {
    height: CHART_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barEmptyWrap: {
    height: 2,
    justifyContent: 'flex-end',
  },
  barEmpty: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  xLabel: {
    fontSize: 10,
    color: C.text.muted,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: CHART_HEIGHT + 24,
    paddingTop: 18,
    paddingHorizontal: T.spacing.sm,
  },
  skBar: {
    width: 18,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  pagePad: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.xxxl,
  },
  pressScaleHit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pressGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.borderRadius.chip,
    borderWidth: 1.5,
    borderColor: PURPLE_LINK,
  },
  loadMorePill: {
    flexDirection: 'row',
    flex: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.md,
    marginBottom: T.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    gap: T.spacing.sm,
  },
  loadMorePillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.14)',
  },
  loadMoreGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PURPLE_LINK,
  },
  pulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
  },
  emptyPulseRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  txnPulseRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  emptyIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnEmptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalHighlight: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
    marginBottom: T.spacing.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.sm,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE_LINK,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: T.spacing.xs,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: C.accent.success,
    letterSpacing: -0.5,
  },
  totalNote: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 4,
  },
  statsWrap: {
    marginBottom: T.spacing.lg,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  statSeg: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.4,
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text.muted,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: 6,
    alignSelf: 'stretch',
  },
  periodSegment: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    marginBottom: T.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  periodSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: T.spacing.sm,
  },
  periodSegActive: {
    backgroundColor: 'rgba(94,234,212,0.14)',
  },
  periodDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  periodTabPressed: {
    opacity: 0.75,
  },
  periodTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text.muted,
  },
  periodTxtActive: {
    color: TEAL,
    fontWeight: '800',
  },
  chartBoard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: T.spacing.md,
    marginBottom: T.spacing.lg,
    ...Platform.select({ ios: T.shadows.small, android: { elevation: 2 } }),
  },
  chartBoardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
    paddingBottom: T.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  chartBoardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  chartBoardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(94,234,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartBoardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  chartBoardAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.3,
  },
  chartBoardPeriod: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE_LINK,
    textAlign: 'right',
    maxWidth: 96,
  },
  emptyChart: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: T.spacing.sm,
  },
  emptyTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text.primary,
  },
  emptyHint: {
    fontSize: 12,
    color: C.text.muted,
  },
  secHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: T.spacing.xl,
    marginBottom: T.spacing.sm,
  },
  secHdrFirst: {
    marginTop: 0,
  },
  secHdrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  secIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secHdrTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    flex: 1,
    minWidth: 0,
  },
  secHdrCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secHdrCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: PURPLE_LINK,
  },
  txnCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    marginBottom: T.spacing.lg,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: T.spacing.md + 2,
    paddingHorizontal: T.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: T.spacing.md,
  },
  txnRowLast: {
    borderBottomWidth: 0,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnInfo: { flex: 1, gap: 3 },
  txnDate: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
  },
  txnSub: {
    fontSize: 12,
    color: C.text.secondary,
    fontWeight: '500',
  },
  txnAmt: {
    fontSize: 15,
    color: C.accent.success,
    fontWeight: '800',
  },
  emptyTxn: {
    alignItems: 'center',
    paddingVertical: T.spacing.xl,
    gap: T.spacing.sm,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
  },
  loadMoreTxt: {
    fontSize: 13,
    color: PURPLE_LINK,
    fontWeight: '700',
  },
});
