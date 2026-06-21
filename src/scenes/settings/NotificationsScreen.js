import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { notificationApi } from '../../api/notificationApi';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
];

const ACCENT_COLORS = {
  gold: GOLD,
  teal: TEAL,
  purple: PURPLE_LINK,
  error: C.accent.error,
  muted: C.text.muted,
};

const ACCENT_BG = {
  gold: S.accentGold,
  teal: S.accentTeal,
  purple: S.accentViolet,
  error: 'rgba(248,113,113,0.12)',
  muted: 'rgba(255,255,255,0.06)',
};

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

function AnimatedPressable({ children, style, onPress, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 7,
      tension: 280,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function relativeDayLabel(iso) {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday - startTarget) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function groupNotifications(items) {
  const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const buckets = {};
  items.forEach((item) => {
    const key = relativeDayLabel(item.timestamp);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(item);
  });
  return order
    .filter((key) => buckets[key]?.length)
    .map((key) => ({ title: key, data: buckets[key] }));
}

function FilterChip({ label, active, onPress }) {
  const glow = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: active ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, glow]);

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(167,139,250,0.18)', 'rgba(94,234,212,0.55)'],
  });

  const backgroundColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_BG, 'rgba(94,234,212,0.12)'],
  });

  return (
    <AnimatedPressable onPress={onPress}>
      <Animated.View style={[styles.chip, { borderColor, backgroundColor }]}>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

function NotificationRow({ item, isRead, onPress, index, animateKey }) {
  const accent = ACCENT_COLORS[item.accent] || PURPLE_LINK;
  const accentBg = ACCENT_BG[item.accent] || S.accentViolet;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runEntrance(opacity, translateY, Math.min(index * 50, 400));
    Animated.loop(
      Animated.sequence([
        Animated.timing(chevron, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(chevron, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animateKey, index]);

  const chevronX = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        style={[styles.row, !isRead && styles.rowUnread]}
        onPress={() => onPress(item)}
      >
        <View style={styles.rowLeft}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: accentBg }]}>
              <MaterialIcons name={item.icon} size={22} color={accent} />
            </View>
          )}
          {!isRead ? <View style={styles.unreadDot} /> : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowTime}>{formatTime(item.timestamp)}</Text>
          </View>
          <Text style={styles.rowBodyText} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
          <MaterialIcons name="chevron-right" size={20} color={C.text.muted} />
        </Animated.View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function SectionHeader({ title }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [title]);

  return (
    <Animated.Text style={[styles.sectionLabel, { opacity }]}>{title}</Animated.Text>
  );
}

function EmptyState() {
  const opacity = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    runEntrance(opacity, floatY, 80);
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.06,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.empty, { opacity, transform: [{ translateY: floatY }] }]}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ scale: iconScale }] }]}>
        <MaterialIcons name="notifications-none" size={40} color={TEAL} />
      </Animated.View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptySub}>
        Session updates and booking alerts will show up here.
      </Text>
    </Animated.View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const { profile } = useAuth();
  const { markAsRead, markAllRead, syncUnreadCount, isRead } = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [listAnimKey, setListAnimKey] = useState(0);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(12)).current;
  const filtersOpacity = useRef(new Animated.Value(0)).current;
  const filtersY = useRef(new Animated.Value(10)).current;

  const loadNotifications = useCallback(async (silent = false) => {
    if (!profile?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const rows = await notificationApi.getNotifications(profile.id);
      setNotifications(rows);
      syncUnreadCount(rows);
      setListAnimKey((k) => k + 1);
    } catch {
      Toast.show('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, syncUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      runEntrance(headerOpacity, headerY, 0);
      runEntrance(filtersOpacity, filtersY, 90);
    }, [loadNotifications]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(true);
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

  const sections = useMemo(() => groupNotifications(filtered), [filtered]);

  const flatIndexMap = useMemo(() => {
    const map = new Map();
    let i = 0;
    sections.forEach((section) => {
      section.data.forEach((item) => {
        map.set(item.id, i);
        i += 1;
      });
    });
    return map;
  }, [sections]);

  const handleFilterChange = (id) => {
    setFilter(id);
    setListAnimKey((k) => k + 1);
  };

  const handleMarkAllRead = () => {
    markAllRead(notifications.map((n) => n.id));
    Toast.show('All notifications marked as read', Toast.SHORT);
  };

  const handlePress = (item) => {
    markAsRead(item.id);

    if (item.status === 'completed' && item.role === 'learner') {
      navigation.navigate(SCREEN_NAMES.Review, { bookingId: item.bookingId });
      return;
    }

    if (item.role === 'mentor') {
      navigation.navigate(SCREEN_NAMES.RootUnifiedTabs, {
        screen: SCREEN_NAMES.MentorSection,
        params: { screen: SCREEN_NAMES.MentorCalls },
      });
      return;
    }

    navigation.navigate(SCREEN_NAMES.RootUnifiedTabs, {
      screen: SCREEN_NAMES.LearnerSection,
      params: { screen: SCREEN_NAMES.LearnerBookings },
    });
  };

  const unreadInView = filtered.filter((n) => !isRead(n.id)).length;

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop} style={styles.headerShell}>
      <Animated.View
        style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}
      >
        <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <AnimatedPressable
          onPress={handleMarkAllRead}
          style={styles.markReadBtn}
          disabled={!unreadInView}
        >
          <Text style={[styles.markReadText, !unreadInView && styles.markReadTextDisabled]}>
            Mark read
          </Text>
        </AnimatedPressable>
      </Animated.View>
      </StackScreenHeader>

      <View style={styles.body}>
      <Animated.View
        style={[
          styles.filterRow,
          { opacity: filtersOpacity, transform: [{ translateY: filtersY }] },
        ]}
      >
        {FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => handleFilterChange(f.id)}
          />
        ))}
        {loading && !refreshing ? (
          <ActivityIndicator size="small" color={TEAL} style={styles.filterSpinner} />
        ) : null}
      </Animated.View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => <SectionHeader title={title} />}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            isRead={isRead(item.id)}
            onPress={handlePress}
            index={flatIndexMap.get(item.id) ?? 0}
            animateKey={listAnimKey}
          />
        )}
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        contentContainerStyle={[
          styles.listContent,
          !sections.length && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} />
        }
      />
      </View>

      <LoadingOverlay visible={loading && !refreshing && notifications.length === 0} />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    paddingHorizontal: T.spacing.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: T.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: C.text.primary,
    fontWeight: '800',
  },
  markReadBtn: {
    minWidth: 72,
    alignItems: 'flex-end',
    paddingVertical: 6,
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
  },
  markReadTextDisabled: {
    color: C.text.disabled,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginBottom: T.spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text.secondary,
  },
  chipTextActive: {
    color: TEAL,
  },
  filterSpinner: {
    marginLeft: 'auto',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: PURPLE_LINK,
    marginBottom: T.spacing.sm,
    marginTop: T.spacing.sm,
  },
  listContent: {
    paddingBottom: T.spacing.xxxl,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    padding: T.spacing.md,
    marginBottom: T.spacing.sm,
  },
  rowUnread: {
    borderColor: 'rgba(94,234,212,0.28)',
    backgroundColor: 'rgba(22,20,50,0.95)',
  },
  rowLeft: {
    position: 'relative',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEAL,
    borderWidth: 2,
    borderColor: PANEL_BG,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.spacing.sm,
    marginBottom: 4,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: C.text.primary,
  },
  rowTime: {
    fontSize: 11,
    color: C.text.muted,
  },
  rowBodyText: {
    fontSize: 12,
    color: C.text.secondary,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: T.spacing.xl,
    paddingVertical: T.spacing.xxxl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
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
  emptySub: {
    fontSize: 13,
    color: C.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
