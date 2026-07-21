import { SafeScreen } from '../../components/SafeScreen';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-simple-toast';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { BookingCard } from '../../components/BookingCard';
import { useAuth } from '../../hooks/useAuth';
import { bookingApi } from '../../api/bookingApi';
import { normalizeRecordingUrl } from '../../api/api';
import { playbackUrlFromBooking } from '../../api/recordingsApi';
import { scheduleSessionReminder, requestNotificationPermission } from '../../utils/sessionReminder';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { saveRecordingToGallery } from '../../utils/recordingActions';
import { isBookingSessionPast, isExpiredBooking } from '../../utils/bookingSession';
import { rescheduleApi } from '../../api/rescheduleApi';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const GLASS_BORDER = 'rgba(167,139,250,0.22)';
const PAGE_SIZE = 6;
const SESSIONS_POLL_MS = 30_000;
const ENTRANCE_STEP_MS = 45;

const STATUS_LABEL = {
  expired: 'Expired',
  completed: 'Done',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  booked: 'Booked',
  confirmed: 'Live',
  pending: 'Pending',
};

const normalize = b => ({
  ...b,
  recordingUrl: normalizeRecordingUrl(playbackUrlFromBooking(b)) || null,
});

const isSessionPast = isBookingSessionPast;

function SkeletonBone({ style }) {
  const sk = useThemedStyles(createCallsSkeletonStyles);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  return <Animated.View style={[sk.bone, style, { opacity }]} />;
}

function SessionsSkeleton() {
  const sk = useThemedStyles(createCallsSkeletonStyles);
  return (
    <View style={sk.wrap}>
      <SkeletonBone style={sk.statsBar} />
      <View style={sk.sectionHeader}>
        <SkeletonBone style={sk.sectionIcon} />
        <SkeletonBone style={sk.sectionTitle} />
      </View>
      <SkeletonBone style={sk.card} />
      <SkeletonBone style={sk.card} />
      <View style={sk.sectionHeader}>
        <SkeletonBone style={sk.sectionIcon} />
        <SkeletonBone style={sk.sectionTitle} />
      </View>
      <SkeletonBone style={sk.card} />
    </View>
  );
}

function createCallsSkeletonStyles(theme) {
  const T = theme;
  return StyleSheet.create({
    bone: {
      backgroundColor: softFillStrong(theme),
      borderRadius: T.borderRadius.md,
    },
    wrap: {
      padding: T.spacing.lg,
      gap: T.spacing.md,
    },
    statsBar: { height: 72, borderRadius: 14 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.spacing.sm,
      marginTop: T.spacing.xs,
    },
    sectionIcon: { width: 26, height: 26, borderRadius: 8 },
    sectionTitle: { height: 14, width: 120, borderRadius: 6 },
    card: { height: 120, borderRadius: 16 },
  });
}

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

function PressScale({ onPress, children, style, disabled, pill = false }) {
  const styles = useThemedStyles(createMentorCallsStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bg = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.96,
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
  const styles = useThemedStyles(createMentorCallsStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
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

function StatSegment({ icon, iconColor, value, label, delay = 0 }) {
  const styles = useThemedStyles(createMentorCallsStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
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

function SectionHeader({ title, icon, isFirst, delay }) {
  const styles = useThemedStyles(createMentorCallsStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const iconScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 6,
      tension: 120,
      delay: delay + 80,
      useNativeDriver: true,
    }).start();
  }, [delay, iconScale]);

  return (
    <FadeSlideIn delay={delay} style={[styles.secHdrRow, isFirst && styles.secHdrRowFirst]}>
      <View style={styles.secHdrLeft}>
        <Animated.View style={[styles.secIconBox, { transform: [{ scale: iconScale }] }]}>
          <MaterialIcons name={icon} size={14} color={PURPLE_LINK} />
        </Animated.View>
        <Text style={styles.secHdrTitle}>{title}</Text>
      </View>
    </FadeSlideIn>
  );
}

export default function MentorCallsScreen({ navigation }) {
  const styles = useThemedStyles(createMentorCallsStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const { profile } = useAuth();
  const [upcomingAll, setUpcomingAll] = useState([]);
  const [upcomingShown, setUpcomingShown] = useState(PAGE_SIZE);
  const [history, setHistory] = useState([]);
  const [historyShown, setHistoryShown] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const sessionsLoaderShownRef = useRef(false);
  const lastProfileIdRef = useRef(profile?.id);

  const scheduleReminders = useCallback((upcomingBookings = []) => {
    if (!upcomingBookings.length) return;
    void requestNotificationPermission()
      .then(() =>
        Promise.all(
          upcomingBookings.map(b =>
            scheduleSessionReminder({
              bookingId: b.id,
              sessionDate: b.availability_slots?.date,
              sessionTime: b.availability_slots?.start_time,
              mentorName: b.profiles?.name || 'Learner',
              isMentor: true,
            }).catch(() => {}),
          ),
        ),
      )
      .catch(() => {});
  }, []);

  const loadInitial = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    const isActive = opts.isActive ?? (() => true);
    if (!profile?.id) {
      if (!silent) setLoading(false);
      return;
    }
    let upcomingForReminders = [];
    try {
      if (!silent) setLoading(true);
      setUpcomingShown(PAGE_SIZE);
      setHistoryShown(PAGE_SIZE);

      const [upcomingData, historyData] = await Promise.all([
        bookingApi.getUpcomingBookingsByMentor(profile.id),
        bookingApi.getBookingHistoryByMentor(profile.id, 0, PAGE_SIZE),
      ]);

      if (!isActive()) return;

      const allUpcoming = (upcomingData || []).map(normalize);
      const historyNorm = (historyData || []).map(normalize);
      const upcomingNorm = allUpcoming.filter(b => !isSessionPast(b));
      const expiredNorm = allUpcoming.filter(b => isSessionPast(b));

      const merged = [...expiredNorm, ...historyNorm].sort((a, b) => {
        const da = `${a.availability_slots?.date ?? ''} ${a.availability_slots?.start_time ?? ''}`;
        const db = `${b.availability_slots?.date ?? ''} ${b.availability_slots?.start_time ?? ''}`;
        return db.localeCompare(da);
      });
      setUpcomingAll(upcomingNorm);
      setHistory(merged);
      setHistoryPage(1);
      setHasMoreHistory(historyNorm.length === PAGE_SIZE);
      upcomingForReminders = upcomingNorm;
    } catch {
      if (!opts.quietErrors && isActive()) Toast.show('Could not load sessions');
    } finally {
      if (!silent) setLoading(false);
    }
    if (isActive()) scheduleReminders(upcomingForReminders);
  }, [profile?.id, scheduleReminders]);

  const refreshUpcoming = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await bookingApi.getUpcomingBookingsByMentor(profile.id);
      const all = (data || []).map(normalize);
      const stillUpcoming = all.filter(b => !isSessionPast(b));
      const nowExpired = all
        .filter(b => isSessionPast(b));
      setUpcomingAll(stillUpcoming);
      if (nowExpired.length > 0) {
        setHistory(prev => {
          const ids = new Set(prev.map(b => b.id));
          const fresh = nowExpired.filter(b => !ids.has(b.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      }
    } catch { /* poll */ }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) {
        setLoading(false);
        return undefined;
      }
      let active = true;
      const isActive = () => active;
      if (lastProfileIdRef.current !== profile.id) {
        lastProfileIdRef.current = profile.id;
        sessionsLoaderShownRef.current = false;
      }
      if (sessionsLoaderShownRef.current) {
        loadInitial({ silent: true, isActive });
      } else {
        loadInitial({ silent: false, isActive });
        sessionsLoaderShownRef.current = true;
      }
      const pollId = setInterval(refreshUpcoming, SESSIONS_POLL_MS);
      return () => {
        active = false;
        clearInterval(pollId);
      };
    }, [profile?.id, loadInitial, refreshUpcoming]),
  );

  const loadMoreHistory = useCallback(async () => {
    if (loadingMore || !profile?.id) return;
    if (historyShown < history.length) {
      setHistoryShown(prev => prev + PAGE_SIZE);
      return;
    }
    if (!hasMoreHistory) return;
    try {
      setLoadingMore(true);
      const data = await bookingApi.getBookingHistoryByMentor(
        profile.id,
        historyPage,
        PAGE_SIZE,
      );
      const newItems = (data || []).map(normalize);
      setHistory(prev => [...prev, ...newItems]);
      setHistoryShown(prev => prev + PAGE_SIZE);
      setHistoryPage(p => p + 1);
      setHasMoreHistory(newItems.length === PAGE_SIZE);
    } catch {
      Toast.show('Could not load more');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreHistory, historyShown, history.length, profile?.id, historyPage]);

  const loadMoreUpcoming = () => {
    setUpcomingShown(prev => prev + PAGE_SIZE);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitial({ silent: true, quietErrors: true });
    setRefreshing(false);
  };

  const handleJoinCall = booking => {
    navigation.navigate('VideoCall_Screen', { bookingId: booking.id, isHost: true });
  };

  const handleOpenRecording = rawUrl => {
    const url = normalizeRecordingUrl(rawUrl);
    if (!url) {
      Toast.show('No recording');
      return;
    }
    navigation.navigate(SCREEN_NAMES.RecordingPlayer, { recordingUrl: url });
  };

  const handleDownloadRecording = rawUrl => {
    const url = normalizeRecordingUrl(rawUrl);
    if (!url) {
      Toast.show('No recording');
      return;
    }
    saveRecordingToGallery(url);
  };

  const statusKey = item =>
    isExpiredBooking(item) ? 'expired' : (item.status || 'booked').toLowerCase();

  const renderBooking = (item, isUpcoming, delay) => (
    <BookingCard
      booking={item}
      isMentor
      compact
      showLearnerInfo
      entranceDelay={delay}
      onPressJoin={isUpcoming ? () => handleJoinCall(item) : null}
      onPressCancel={null}
      onPressRecording={
        item.recordingUrl ? () => handleOpenRecording(item.recordingUrl) : null
      }
      onPressDownload={
        item.recordingUrl ? () => handleDownloadRecording(item.recordingUrl) : null
      }
      statusLabel={STATUS_LABEL[statusKey(item)] || STATUS_LABEL.booked}
      pressScale
    />
  );

  const reschedulePendingBookings = upcomingAll.filter(b => b.status === 'reschedule_pending');
  const regularUpcoming = upcomingAll.filter(b => b.status !== 'reschedule_pending');

  const visibleUpcoming = regularUpcoming.slice(0, upcomingShown);
  const hasMoreUpcoming = regularUpcoming.length > upcomingShown;
  const completedCount = history.filter(b => b.status === 'completed').length;
  const fullyEmpty = upcomingAll.length === 0 && history.length === 0 && !loading;

  const listData = [];
  let animStep = 0;
  const nextDelay = () => {
    const delay = animStep * ENTRANCE_STEP_MS;
    animStep += 1;
    return delay;
  };

  if (!fullyEmpty) {
    listData.push({ type: 'stats', key: 'stats', delay: nextDelay() });
  }

  if (fullyEmpty) {
    listData.push({ type: 'empty', key: 'empty', delay: nextDelay() });
  } else {
    // Reschedule requests section
    if (reschedulePendingBookings.length > 0) {
      listData.push({
        type: 'section_header',
        key: 'reschedule_header',
        title: 'Reschedule Requests',
        icon: 'event-repeat',
        isFirst: false,
        delay: nextDelay(),
      });
      reschedulePendingBookings.forEach(b =>
        listData.push({
          type: 'reschedule_banner',
          key: `resc_${b.id}`,
          booking: b,
          delay: nextDelay(),
        }),
      );
    }

    listData.push({
      type: 'section_header',
      key: 'upcoming_header',
      title: 'Upcoming',
      icon: 'event',
      isFirst: reschedulePendingBookings.length === 0,
      delay: nextDelay(),
    });
    if (!regularUpcoming.length) {
      listData.push({
        type: 'empty_section',
        key: 'upcoming_empty',
        icon: 'event-available',
        text: 'No upcoming sessions',
        delay: nextDelay(),
      });
    } else {
      visibleUpcoming.forEach(b =>
        listData.push({
          type: 'booking',
          key: `u-${b.id}`,
          item: b,
          isUpcoming: true,
          delay: nextDelay(),
        }),
      );
      if (hasMoreUpcoming) {
        listData.push({ type: 'load_more_upcoming', key: 'more_upcoming', delay: nextDelay() });
      }
    }

    const visibleHistory = history.slice(0, historyShown);
    const hasMoreHistoryToShow = historyShown < history.length || hasMoreHistory;

    listData.push({
      type: 'section_header',
      key: 'history_header',
      title: 'History',
      icon: 'history',
      delay: nextDelay(),
    });
    if (!visibleHistory.length && !loadingMore) {
      listData.push({
        type: 'empty_section',
        key: 'history_empty',
        icon: 'history',
        text: 'No past sessions yet',
        delay: nextDelay(),
      });
    } else {
      visibleHistory.forEach(b =>
        listData.push({
          type: 'booking',
          key: `h-${b.id}`,
          item: b,
          isUpcoming: false,
          delay: nextDelay(),
        }),
      );
    }

    if (hasMoreHistoryToShow) {
      listData.push({ type: 'load_more', key: 'more', delay: nextDelay() });
    }
  }

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'stats':
        return (
          <FadeSlideIn delay={item.delay} style={styles.statsWrap}>
            <View style={styles.statsBar}>
              <StatSegment
                icon="schedule"
                iconColor={TEAL}
                value={String(upcomingAll.length)}
                label="Upcoming"
                delay={item.delay + 40}
              />
              <View style={styles.statDivider} />
              <StatSegment
                icon="check-circle"
                iconColor={GOLD}
                value={String(completedCount)}
                label="Completed"
                delay={item.delay + 90}
              />
              <View style={styles.statDivider} />
              <StatSegment
                icon="history"
                iconColor={PURPLE_LINK}
                value={String(history.length)}
                label="History"
                delay={item.delay + 140}
              />
            </View>
          </FadeSlideIn>
        );

      case 'section_header':
        return (
          <SectionHeader
            title={item.title}
            icon={item.icon}
            isFirst={item.isFirst}
            delay={item.delay}
          />
        );

      case 'empty_section':
        return (
          <FadeSlideIn delay={item.delay} style={styles.sectionItem}>
            <View style={styles.placeholderCard}>
              <PulseIconRing ringStyle={styles.placeholderPulseRing}>
                <View style={styles.placeholderIconRing}>
                  <MaterialIcons name={item.icon} size={20} color={PURPLE_LINK} />
                </View>
              </PulseIconRing>
              <Text style={styles.placeholderText}>{item.text}</Text>
            </View>
          </FadeSlideIn>
        );

      case 'booking':
        return (
          <View style={styles.sectionItem}>
            {renderBooking(item.item, item.isUpcoming, item.delay)}
          </View>
        );

      case 'reschedule_banner': {
        const { booking: rb, delay } = item;
        const learnerName = rb.profiles?.name || 'Learner';
        const reason = rb.reschedule_reason;
        const reasonLabel =
          reason === 'mentor_noshow' ? 'You did not join the session' :
          reason === 'technical' ? 'Session ended too early' : 'Session not completed';
        return (
          <FadeSlideIn delay={delay} style={styles.sectionItem}>
            <View style={styles.rescheduleBanner}>
              <View style={styles.rescheduleBannerLeft}>
                <MaterialIcons name="event-repeat" size={22} color={GOLD} />
              </View>
              <View style={styles.rescheduleBannerBody}>
                <Text style={styles.rescheduleBannerTitle}>{learnerName} — Reschedule</Text>
                <Text style={styles.rescheduleBannerSub}>{reasonLabel}</Text>
              </View>
              <PressScale
                onPress={() => navigation.navigate(SCREEN_NAMES.RescheduleRequest, { booking: rb })}
                style={styles.rescheduleBannerCta}
              >
                <Text style={styles.rescheduleBannerCtaText}>Propose Time</Text>
              </PressScale>
            </View>
          </FadeSlideIn>
        );
      }

      case 'load_more_upcoming':
        return (
          <FadeSlideIn delay={item.delay}>
            <PressScale onPress={loadMoreUpcoming} pill style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreTxt}>Show more upcoming</Text>
              <MaterialIcons name="expand-more" size={18} color={PURPLE_LINK} />
            </PressScale>
          </FadeSlideIn>
        );

      case 'load_more':
        return (
          <FadeSlideIn delay={item.delay}>
            <PressScale onPress={loadMoreHistory} disabled={loadingMore} pill style={styles.loadMoreBtn}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={TEAL} />
              ) : (
                <>
                  <Text style={styles.loadMoreTxt}>Show more history</Text>
                  <MaterialIcons name="expand-more" size={18} color={PURPLE_LINK} />
                </>
              )}
            </PressScale>
          </FadeSlideIn>
        );

      case 'empty':
        return (
          <FadeSlideIn delay={item.delay}>
            <View style={styles.emptyWrap}>
              <PulseIconRing ringStyle={styles.emptyPulseRing}>
                <View style={styles.emptyIconRing}>
                  <MaterialIcons name="video-call" size={40} color={PURPLE_LINK} />
                </View>
              </PulseIconRing>
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptySubtitle}>
                When learners book with you, sessions will appear here.
              </Text>
            </View>
          </FadeSlideIn>
        );

      default:
        return null;
    }
  };

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={false}>
      {loading && !refreshing ? (
        <SessionsSkeleton />
      ) : (
        <FlatList
          style={styles.list}
          data={listData}
          keyExtractor={entry => entry.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TEAL}
              colors={[TEAL]}
            />
          }
        />
      )}
    </SafeScreen>
  );
}

function createMentorCallsStyles(theme) {
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
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.xxxl,
  },
  statsWrap: {
    marginBottom: T.spacing.md,
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
    fontSize: 17,
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
  secHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: T.spacing.xl,
    marginBottom: T.spacing.sm,
  },
  secHdrRowFirst: {
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
    letterSpacing: -0.1,
  },
  sectionItem: {
    marginBottom: T.spacing.sm,
  },
  placeholderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: T.spacing.xl,
    paddingHorizontal: T.spacing.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  placeholderIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 13,
    color: C.text.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressScaleHit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  pressGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PURPLE_LINK,
  },
  loadMorePill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm + 2,
    marginTop: T.spacing.xs,
    marginBottom: T.spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  loadMorePillBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.14)',
  },
  loadMoreGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
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
  placeholderPulseRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  emptyPulseRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  loadMoreTxt: {
    fontSize: 13,
    color: PURPLE_LINK,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxxl,
    paddingHorizontal: T.spacing.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: T.spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
    marginBottom: T.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  rescheduleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    backgroundColor: S.accentGold,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: B.goldOutlineBorder,
    padding: T.spacing.md,
  },
  rescheduleBannerLeft: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleBannerBody: { flex: 1 },
  rescheduleBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text.primary,
  },
  rescheduleBannerSub: {
    fontSize: 11,
    color: C.text.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  rescheduleBannerCta: {
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
    borderRadius: 8,
    backgroundColor: GOLD,
  },
  rescheduleBannerCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
});
}
