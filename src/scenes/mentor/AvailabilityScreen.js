import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Toast from 'react-native-simple-toast';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import { UNIFIED_THEME } from '../../unifiedTheme';
import CosmicButton from '../../components/CosmicButton';
import { useAuth } from '../../hooks/useAuth';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { availabilityApi } from '../../api/availabilityApi';
import {
  useScheduleStyles,
  ScheduleSectionBlock,
  SchedulePreviewBar,
  SchedulePreviewChip,
  ScheduleDayCell,
  ScheduleHeroBanner,
  ScheduleCalendarLegend,
  CALENDAR_DAY_LABELS,
  padCalendarWeeks,
} from '../../components/schedule/ScheduleUI';

const T = UNIFIED_THEME;
const B = T.colors.buttons;
const ENTRANCE_STEP_MS = 45;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const layoutSpring = () => {
  // LayoutAnimation + transform on iOS can crash RN (vector index out of bounds in interpolateViewProps).
  if (Platform.OS !== 'android') return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(280, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
};

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
    <Animated.View
      style={[
        style,
        {
          opacity,
          // iOS: avoid native-driven scale on wrappers that contain Pressables.
          transform:
            Platform.OS === 'ios'
              ? [{ translateY }]
              : [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function PressScale({
  onPress,
  children,
  style,
  disabled,
  scaleTo = 0.94,
  showGlow = false,
}) {
  const styles = useThemedStyles(createAvailabilityStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

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
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, showGlow ? 0.45 : 0],
  });

  // Pressable must stay outside native-driven scale (iOS hit-testing).
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[styles.pressHit, style]}
    >
      {showGlow ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pressGlow, { opacity: glowOpacity }]}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

function PublishScheduleButton({ saving, loading, hasUnsavedChanges, justPublished, onPress }) {
  const styles = useThemedStyles(createAvailabilityStyles);
  const btnScale = useRef(new Animated.Value(1)).current;
  const successGlow = useRef(new Animated.Value(0)).current;
  const successRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!justPublished) {
      btnScale.setValue(1);
      successGlow.setValue(0);
      successRing.setValue(0);
      return undefined;
    }

    btnScale.setValue(1);
    successGlow.setValue(0);
    successRing.setValue(0);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.spring(btnScale, {
          toValue: 1.06,
          friction: 4,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.timing(successGlow, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(successRing, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(btnScale, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(successGlow, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [justPublished, btnScale, successGlow, successRing]);

  const glowOpacity = successGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] });
  const ringScale = successRing.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4] });
  const ringOpacity = successRing.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.6, 0] });

  const label = saving
    ? 'Saving…'
    : justPublished
      ? 'Published!'
      : hasUnsavedChanges
        ? 'Publish schedule'
        : 'Up to date';

  return (
    <Animated.View style={[styles.publishBtnOuter, { transform: [{ scale: btnScale }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.publishSuccessRing,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      <View style={styles.publishBtnWrap}>
        <Animated.View
          pointerEvents="none"
          style={[styles.publishSuccessGlow, { opacity: glowOpacity }]}
        />
        <CosmicButton
          label={label}
          variant="premium"
          onPress={onPress}
          disabled={saving || loading || (!hasUnsavedChanges && !justPublished)}
          loading={saving}
          icon={justPublished ? 'check-circle' : undefined}
          pressScale={!saving && !justPublished && hasUnsavedChanges}
          style={styles.saveBtn}
        />
      </View>
    </Animated.View>
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

function ScheduleSkeleton() {
  return (
    <View style={sk.wrap}>
      <SkeletonBone style={sk.hero} />
      <SkeletonBone style={sk.preview} />
      <SkeletonBone style={sk.sectionTitle} />
      <SkeletonBone style={sk.calendar} />
      <SkeletonBone style={sk.sectionTitle} />
      <SkeletonBone style={sk.slots} />
    </View>
  );
}

const sk = StyleSheet.create({
  bone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: T.borderRadius.md,
  },
  wrap: { gap: T.spacing.md },
  hero: { height: 64, borderRadius: 8 },
  preview: { height: 44, borderRadius: 14 },
  sectionTitle: { height: 36, width: '55%', borderRadius: 8 },
  calendar: { height: 280, borderRadius: 16 },
  slots: { height: 180, borderRadius: 16 },
});

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

const SLOT_DURATION = 30;

const SLOT_PERIODS = [
  { id: 'night',      label: 'Night',      hint: '0:00 – 5:30',   icon: 'nights-stay',    startHour: 0,  endHour: 6  },
  { id: 'morning',    label: 'Morning',    hint: '6:00 – 11:30',  icon: 'wb-sunny',       startHour: 6,  endHour: 12 },
  { id: 'afternoon',  label: 'Afternoon',  hint: '12:00 – 16:30', icon: 'brightness-5',   startHour: 12, endHour: 17 },
  { id: 'evening',    label: 'Evening',    hint: '17:00 – 21:30', icon: 'nightlight-round', startHour: 17, endHour: 22 },
  { id: 'late_night', label: 'Late Night', hint: '22:00 – 23:30', icon: 'bedtime',         startHour: 22, endHour: 24 },
];

function formatSlotTime(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getSlotPeriodId(startTime) {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour < 6)  return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late_night';
}

function groupTimeSlots(slots) {
  const grouped = { night: [], morning: [], afternoon: [], evening: [], late_night: [] };
  slots.forEach((startTime, index) => {
    grouped[getSlotPeriodId(startTime)].push({ startTime, index });
  });
  return grouped;
}

const GROUPED_TIME_SLOTS = groupTimeSlots(TIME_SLOTS);

function SlotsLegend() {
  const styles = useThemedStyles(createAvailabilityStyles);
  return (
    <View style={styles.slotsLegend}>
      <View style={styles.slotsLegendItem}>
        <View style={[styles.slotsLegendSwatch, styles.slotsLegendAvailable]} />
        <Text style={styles.slotsLegendText}>Available</Text>
      </View>
      <View style={styles.slotsLegendItem}>
        <View style={[styles.slotsLegendSwatch, styles.slotsLegendSelected]} />
        <Text style={styles.slotsLegendText}>Selected</Text>
      </View>
      <View style={styles.slotsLegendItem}>
        <View style={[styles.slotsLegendSwatch, styles.slotsLegendBooked]} />
        <Text style={styles.slotsLegendText}>Booked</Text>
      </View>
      <View style={styles.slotsLegendItem}>
        <View style={[styles.slotsLegendSwatch, styles.slotsLegendPast]} />
        <Text style={styles.slotsLegendText}>Past</Text>
      </View>
    </View>
  );
}

function ScheduleTimeChip({ startTime, endTime, state, onPress, delayIndex = 0 }) {
  const styles = useThemedStyles(createAvailabilityStyles);
  const { theme } = useTheme();
  const B = theme.colors.buttons;
  const C = theme.colors;
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const isInteractive = state === 'available' || state === 'selected';

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      delay: Math.min(delayIndex * 12, 280),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delayIndex, entrance]);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: state === 'selected' ? 1.02 : 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [scale, state]);

  const onPressIn = () => {
    if (!isInteractive) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, friction: 6, tension: 160, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
    if (!isInteractive) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: state === 'selected' ? 1.02 : 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(glow, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });
  const chipOpacity = entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const chipY = entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  // iOS: native-driven scale on the Pressable ancestor breaks hit-testing (same fix as BookingScreen).
  const chipTransform =
    Platform.OS === 'ios'
      ? [{ translateY: chipY }]
      : [{ translateY: chipY }, { scale }];

  const stateStyles = {
    available: styles.timeSlotAvailable,
    selected: styles.timeSlotSelected,
    booked: styles.timeSlotBooked,
    past: styles.timeSlotPast,
  };

  const stateTextStyles = {
    available: styles.timeSlotText,
    selected: styles.timeSlotTextSelected,
    booked: styles.timeSlotTextBooked,
    past: styles.timeSlotTextPast,
  };

  const statusIcon = {
    available: null,
    selected: 'check-circle',
    booked: 'lock',
    past: 'schedule',
  }[state];

  const statusColor = {
    available: C.accent.success,
    selected: B.successText,
    booked: C.accent.warning,
    past: C.text.muted,
  }[state];

  const cellBody = (
    <Animated.View
      style={[
        styles.timeSlotCell,
        stateStyles[state],
        { opacity: chipOpacity, transform: chipTransform },
      ]}
    >
      {state === 'selected' ? (
        <LinearGradient
          colors={B.successGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {statusIcon ? (
        <MaterialIcons
          name={statusIcon}
          size={13}
          color={statusColor}
          style={styles.timeSlotStatusIcon}
        />
      ) : null}
      <Text style={[styles.timeSlotStart, stateTextStyles[state]]} numberOfLines={1}>
        {formatSlotTime(startTime)}
      </Text>
      <Text style={[styles.timeSlotEnd, stateTextStyles[state]]} numberOfLines={1}>
        to {formatSlotTime(endTime)}
      </Text>
    </Animated.View>
  );

  // Keep Pressable outside native-driven transforms so iOS taps register.
  if (!isInteractive) {
    return <View style={styles.slotCellWrap}>{cellBody}</View>;
  }

  return (
    <View style={styles.slotCellWrap}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.timeSlotPress}
      >
        <Animated.View pointerEvents="none" style={[styles.timeSlotGlow, { opacity: glowOpacity }]} />
        {cellBody}
      </Pressable>
    </View>
  );
}

function SlotPeriodSection({ period, items, selectedDate, selectedSlots, bookedSlots, onToggle }) {
  const styles = useThemedStyles(createAvailabilityStyles);
  const { theme } = useTheme();
  const slotAccent = theme.colors.accent.success;

  // Hide slots that are already due — mentors should only manage upcoming times.
  const visibleItems = (items || []).filter(
    ({ startTime }) => !isTimeInPast(selectedDate, startTime),
  );
  if (!visibleItems.length) return null;

  const selectedInPeriod = visibleItems.filter(({ startTime }) => {
    const endTime = addMinutesToTimeStatic(startTime, SLOT_DURATION);
    return selectedSlots.includes(`${startTime}-${endTime}`);
  }).length;

  return (
    <View style={styles.slotPeriodBlock}>
      <View style={styles.slotPeriodHeader}>
        <View style={styles.slotPeriodTitleRow}>
          <View style={styles.slotPeriodIcon}>
            <MaterialIcons name={period.icon} size={14} color={slotAccent} />
          </View>
          <View>
            <Text style={styles.slotPeriodTitle}>{period.label}</Text>
            <Text style={styles.slotPeriodHint}>{period.hint}</Text>
          </View>
        </View>
        {selectedInPeriod > 0 ? (
          <View style={styles.slotPeriodBadge}>
            <Text style={styles.slotPeriodBadgeText}>{selectedInPeriod} selected</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.slotsGrid}>
        {visibleItems.map(({ startTime, index }) => {
          const endTime = addMinutesToTimeStatic(startTime, SLOT_DURATION);
          const slotKey = `${startTime}-${endTime}`;
          const isBooked = bookedSlots[selectedDate]?.includes(slotKey) ?? false;
          const isSelected = selectedSlots.includes(slotKey);
          let state = 'available';
          if (isBooked) state = 'booked';
          else if (isSelected) state = 'selected';

          return (
            <ScheduleTimeChip
              key={slotKey}
              startTime={startTime}
              endTime={endTime}
              state={state}
              delayIndex={index}
              onPress={() => onToggle(startTime)}
            />
          );
        })}
      </View>
    </View>
  );
}

function addMinutesToTimeStatic(time, minutes) {
  const [hours, mins] = time.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutes;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

function parseSlotKey(slotKey) {
  const dashIdx = slotKey.indexOf('-');
  if (dashIdx === -1) return null;
  return {
    startTime: slotKey.slice(0, dashIdx),
    endTime: slotKey.slice(dashIdx + 1),
  };
}

function toDbTime(time) {
  if (!time) return time;
  return time.length === 5 ? `${time}:00` : time;
}

const getDaysInMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = date => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

const formatDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isDateAllowed = dateStr => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);
  return date >= today && date <= maxDate;
};

const isTimeInPast = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return true;
  const now = new Date();
  const todayStr = formatDate(now);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const [hours, mins] = String(timeStr).substring(0, 5).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return true;
  const slotTime = new Date(now);
  slotTime.setHours(hours, mins, 0, 0);
  return slotTime.getTime() <= now.getTime();
};

const filterDueSlotKeys = (dateStr, slotKeys = []) =>
  (Array.isArray(slotKeys) ? slotKeys : []).filter(key => {
    const parsed = parseSlotKey(key);
    return parsed && !isTimeInPast(dateStr, parsed.startTime);
  });

const parseLocalDate = dateStr => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDisplayDate = dateStr =>
  parseLocalDate(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

function buildSlotEntriesFromMap(allSlotsMap) {
  const entries = [];
  for (const [date, slots] of Object.entries(allSlotsMap)) {
    if (!isDateAllowed(date)) continue;
    const uniqueSlots = [...new Set(slots)];
    for (const slotKey of uniqueSlots) {
      const parsed = parseSlotKey(slotKey);
      if (!parsed) continue;
      if (isTimeInPast(date, parsed.startTime)) continue;
      entries.push({
        date,
        startTime: toDbTime(parsed.startTime),
        endTime: toDbTime(parsed.endTime),
      });
    }
  }
  return entries;
}

export default function MentorAvailabilityScreen() {
  const styles = useThemedStyles(createAvailabilityStyles);
  const scheduleStyles = useScheduleStyles();
  const { theme } = useTheme();
  const accentPrimary = theme.colors.accent.primary;
  const accentSuccess = theme.colors.accent.success;
  const { profile, user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  // Profile fetch is async after session bootstrap — use auth user id as fallback
  // (same pattern as MentorDashboardScreen) so Schedule works while profile hydrates.
  const mentorId = profile?.id ?? user?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [allSlots, setAllSlots] = useState({});
  const [bookedSlots, setBookedSlots] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const selectedDateRef = useRef(formatDate(new Date()));
  const publishResetTimerRef = useRef(null);

  const mentorInitial = (profile?.name || user?.user_metadata?.full_name || 'M').charAt(0).toUpperCase();
  const mentorName = profile?.name || user?.user_metadata?.full_name || 'Mentor';

  selectedDateRef.current = selectedDate;

  const markUnsaved = () => {
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
  };

  const clearUnsaved = () => {
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
  };

  const triggerPublishSuccess = () => {
    setJustPublished(true);
    if (publishResetTimerRef.current) {
      clearTimeout(publishResetTimerRef.current);
    }
    publishResetTimerRef.current = setTimeout(() => {
      setJustPublished(false);
    }, 2400);
  };

  useEffect(
    () => () => {
      if (publishResetTimerRef.current) {
        clearTimeout(publishResetTimerRef.current);
      }
    },
    [],
  );

  const applyAvailabilityMaps = useCallback((unbookedMap, bookedMap) => {
    setAllSlots(unbookedMap);
    setBookedSlots(bookedMap);
    const dateKey = selectedDateRef.current;
    setSelectedSlots(filterDueSlotKeys(dateKey, unbookedMap[dateKey] || []));
  }, []);

  const loadAvailability = useCallback(async (force = false) => {
    if (!mentorId) {
      setLoading(false);
      setInitialLoading(false);
      return;
    }
    if (hasUnsavedChangesRef.current && !force) {
      return;
    }
    try {
      if (!hasLoadedRef.current) {
        setInitialLoading(true);
      }
      setLoading(true);
      const availability = await availabilityApi.getAvailabilityForMentor(mentorId);

      const unbookedMap = {};
      const bookedMap = {};

      availability.forEach(slot => {
        const date = slot.date;
        const startTime = slot.start_time.substring(0, 5);
        const endTime = slot.end_time.substring(0, 5);
        // Skip due slots entirely — they should not appear in schedule UI.
        if (isTimeInPast(date, startTime)) return;
        const slotKey = `${startTime}-${endTime}`;

        if (slot.is_booked) {
          if (!bookedMap[date]) bookedMap[date] = [];
          if (!bookedMap[date].includes(slotKey)) bookedMap[date].push(slotKey);
        } else {
          if (!unbookedMap[date]) unbookedMap[date] = [];
          if (!unbookedMap[date].includes(slotKey)) unbookedMap[date].push(slotKey);
        }
      });

      applyAvailabilityMaps(unbookedMap, bookedMap);
      hasLoadedRef.current = true;
    } catch (err) {
      Toast.show(err?.message || 'Failed to load availability');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [applyAvailabilityMaps, mentorId]);

  useFocusEffect(
    useCallback(() => {
      if (!mentorId) {
        // Session exists but profile row still missing — nudge a refresh.
        if (user?.id) {
          refreshProfile?.();
        }
        setLoading(false);
        setInitialLoading(false);
        return undefined;
      }
      loadAvailability(false);
      return undefined;
    }, [mentorId, user?.id, loadAvailability, refreshProfile]),
  );

  const handleSelectDate = date => {
    setSelectedDate(date);
    setSelectedSlots(filterDueSlotKeys(date, allSlots[date] || []));
  };

  const handleToggleSlot = slot => {
    const slotEnd = addMinutesToTimeStatic(slot, SLOT_DURATION);
    const slotKey = `${slot}-${slotEnd}`;

    if (bookedSlots[selectedDate]?.includes(slotKey)) return;
    if (isTimeInPast(selectedDate, slot)) return;

    layoutSpring();
    const updatedSlots = selectedSlots.includes(slotKey)
      ? selectedSlots.filter(s => s !== slotKey)
      : [...selectedSlots, slotKey];

    setSelectedSlots(updatedSlots);
    setAllSlots({ ...allSlots, [selectedDate]: updatedSlots });
    markUnsaved();
  };

  // Drop slots that become due while the mentor stays on this screen.
  useEffect(() => {
    if (!selectedDate) return undefined;
    const prune = () => {
      setSelectedSlots(prev => {
        const next = filterDueSlotKeys(selectedDate, prev);
        return next.length === prev.length ? prev : next;
      });
      setAllSlots(prev => {
        const day = prev[selectedDate];
        if (!day?.length) return prev;
        const nextDay = filterDueSlotKeys(selectedDate, day);
        if (nextDay.length === day.length) return prev;
        return { ...prev, [selectedDate]: nextDay };
      });
      setBookedSlots(prev => {
        const day = prev[selectedDate];
        if (!day?.length) return prev;
        const nextDay = filterDueSlotKeys(selectedDate, day);
        if (nextDay.length === day.length) return prev;
        return { ...prev, [selectedDate]: nextDay };
      });
    };
    const id = setInterval(prune, 30_000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const handleSaveAvailability = async () => {
    let saveMentorId = mentorId;
    if (!saveMentorId && user?.id) {
      saveMentorId = user.id;
      refreshProfile?.();
    }
    if (!saveMentorId) {
      Toast.show('Still signing in… try Publish again in a moment.');
      refreshProfile?.();
      return;
    }

    try {
      setSaving(true);
      const slotEntries = buildSlotEntriesFromMap(allSlots);
      await availabilityApi.syncMentorAvailability(saveMentorId, slotEntries);
      clearUnsaved();
      await loadAvailability(true);
      triggerPublishSuccess();
      Toast.show('Schedule saved successfully');
    } catch (err) {
      console.error('Save availability error:', err?.message || err);
      Toast.show(err?.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  const isPrevMonthDisabled =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const calendarWeeks = padCalendarWeeks(
    (() => {
      const weeks = [];
      for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
      }
      return weeks;
    })(),
  );

  const todayStr = formatDate(today);

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const openSlotCount = filterDueSlotKeys(selectedDate, selectedSlots).length;
  const bookedCount = filterDueSlotKeys(
    selectedDate,
    bookedSlots[selectedDate] || [],
  ).length;
  const totalOpenSlots = buildSlotEntriesFromMap(allSlots).length;

  let animStep = 0;
  const nextDelay = () => {
    const delay = animStep * ENTRANCE_STEP_MS;
    animStep += 1;
    return delay;
  };

  if (initialLoading && !hasLoadedRef.current) {
    return (
      <View style={styles.screenRoot}>
        <SafeScreen scrollable padding={T.spacing.md} hasBottomTabs={false} includeTopInset={false}>
          <ScheduleSkeleton />
        </SafeScreen>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <SafeScreen scrollable padding={T.spacing.md} hasBottomTabs={false} includeTopInset={false}>
        <FadeSlideIn delay={nextDelay()}>
          <View style={scheduleStyles.topBar}>
            <View style={scheduleStyles.topBarSide} />
            <View style={scheduleStyles.topBarCenter}>
              <Text style={scheduleStyles.topBarTitle}>Your schedule</Text>
              <Text style={scheduleStyles.topBarSub}>Set when learners can book you</Text>
            </View>
            <View style={scheduleStyles.topBarSide} />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={nextDelay()}>
          <ScheduleHeroBanner initial={mentorInitial} name={mentorName} label="Mentor schedule">
            <View style={scheduleStyles.metaRow}>
              <View style={scheduleStyles.metaItem}>
                <MaterialIcons name="date-range" size={12} color={accentSuccess} />
                <Text style={scheduleStyles.metaPillText}>Next 30 days</Text>
              </View>
              <Text style={scheduleStyles.metaSep}>·</Text>
              <View style={scheduleStyles.metaItem}>
                <MaterialIcons name="timelapse" size={12} color={accentPrimary} />
                <Text style={scheduleStyles.metaPillText}>30 min slots</Text>
              </View>
            </View>
          </ScheduleHeroBanner>
        </FadeSlideIn>

        <FadeSlideIn delay={nextDelay()}>
          <SchedulePreviewBar>
            <SchedulePreviewChip
              icon={<MaterialIcons name="event" size={13} color={accentPrimary} />}
              label={formatDisplayDate(selectedDate)}
            />
            <SchedulePreviewChip
              icon={<MaterialIcons name="schedule" size={13} color={accentSuccess} />}
              label={`${openSlotCount} open slot${openSlotCount !== 1 ? 's' : ''}`}
            />
            {bookedCount > 0 ? (
              <SchedulePreviewChip
                variant="warning"
                icon={<MaterialIcons name="lock" size={13} color={T.colors.accent.warning} />}
                label={`${bookedCount} booked`}
                textStyle={{ color: T.colors.accent.warning }}
              />
            ) : null}
          </SchedulePreviewBar>
        </FadeSlideIn>

        <FadeSlideIn delay={nextDelay()}>
          <ScheduleSectionBlock step="01" title="Pick a date" subtitle="Select a day within the next 30 days">
            <View style={scheduleStyles.calendarPanel}>
              <View style={scheduleStyles.monthHeader}>
                <PressScale
                  onPress={() => {
                    if (isPrevMonthDisabled) return;
                    layoutSpring();
                    const prev = new Date(currentDate);
                    prev.setMonth(prev.getMonth() - 1);
                    setCurrentDate(prev);
                  }}
                  disabled={isPrevMonthDisabled}
                  style={[
                    scheduleStyles.monthNavBtn,
                    isPrevMonthDisabled && scheduleStyles.monthNavBtnDisabled,
                  ]}
                  showGlow
                >
                  <MaterialIcons name="chevron-left" size={22} color={T.colors.text.primary} />
                </PressScale>
                <View style={scheduleStyles.monthTitleWrap}>
                  <Text style={scheduleStyles.monthYear}>{monthYear}</Text>
                  <Text style={scheduleStyles.monthSub}>Available booking window</Text>
                </View>
                <PressScale
                  onPress={() => {
                    layoutSpring();
                    const next = new Date(currentDate);
                    next.setMonth(next.getMonth() + 1);
                    setCurrentDate(next);
                  }}
                  style={scheduleStyles.monthNavBtn}
                  showGlow
                >
                  <MaterialIcons name="chevron-right" size={22} color={T.colors.text.primary} />
                </PressScale>
              </View>

              <View style={scheduleStyles.calendarGrid}>
                <View style={scheduleStyles.dayHeadersRow}>
                  {CALENDAR_DAY_LABELS.map(label => (
                    <Text key={label} style={scheduleStyles.dayHeader}>
                      {label}
                    </Text>
                  ))}
                </View>

                {calendarWeeks.map((week, wi) => (
                  <View key={wi} style={scheduleStyles.weekRow}>
                    {week.map((day, di) => {
                      if (!day) {
                        return <View key={`e-${wi}-${di}`} style={scheduleStyles.dayCellWrap} />;
                      }
                      const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                      const dateStr = formatDate(dayDate);
                      const openCount = filterDueSlotKeys(dateStr, allSlots[dateStr] || []).length;
                      const bookedCountForDay = filterDueSlotKeys(
                        dateStr,
                        bookedSlots[dateStr] || [],
                      ).length;
                      const totalSlots = openCount + bookedCountForDay;
                      const allowed = isDateAllowed(dateStr);
                      const slotTone =
                        openCount > 0 ? 'open' : bookedCountForDay > 0 ? 'booked' : 'open';

                      return (
                        <ScheduleDayCell
                          key={`d-${day}`}
                          day={day}
                          isSelected={selectedDate === dateStr}
                          isToday={dateStr === todayStr}
                          enabled={allowed}
                          muteLabel={!allowed}
                          hasSlots={totalSlots > 0}
                          slotCount={totalSlots}
                          slotTone={slotTone}
                          onPress={() => allowed && handleSelectDate(dateStr)}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>

              <ScheduleCalendarLegend />
            </View>
          </ScheduleSectionBlock>
        </FadeSlideIn>

        <FadeSlideIn delay={nextDelay()}>
          <ScheduleSectionBlock
            step="02"
            title="Choose time slots"
            subtitle="Tap to toggle · 30 min sessions"
            accent="teal"
          >
            <View style={styles.slotsPanel}>
              <View style={styles.slotsPanelHeader}>
                <View style={styles.slotsPanelHeaderText}>
                  <Text style={styles.slotsPanelDate}>{formatDisplayDate(selectedDate)}</Text>
                  <Text style={styles.slotsPanelMeta}>
                    {openSlotCount} open
                    {bookedCount > 0 ? ` · ${bookedCount} booked` : ''}
                  </Text>
                </View>
                {openSlotCount > 0 ? (
                  <View style={styles.slotsPanelBadge}>
                    <Text style={styles.slotsPanelBadgeText}>{openSlotCount}</Text>
                  </View>
                ) : null}
              </View>

              <SlotsLegend />

              {SLOT_PERIODS.map(period => (
                <SlotPeriodSection
                  key={period.id}
                  period={period}
                  items={GROUPED_TIME_SLOTS[period.id]}
                  selectedDate={selectedDate}
                  selectedSlots={selectedSlots}
                  bookedSlots={bookedSlots}
                  onToggle={handleToggleSlot}
                />
              ))}

              {openSlotCount > 0 ? (
                <FadeSlideIn delay={80}>
                  <View style={styles.summaryChip}>
                    <MaterialIcons name="check-circle" size={16} color={B.successText} />
                    <Text style={styles.summaryChipText}>
                      {openSlotCount} slot{openSlotCount !== 1 ? 's' : ''} open on this date
                    </Text>
                  </View>
                </FadeSlideIn>
              ) : (
                <FadeSlideIn delay={80}>
                  <View style={styles.hintRow}>
                    <MaterialIcons name="tips-and-updates" size={14} color={accentPrimary} />
                    <Text style={styles.hintText}>Select slots when you are available for sessions</Text>
                  </View>
                </FadeSlideIn>
              )}
            </View>
          </ScheduleSectionBlock>
        </FadeSlideIn>

        <View style={{ height: 100 + insets.bottom }} />
      </SafeScreen>

      {/* Direct sticky bar (no nested absolute / FadeSlideIn) so iOS receives Publish taps. */}
      <View
        style={[
          scheduleStyles.stickyBar,
          {
            paddingBottom: Math.max(insets.bottom, T.spacing.md),
            zIndex: 30,
            elevation: 30,
          },
        ]}
      >
        <View style={styles.saveSummary}>
          <Text style={styles.saveSummaryLabel}>
            {hasUnsavedChanges ? 'Unsaved changes to publish' : 'Open slots across schedule'}
          </Text>
          <Text style={[styles.saveSummaryCount, hasUnsavedChanges ? styles.saveSummaryCountDirty : null]}>
            {totalOpenSlots}
          </Text>
        </View>
        <PublishScheduleButton
          saving={saving}
          loading={loading}
          hasUnsavedChanges={hasUnsavedChanges}
          justPublished={justPublished}
          onPress={handleSaveAvailability}
        />
      </View>
    </View>
  );
}

function createAvailabilityStyles(theme) {
  const T = theme;
  const B = T.colors.buttons;
  const S = T.colors.surface;
  const C = T.colors;
  const SUCCESS = C.accent.success;
  return StyleSheet.create({
  screenRoot: { flex: 1 },
  pressHit: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.borderRadius.md,
    borderWidth: 1.5,
    borderColor: C.accent.primary,
  },
  slotsPanel: {
    backgroundColor: S.panel,
    borderRadius: 16,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: C.border.light,
    gap: T.spacing.md,
  },
  slotsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: T.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border.light,
  },
  slotsPanelHeaderText: { flex: 1, paddingRight: T.spacing.sm },
  slotsPanelDate: {
    fontSize: 15,
    fontWeight: '800',
    color: T.colors.text.primary,
    letterSpacing: 0.2,
  },
  slotsPanelMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: T.colors.text.muted,
    marginTop: 2,
  },
  slotsPanelBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  slotsPanelBadgeText: { fontSize: 15, fontWeight: '800', color: B.successText },
  slotsLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.spacing.sm,
    rowGap: 6,
  },
  slotsLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  slotsLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
  slotsLegendAvailable: {
    backgroundColor: S.chip,
    borderColor: C.border.default,
  },
  slotsLegendSelected: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  slotsLegendBooked: {
    backgroundColor: S.accentWarning,
    borderColor: B.warningBorder,
  },
  slotsLegendPast: {
    backgroundColor: S.sheet,
    borderColor: C.border.light,
  },
  slotsLegendText: { fontSize: 11, fontWeight: '600', color: T.colors.text.muted },
  slotPeriodBlock: { gap: T.spacing.sm },
  slotPeriodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  slotPeriodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotPeriodIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPeriodTitle: { fontSize: 13, fontWeight: '800', color: T.colors.text.primary },
  slotPeriodHint: { fontSize: 11, fontWeight: '600', color: T.colors.text.muted, marginTop: 1 },
  slotPeriodBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
  },
  slotPeriodBadgeText: { fontSize: 11, fontWeight: '700', color: SUCCESS },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.spacing.sm,
  },
  slotCellWrap: {
    width: '31.5%',
  },
  timeSlotPress: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: T.borderRadius.md,
  },
  timeSlotGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.borderRadius.md,
    borderWidth: 1.5,
    borderColor: B.successBorder,
  },
  timeSlotCell: {
    minHeight: 62,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timeSlotAvailable: {
    backgroundColor: S.chip,
    borderColor: C.border.default,
  },
  timeSlotSelected: {
    borderColor: B.successBorder,
    borderWidth: 1.5,
  },
  timeSlotBooked: {
    backgroundColor: S.accentWarning,
    borderColor: B.warningBorder,
  },
  timeSlotPast: {
    backgroundColor: S.sheet,
    borderColor: C.border.light,
    opacity: 0.5,
  },
  timeSlotStatusIcon: { position: 'absolute', top: 6, right: 6 },
  timeSlotStart: { fontSize: 13, fontWeight: '800', color: T.colors.text.primary },
  timeSlotEnd: { fontSize: 10, fontWeight: '600', color: T.colors.text.muted, marginTop: 2 },
  timeSlotText: { fontSize: 13, fontWeight: '800', color: T.colors.text.secondary },
  timeSlotTextSelected: { color: B.successText },
  timeSlotTextBooked: { color: T.colors.accent.warning },
  timeSlotTextPast: { color: T.colors.text.muted },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: T.spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: T.spacing.md,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
  },
  summaryChipText: { fontSize: 13, fontWeight: '700', color: B.successText },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.xs,
  },
  hintText: { fontSize: 12, color: T.colors.text.muted, flex: 1 },
  saveSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.sm,
  },
  saveSummaryLabel: { fontSize: 12, fontWeight: '600', color: T.colors.text.muted },
  saveSummaryCount: { fontSize: 18, fontWeight: '800', color: C.accent.primary },
  saveSummaryCountDirty: { color: SUCCESS },
  publishBtnOuter: {
    position: 'relative',
    alignItems: 'stretch',
  },
  publishBtnWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  publishSuccessGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: B.premiumBorder,
    backgroundColor: S.accentViolet,
  },
  publishSuccessRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: B.premiumGradient[0],
  },
  saveBtn: { marginVertical: 0, minHeight: 50 },
  });
}
