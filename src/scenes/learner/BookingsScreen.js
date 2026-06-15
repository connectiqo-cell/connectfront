import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-simple-toast';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import { getFloatingTabBarContentInset } from '../../components/CosmicBottomTabBar';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { BookingCard } from '../../components/BookingCard';
import { useAuth } from '../../hooks/useAuth';
import { bookingApi } from '../../api/bookingApi';
import { playbackUrlFromBooking } from '../../api/recordingsApi';
import { reviewsApi } from '../../api/reviewsApi';
import { normalizeRecordingUrl } from '../../api/api';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { saveRecordingToGallery } from '../../utils/recordingActions';
import { isBookingSessionPast, isExpiredBooking } from '../../utils/bookingSession';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonBone({ style }) {
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

function SkeletonBookingCard() {
  return (
    <View style={sk.card}>
      <View style={sk.cardTop}>
        <SkeletonBone style={sk.avatar} />
        <View style={sk.cardMeta}>
          <SkeletonBone style={sk.nameLine} />
          <SkeletonBone style={sk.dateLine} />
          <SkeletonBone style={sk.statusBadge} />
        </View>
        <SkeletonBone style={sk.amountLine} />
      </View>
      <View style={sk.cardActions}>
        <SkeletonBone style={sk.actionBtn} />
        <SkeletonBone style={sk.actionBtn} />
      </View>
    </View>
  );
}

function SkeletonSectionHeader() {
  return (
    <View style={sk.sectionHeader}>
      <SkeletonBone style={sk.sectionIcon} />
      <SkeletonBone style={sk.sectionTitle} />
    </View>
  );
}

function BookingsSkeleton() {
  return (
    <>
      <SkeletonSectionHeader />
      <SkeletonBookingCard />
      <SkeletonBookingCard />
      <SkeletonSectionHeader />
      <SkeletonBookingCard />
      <SkeletonBookingCard />
      <SkeletonBookingCard />
    </>
  );
}

const sk = StyleSheet.create({
  bone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: UNIFIED_THEME.borderRadius.md,
  },
  wrap: {
    padding: UNIFIED_THEME.spacing.lg,
    gap: UNIFIED_THEME.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UNIFIED_THEME.spacing.sm,
    marginTop: UNIFIED_THEME.spacing.sm,
    marginBottom: UNIFIED_THEME.spacing.xs,
  },
  sectionIcon: { width: 26, height: 26, borderRadius: 8 },
  sectionTitle: { height: 14, width: 140, borderRadius: 6 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: UNIFIED_THEME.spacing.md,
    gap: UNIFIED_THEME.spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: UNIFIED_THEME.spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  cardMeta: { flex: 1, gap: 8 },
  nameLine: { height: 13, width: '65%', borderRadius: 6 },
  dateLine: { height: 11, width: '80%', borderRadius: 6 },
  statusBadge: { height: 20, width: 70, borderRadius: 6 },
  amountLine: { height: 18, width: 52, borderRadius: 6 },
  cardActions: {
    flexDirection: 'row',
    gap: UNIFIED_THEME.spacing.sm,
    paddingTop: UNIFIED_THEME.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: UNIFIED_THEME.colors.border.light,
  },
  actionBtn: { flex: 1, height: 36, borderRadius: UNIFIED_THEME.borderRadius.md },
});

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;
const GLASS_BORDER = 'rgba(167,139,250,0.22)';

const PAGE_SIZE = 6;
const ENTRANCE_STEP_MS = 45;

function FadeSlideIn({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
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
        tension: 88,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function PressScale({ onPress, children, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[styles.pressScaleHit, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function SectionHeader({ title, icon, isFirst, delay }) {
  return (
    <FadeSlideIn delay={delay} style={[styles.secHdrRow, isFirst && styles.secHdrRowFirst]}>
      <View style={styles.secHdrLeft}>
        <View style={styles.secIconBox}>
          <MaterialIcons name={icon} size={14} color={PURPLE_LINK} />
        </View>
        <Text style={styles.secHdrTitle}>{title}</Text>
      </View>
    </FadeSlideIn>
  );
}

export default function LearnerBookingsScreen({ navigation }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomListPad = getFloatingTabBarContentInset(insets) + T.spacing.md;
  const [upcomingAll, setUpcomingAll] = useState([]);
  const [upcomingShown, setUpcomingShown] = useState(PAGE_SIZE);
  const [history, setHistory] = useState([]);
  const [historyShown, setHistoryShown] = useState(PAGE_SIZE);
  const [reviewedIds, setReviewedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadReviewedIds = useCallback(async bookings => {
    const completedIds = (bookings || [])
      .filter(b => b.status === 'completed')
      .map(b => b.id);
    if (!completedIds.length) {
      setReviewedIds(new Set());
      return;
    }
    try {
      const reviewed = await reviewsApi.getReviewedBookingIds(completedIds);
      setReviewedIds(reviewed);
    } catch (err) {
      console.warn('Failed to load review status:', err?.message || err);
    }
  }, []);

  const loadInitial = useCallback(async ({ showSkeleton = true, isActive = () => true } = {}) => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      if (showSkeleton) setLoading(true);
      setHistoryPage(0);
      setHasMoreHistory(true);
      setUpcomingShown(PAGE_SIZE);
      setHistoryShown(PAGE_SIZE);

      const [upcomingData, historyData] = await Promise.all([
        bookingApi.getUpcomingBookingsByLearner(profile.id),
        bookingApi.getBookingHistoryByLearner(profile.id, 0, PAGE_SIZE),
      ]);

      if (!isActive()) return;

      const normalizeBooking = b => ({
        ...b,
        recordingUrl: normalizeRecordingUrl(playbackUrlFromBooking(b)) || null,
      });

      const isSessionPast = isBookingSessionPast;

      const allUpcoming = (upcomingData || []).map(normalizeBooking);
      const historyNorm = (historyData || []).map(normalizeBooking);

      const upcomingNorm = allUpcoming.filter(b => !isSessionPast(b));
      const expiredNorm = allUpcoming.filter(b => isSessionPast(b));

      const merged = [...expiredNorm, ...historyNorm].sort((a, b) => {
        const da = `${a.availability_slots?.date ?? ''} ${a.availability_slots?.start_time ?? ''}`;
        const db = `${b.availability_slots?.date ?? ''} ${b.availability_slots?.start_time ?? ''}`;
        return db.localeCompare(da);
      });

      if (!isActive()) return;

      setUpcomingAll(upcomingNorm);
      setHistory(merged);
      setHistoryPage(1);
      setHasMoreHistory(historyNorm.length === PAGE_SIZE);

      if (showSkeleton) setLoading(false);
      void loadReviewedIds(merged);
    } catch (error) {
      if (!isActive()) return;
      console.error('Error loading bookings:', error);
      Toast.show('Failed to load bookings: ' + error.message);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [profile?.id, loadReviewedIds]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) {
        setLoading(false);
        return undefined;
      }
      let active = true;
      const showSkeleton = !hasLoadedRef.current;
      hasLoadedRef.current = true;
      loadInitial({ showSkeleton, isActive: () => active });
      return () => {
        active = false;
      };
    }, [profile?.id, loadInitial]),
  );

  const loadMoreHistory = useCallback(async () => {
    // If there are in-memory items not yet shown, just reveal them
    if (historyShown < history.length) {
      setHistoryShown(prev => prev + PAGE_SIZE);
      return;
    }
    // Otherwise fetch next page from server
    if (loadingMore || !hasMoreHistory || !profile?.id) return;
    try {
      setLoadingMore(true);
      const data = await bookingApi.getBookingHistoryByLearner(profile.id, historyPage, PAGE_SIZE);
      const newItems = (data || []).map(b => ({
        ...b,
        recordingUrl: normalizeRecordingUrl(playbackUrlFromBooking(b)) || null,
      }));

      setHistory(prev => {
        const next = [...prev, ...newItems];
        void loadReviewedIds(next);
        return next;
      });
      setHistoryShown(prev => prev + PAGE_SIZE);
      setHistoryPage(p => p + 1);
      setHasMoreHistory(newItems.length === PAGE_SIZE);
    } catch {
      Toast.show('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [historyShown, history.length, loadingMore, hasMoreHistory, profile?.id, historyPage, loadReviewedIds]);

  const loadMoreUpcoming = () => {
    setUpcomingShown(prev => prev + PAGE_SIZE);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitial({ showSkeleton: false });
    setRefreshing(false);
  };

  const handleJoinCall = booking => {
    navigation.navigate('VideoCall_Screen', { bookingId: booking.id, isHost: false });
  };

  const handleCancelBooking = async booking => {
    try {
      await bookingApi.cancelBooking(booking.id);
      Toast.show('Booking cancelled');
      await loadInitial({ showSkeleton: false });
    } catch {
      Toast.show('Failed to cancel booking');
    }
  };

  const handleOpenRecording = rawUrl => {
    const url = normalizeRecordingUrl(rawUrl);
    if (!url) { Toast.show('Recording link is unavailable'); return; }
    navigation.navigate(SCREEN_NAMES.RecordingPlayer, { recordingUrl: url });
  };

  const handleDownloadRecording = rawUrl => {
    const url = normalizeRecordingUrl(rawUrl);
    if (!url) {
      Toast.show('Recording link is unavailable');
      return;
    }
    saveRecordingToGallery(url);
  };

  const renderBooking = (item, isUpcoming, entranceDelay) => {
    let statusLabel;
    if (isExpiredBooking(item)) {
      statusLabel = 'Expired';
    } else if (isUpcoming && (item.status === 'pending' || item.status === 'confirmed')) {
      statusLabel = 'Booked';
    } else if (item.status === 'completed') {
      statusLabel = 'Completed';
    } else if (item.status === 'cancelled' || item.status === 'rejected') {
      statusLabel = 'Cancelled';
    } else {
      statusLabel = item.status;
    }

    const canRate = item.status === 'completed' && !reviewedIds.has(item.id);

    return (
      <BookingCard
        key={item.id}
        booking={item}
        isMentor={false}
        onPressJoin={isUpcoming ? () => handleJoinCall(item) : null}
        onPressCancel={isUpcoming ? () => handleCancelBooking(item) : null}
        onPressRecording={item.recordingUrl ? () => handleOpenRecording(item.recordingUrl) : null}
        onPressDownload={
          item.recordingUrl ? () => handleDownloadRecording(item.recordingUrl) : null
        }
        onPressRate={
          canRate
            ? () => navigation.navigate(SCREEN_NAMES.Review, {
                bookingId: item.id,
                mentorId: item.mentor_id,
                mentorName: item.profiles?.name || 'Mentor',
              })
            : null
        }
        statusLabel={statusLabel}
        entranceDelay={entranceDelay}
        pressScale
      />
    );
  };

  const visibleUpcoming = upcomingAll.slice(0, upcomingShown);
  const hasMoreUpcoming = upcomingAll.length > upcomingShown;
  const fullyEmpty = upcomingAll.length === 0 && history.length === 0 && !loading;

  // Build FlatList data: upcoming section + history section
  const listData = [];
  let animStep = 0;
  const nextDelay = () => {
    const delay = animStep * ENTRANCE_STEP_MS;
    animStep += 1;
    return delay;
  };

  if (fullyEmpty) {
    listData.push({ type: 'empty', key: 'empty', delay: nextDelay() });
  } else {
    listData.push({
      type: 'section_header',
      key: 'upcoming_header',
      title: 'Upcoming',
      icon: 'event',
      isFirst: true,
      delay: nextDelay(),
    });
    if (upcomingAll.length === 0) {
      listData.push({
        type: 'empty_section',
        key: 'upcoming_empty',
        icon: 'event-available',
        text: 'No upcoming sessions',
        delay: nextDelay(),
      });
    } else {
      visibleUpcoming.forEach(b => listData.push({
        type: 'booking',
        key: b.id,
        item: b,
        isUpcoming: true,
        delay: nextDelay(),
      }));
      if (hasMoreUpcoming) {
        listData.push({ type: 'load_more_upcoming', key: 'load_more_upcoming', delay: nextDelay() });
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
    if (visibleHistory.length === 0 && !loadingMore) {
      listData.push({
        type: 'empty_section',
        key: 'history_empty',
        icon: 'history',
        text: 'No past sessions yet',
        delay: nextDelay(),
      });
    } else {
      visibleHistory.forEach(b => listData.push({
        type: 'booking',
        key: b.id,
        item: b,
        isUpcoming: false,
        delay: nextDelay(),
      }));
    }

    if (hasMoreHistoryToShow) {
      listData.push({ type: 'load_more', key: 'load_more', delay: nextDelay() });
    }
  }

  const renderItem = ({ item }) => {
    switch (item.type) {
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
              <View style={styles.placeholderIconRing}>
                <MaterialIcons name={item.icon} size={20} color={PURPLE_LINK} />
              </View>
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

      case 'load_more_upcoming':
        return (
          <FadeSlideIn delay={item.delay}>
            <PressScale onPress={loadMoreUpcoming} style={styles.loadMoreBtn}>
              <Text style={styles.loadMoreTxt}>Show more upcoming</Text>
              <MaterialIcons name="expand-more" size={18} color={PURPLE_LINK} />
            </PressScale>
          </FadeSlideIn>
        );

      case 'load_more':
        return (
          <FadeSlideIn delay={item.delay}>
            <PressScale onPress={loadMoreHistory} disabled={loadingMore} style={styles.loadMoreBtn}>
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
              <View style={styles.emptyIconRing}>
                <MaterialIcons name="calendar-month" size={40} color={PURPLE_LINK} />
              </View>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtitle}>
                Browse mentors from Discover and book your first session.
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
      {loading ? (
        <View style={[sk.wrap, { paddingBottom: bottomListPad }]}>
          <BookingsSkeleton />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={listData}
          keyExtractor={item => item.key}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomListPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TEAL}
            />
          }
        />
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
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
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: T.spacing.sm,
    marginTop: T.spacing.xs,
    marginBottom: T.spacing.md,
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
});
