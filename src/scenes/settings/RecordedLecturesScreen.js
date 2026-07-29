import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
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
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import CosmicButton from '../../components/CosmicButton';
import { useAuth } from '../../hooks/useAuth';
import { bookingApi } from '../../api/bookingApi';
import {
  getToken,
  fetchRecordingUrls,
  normalizeRecordingUrl,
  isTokenEndpointConfigured,
} from '../../api/api';
import {
  playbackUrlFromBooking,
  meetingIdFromBooking,
  recordingsApi,
} from '../../api/recordingsApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { saveRecordingToGallery } from '../../utils/recordingActions';

const T = UNIFIED_THEME;
const C = T.colors;
const S = C.surface;

const PURPLE_LINK = C.buttons.nebulaGradient[0];
const TEAL = C.accent.secondary;

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
  const styles = useThemedStyles(createRecordedStyles);
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

function HoverHighlight({
  children,
  style,
  onPress,
  disabled,
  pressScale = 0.98,
  hoverScale = 1.02,
  highlightRadius = 16,
}) {
  const styles = useThemedStyles(createRecordedStyles);
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

  const handlers = {
    disabled,
    onPressIn: () => {
      if (disabled) return;
      springTo(pressScale);
      setHighlight(true);
    },
    onPressOut: () => {
      springTo(hovered.current ? hoverScale : 1);
      if (!hovered.current) setHighlight(false);
    },
    onHoverIn: () => {
      if (disabled) return;
      hovered.current = true;
      springTo(hoverScale);
      setHighlight(true);
    },
    onHoverOut: () => {
      hovered.current = false;
      springTo(1);
      setHighlight(false);
    },
  };

  return (
    <Pressable onPress={onPress} {...handlers}>
      {content}
    </Pressable>
  );
}

function AnimatedPressable({ children, style, onPress, disabled, hoverScale = 1.08, pressScale = 0.92 }) {
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

function SectionHeader({ title, subtitle, replayToken = 0 }) {
  const styles = useThemedStyles(createRecordedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const S = C.surface;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const GLASS_BORDER = C.border.light;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const iconBob = useRef(new Animated.Value(0)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, 40);
      return;
    }
    if (replayToken > 0) runEntrance(opacity, translateY, 40);
  }, [replayToken, opacity, translateY]);

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
    <Animated.View style={[styles.sectionHeader, { opacity, transform: [{ translateY }] }]}>
      <Animated.View
        style={[
          styles.sectionIcon,
          { backgroundColor: S.accentTeal, transform: [{ translateY: iconTranslateY }] },
        ]}
      >
        <MaterialIcons name="play-circle-filled" size={16} color={TEAL} />
      </Animated.View>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </Animated.View>
  );
}

function getRecordingSortDate(booking) {
  const date = booking?.availability_slots?.date;
  const time = booking?.availability_slots?.start_time;
  if (date && time) return new Date(`${date}T${time}`);
  return new Date(booking?.created_at || 0);
}

function formatRecordingDate(booking) {
  const date = booking?.availability_slots?.date;
  const time = booking?.availability_slots?.start_time;
  if (!date) return '—';
  const base = moment(date);
  if (!base.isValid()) return '—';
  if (time) {
    const [h, m] = time.split(':');
    return base.clone().hour(parseInt(h, 10)).minute(parseInt(m, 10)).format('DD MMM · hh:mm A');
  }
  return base.format('DD MMM YYYY');
}

function mergeRecordings(mentorList, learnerList) {
  const seen = new Map();

  [...(mentorList || []), ...(learnerList || [])].forEach(item => {
    if (!item?.recordingUrl) return;
    const key = item.id || `${item.booking_id || 'b'}-${item.recordingIndex ?? 0}`;
    if (!seen.has(key)) seen.set(key, item);
  });

  return Array.from(seen.values()).sort(
    (a, b) => getRecordingSortDate(b) - getRecordingSortDate(a),
  );
}

async function enrichBookingsWithRecordings(bookings, token) {
  const enrichedGroups = await Promise.all(
    (bookings || []).map(async booking => {
      const existing = playbackUrlFromBooking(booking);
      if (existing) {
        return [{ ...booking, recordingUrl: existing, recordingIndex: 0 }];
      }

      const meetingId = meetingIdFromBooking(booking);
      if (!token || !meetingId) return [];

      const urls = await fetchRecordingUrls({ meetingId, token });

      if (urls.length > 0) {
        try {
          await recordingsApi.updateRecordingUrls({
            bookingId: booking.id,
            recordingUrl: urls[0],
            recordingPlaybackUrl: urls[0],
            mentorId: booking.mentor_id,
            learnerId: booking.learner_id,
            meetingId,
          });
        } catch (err) {
          console.warn('Could not persist recording URL:', err?.message);
        }
      }

      return urls.map((recordingUrl, idx) => ({
        ...booking,
        id: `${booking.id}-rec-${idx}`,
        recordingUrl,
        recordingIndex: idx,
      }));
    }),
  );

  return enrichedGroups.flat();
}

async function getTokenWithTimeout(timeoutMs = 6000) {
  if (!isTokenEndpointConfigured) return null;

  return Promise.race([
    getToken(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Token request timed out')), timeoutMs),
    ),
  ]);
}

function RecordingRow({
  item,
  index,
  isLast,
  replayToken,
  onPressRecording,
  onPressDownload,
}) {
  const styles = useThemedStyles(createRecordedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const S = C.surface;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const GLASS_BORDER = C.border.light;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-10)).current;
  const hasEntered = useRef(false);
  const personName = item.profiles?.name || 'Session partner';
  const avatarUrl = item.profiles?.avatar_url;

  useEffect(() => {
    const delay = 80 + index * 45;
    const play = () => {
      opacity.setValue(0);
      translateX.setValue(-10);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 280,
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

  return (
    <HoverHighlight
      style={[styles.rowWrap, isLast && styles.rowWrapLast]}
      hoverScale={1.008}
      pressScale={0.995}
      highlightRadius={12}
    >
      <Animated.View
        style={[
          styles.row,
          isLast && styles.rowLast,
          { opacity, transform: [{ translateX }] },
        ]}
      >
        <View style={styles.rowTop}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <MaterialIcons name="person" size={20} color={PURPLE_LINK} />
            </View>
          )}

          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>{personName}</Text>
            <View style={styles.rowMeta}>
              <MaterialIcons name="schedule" size={13} color={C.text.muted} />
              <Text style={styles.rowDate}>{formatRecordingDate(item)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rowActions}>
          <CosmicButton
            label="Replay"
            variant="info"
            size="compact"
            icon="play-circle-filled"
            onPress={onPressRecording}
            pressScale
            style={styles.actionBtn}
          />
          <CosmicButton
            label="Download"
            variant="outline"
            size="compact"
            icon="file-download"
            onPress={onPressDownload}
            pressScale
            style={styles.actionBtn}
          />
        </View>
      </Animated.View>
    </HoverHighlight>
  );
}

function EmptyState() {
  const styles = useThemedStyles(createRecordedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const S = C.surface;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const GLASS_BORDER = C.border.light;
  const float = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 480,
      delay: 100,
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

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <Animated.View style={[styles.emptyState, { opacity }]}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY }] }]}>
        <PulseGlow color={PURPLE_LINK} size={72} />
        <MaterialIcons name="video-library" size={32} color={PURPLE_LINK} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No recordings yet</Text>
      <Text style={styles.emptySubtitle}>
        Recordings from your completed sessions will appear here.
      </Text>
    </Animated.View>
  );
}

export default function RecordedLecturesScreen({ navigation }) {
  const styles = useThemedStyles(createRecordedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const S = C.surface;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const GLASS_BORDER = C.border.light;
  const { profile } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;

    const [mentorRows, learnerRows] = await Promise.all([
      bookingApi.getBookingsByMentor(profile.id),
      bookingApi.getBookingsByLearner(profile.id),
    ]);

    const quickMentor = (mentorRows || [])
      .map(b => ({ ...b, recordingUrl: playbackUrlFromBooking(b) }))
      .filter(b => b.recordingUrl);
    const quickLearner = (learnerRows || [])
      .map(b => ({ ...b, recordingUrl: playbackUrlFromBooking(b) }))
      .filter(b => b.recordingUrl);

    setRecordings(mergeRecordings(quickMentor, quickLearner));
    setLoading(false);
    loadedRef.current = true;

    let token = null;
    try {
      token = await getTokenWithTimeout(6000);
    } catch {
      return;
    }

    const [mentorEnriched, learnerEnriched] = await Promise.all([
      enrichBookingsWithRecordings(mentorRows, token),
      enrichBookingsWithRecordings(learnerRows, token),
    ]);

    setRecordings(
      mergeRecordings(
        mentorEnriched.filter(b => b.recordingUrl),
        learnerEnriched.filter(b => b.recordingUrl),
      ),
    );
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!loadedRef.current) setLoading(true);
          await load();
        } catch {
          if (!cancelled) {
            Toast.show('Failed to load recordings');
            setLoading(false);
          }
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

  const openRecording = useCallback(
    rawUrl => {
      const url = normalizeRecordingUrl(rawUrl);
      if (!url) {
        Toast.show('Recording link is unavailable');
        return;
      }
      navigation.navigate(SCREEN_NAMES.RecordingPlayer, { recordingUrl: url });
    },
    [navigation],
  );

  const downloadRecording = useCallback(rawUrl => {
    const url = normalizeRecordingUrl(rawUrl);
    if (!url) {
      Toast.show('Recording link is unavailable');
      return;
    }
    saveRecordingToGallery(url);
  }, []);

  const count = recordings.length;
  const listSubtitle = count
    ? `${count} recording${count === 1 ? '' : 's'} · newest first`
    : 'Your session recordings will show up here';

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
      <FadeSlideIn delay={0} replayToken={replayToken}>
        <View style={styles.header}>
          <AnimatedPressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hoverScale={1.08}
            pressScale={0.92}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </AnimatedPressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Recorded lectures</Text>
            <Text style={styles.headerSubtitle}>Session recordings</Text>
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
        <SectionHeader title="All recordings" subtitle={listSubtitle} replayToken={replayToken} />

        <FadeSlideIn delay={80} replayToken={replayToken}>
          <HoverHighlight style={styles.listCard} hoverScale={1.004} pressScale={0.998} highlightRadius={16}>
            {count > 0 ? (
              recordings.map((item, index) => (
                <RecordingRow
                  key={item.id}
                  item={item}
                  index={index}
                  isLast={index === count - 1}
                  replayToken={replayToken}
                  onPressRecording={() => openRecording(item.recordingUrl)}
                  onPressDownload={() => downloadRecording(item.recordingUrl)}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </HoverHighlight>
        </FadeSlideIn>
      </ScrollView>

      <LoadingOverlay visible={loading && !loadedRef.current} message="Loading recordings…" />
    </SafeScreen>
  );
}

function createRecordedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
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

  pulseGlow: {
    position: 'absolute',
    borderWidth: 2,
  },
  hoverHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.1)',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
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

  listCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
  },

  rowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  rowWrapLast: {
    borderBottomWidth: 0,
  },
  row: {
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
  },
  rowLast: {},
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  avatarPlaceholder: {
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text.primary,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rowDate: {
    fontSize: 12,
    color: C.text.muted,
  },
  rowActions: {
    flexDirection: 'row',
    gap: T.spacing.sm,
    marginTop: T.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxl,
    paddingHorizontal: T.spacing.lg,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.text.primary,
    marginBottom: T.spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
}















