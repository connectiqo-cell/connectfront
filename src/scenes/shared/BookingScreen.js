import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Easing,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-simple-toast';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT, PLATFORM_LAYOUT } from '../../utils/platformLayout';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import CelebrationPayButton, { CelebrationScreenFx } from '../../components/CelebrationPayButton';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import {
  useScheduleStyles,
  ScheduleSectionBlock,
  ScheduleDayCell,
  ScheduleHeroBanner,
  ScheduleCalendarLegend,
  CALENDAR_DAY_LABELS,
  padCalendarWeeks,
} from '../../components/schedule/ScheduleUI';
import { availabilityApi } from '../../api/availabilityApi';
import { useAvailabilityRealtime } from '../../hooks/useAvailabilityRealtime';
import { mentorApi } from '../../api/mentorApi';
import { paymentApi } from '../../api/paymentApi';
import { scheduleSessionReminder, requestNotificationPermission } from '../../utils/sessionReminder';
import { calculateFees } from '../../utils/feeCalculator';
import { areSlotsContiguous } from '../../utils/contiguousSlots';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = T.colors.buttons;
const S = T.colors.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = C.surface.panel;
const INPUT_BG = C.surface.sheet;
const GLASS_BORDER = 'rgba(167,139,250,0.22)';

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

/** iOS: avoid translateY + scale together — same RN crash as LayoutAnimation + transform. */
const iosEntranceTransform = (translateY, scale) =>
  Platform.OS === 'ios' ? [{ translateY }] : [{ translateY }, { scale }];

const ENTRANCE_STEP_MS = 45;
const BOOKING_WINDOW_DAYS = 30;

const SLOT_PERIODS = [
  { id: 'morning', label: 'Morning', hint: 'Before noon', icon: 'wb-sunny', startHour: 0, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', hint: '12:00 – 17:00', icon: 'brightness-5', startHour: 12, endHour: 17 },
  { id: 'evening', label: 'Evening', hint: 'After 17:00', icon: 'nightlight-round', startHour: 17, endHour: 24 },
];

// ─── Date helpers ──────────────────────────────────────────────────────────
const getDaysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

const formatDate = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseLocalDate = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDisplayDate = s =>
  parseLocalDate(s).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });


const isDateAllowed = dateStr => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseLocalDate(dateStr);
  date.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + BOOKING_WINDOW_DAYS);
  return date >= today && date <= maxDate;
};

/** True when the slot start time has already passed (due / expired). */
const isSlotDue = (dateStr, startTime) => {
  if (!dateStr || !startTime) return true;
  const now = new Date();
  const todayStr = formatDate(now);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const [hours, mins] = String(startTime).substring(0, 5).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return true;
  const slotStart = new Date(now);
  slotStart.setHours(hours, mins, 0, 0);
  return slotStart.getTime() <= now.getTime();
};

const isSlotBooked = slot => {
  const flag = slot?.is_booked;
  return flag === true || flag === 1 || flag === 'true' || flag === 't';
};

/** Learner-selectable: not booked and not past/due. */
const isSlotAvailable = (slot, dateStr = slot?.date) =>
  Boolean(slot) && !isSlotBooked(slot) && !isSlotDue(dateStr, slot.start_time);

/** Shown on the booking grid: upcoming available + upcoming booked. */
const isSlotVisibleOnBooking = (slot, dateStr = slot?.date) =>
  Boolean(slot) && !isSlotDue(dateStr, slot.start_time);

const filterVisibleBookingSlots = (slots, dateStr) =>
  (Array.isArray(slots) ? slots : [])
    .filter(s => isSlotVisibleOnBooking(s, dateStr))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

/** @deprecated use isSlotDue — kept as alias for existing call sites during cleanup */
const isTimeInPast = (dateStr, timeStr) => isSlotDue(dateStr, timeStr);

const filterAvailableSlots = (slots, dateStr) =>
  (Array.isArray(slots) ? slots : [])
    .filter(s => isSlotAvailable(s, dateStr))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

const formatSlotTime = time24 => {
  const [h, m] = time24.substring(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatSlotRange = (start24, end24) => {
  const [sh, sm] = start24.substring(0, 5).split(':').map(Number);
  const [eh, em] = end24.substring(0, 5).split(':').map(Number);
  const startPeriod = sh >= 12 ? 'PM' : 'AM';
  const endPeriod = eh >= 12 ? 'PM' : 'AM';
  const start12 = `${sh % 12 || 12}:${String(sm).padStart(2, '0')}`;
  const end12 = `${eh % 12 || 12}:${String(em).padStart(2, '0')}`;
  if (startPeriod === endPeriod) {
    return `${start12} – ${end12} ${endPeriod}`;
  }
  return `${start12} ${startPeriod} – ${end12} ${endPeriod}`;
};

const getSlotPeriodId = startTime => {
  const hour = parseInt(startTime.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

const groupSlotsByPeriod = slots => {
  const grouped = { morning: [], afternoon: [], evening: [] };
  slots.forEach((slot, index) => {
    grouped[getSlotPeriodId(slot.start_time)].push({ slot, index });
  });
  return grouped;
};

const slotDurationMinutes = (start, end) => {
  const [sh, sm] = start.substring(0, 5).split(':').map(Number);
  const [eh, em] = end.substring(0, 5).split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

function FadeSlideIn({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(14);
    if (Platform.OS === 'ios') {
      scale.setValue(1);
    } else {
      scale.setValue(0.97);
    }

    const anims = [
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
    ];
    if (Platform.OS !== 'ios') {
      anims.push(
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          delay,
          useNativeDriver: true,
        }),
      );
    }

    const anim = Animated.parallel(anims);
    anim.start(({ finished }) => {
      if (!finished) {
        opacity.setValue(1);
        translateY.setValue(0);
        scale.setValue(1);
      }
    });

    const safety = setTimeout(() => {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
    }, delay + 700);

    return () => {
      clearTimeout(safety);
      anim.stop();
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
    };
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: iosEntranceTransform(translateY, scale) }]}>
      {children}
    </Animated.View>
  );
}

function FadeInSection({ show, children, delay = 0, style }) {
  // Critical booking steps must never stay at opacity 0 — skip fade when revealing.
  if (!show) return null;
  return <View style={style}>{children}</View>;
}

const GOAL_PROMPTS = [
  'Career guidance',
  'Interview prep',
  'Skill improvement',
  'Project feedback',
  'Resume review',
];

function PressScale({ onPress, children, style, disabled, scaleTo = 0.94, showGlow = false }) {
  const styles = useThemedStyles(createBookingStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: scaleTo, friction: 6, tension: 160, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, showGlow ? 0.45 : 0],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[styles.pressHit, style]}
      >
        {showGlow ? (
          <Animated.View pointerEvents="none" style={[styles.pressGlow, { opacity: glowOpacity }]} />
        ) : null}
        {children}
      </Pressable>
    </Animated.View>
  );
}

function SkeletonBone({ style }) {
  const sk = useThemedStyles(createSkeletonStyles);
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

function BookingSkeleton() {
  const sk = useThemedStyles(createSkeletonStyles);
  return (
    <View style={sk.wrap}>
      <SkeletonBone style={sk.hero} />
      <SkeletonBone style={sk.progress} />
      <SkeletonBone style={sk.sectionTitle} />
      <SkeletonBone style={sk.calendar} />
      <SkeletonBone style={sk.sectionTitle} />
      <SkeletonBone style={sk.slots} />
    </View>
  );
}

function createSkeletonStyles(theme) {
  const T = theme;
  return StyleSheet.create({
    bone: {
      backgroundColor: softFillStrong(theme),
      borderRadius: T.borderRadius.md,
    },
    wrap: { gap: T.spacing.md },
    hero: { height: 88, borderRadius: 16 },
    progress: { height: 52, borderRadius: 14 },
    sectionTitle: { height: 36, width: '55%', borderRadius: 8 },
    calendar: { height: 280, borderRadius: 16 },
    slots: { height: 200, borderRadius: 16 },
  });
}

function BookingProgressSteps({
  selectedDate,
  selectedTimes,
  message,
  recordingRequested,
  readyToPay,
}) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const GOLD = C.accent.primary;
  const steps = [
    { id: 1, label: 'Date', icon: 'event', done: !!selectedDate },
    { id: 2, label: 'Time', icon: 'schedule', done: selectedTimes.length > 0 },
    {
      id: 3,
      label: 'Record',
      icon: 'videocam',
      done: typeof recordingRequested === 'boolean',
    },
    { id: 4, label: 'Goal', icon: 'flag', done: message.trim().length > 0 },
    { id: 5, label: 'Pay', icon: 'lock', done: readyToPay },
  ];
  const activeIndex = steps.findIndex(s => !s.done);
  const current = activeIndex === -1 ? steps.length - 1 : activeIndex;

  return (
    <View style={styles.progressWrap}>
      {steps.map((step, idx) => {
        const isDone = step.done;
        const isActive = idx === current && !readyToPay;
        const isLast = idx === steps.length - 1;
        return (
          <View key={step.id} style={styles.progressStepCol}>
            <View style={styles.progressStepRow}>
              <View
                style={[
                  styles.progressDot,
                  isDone && styles.progressDotDone,
                  isActive && styles.progressDotActive,
                ]}
              >
                {isDone ? (
                  <MaterialIcons name="check" size={12} color={B.successText} />
                ) : (
                  <MaterialIcons
                    name={step.icon}
                    size={12}
                    color={isActive ? GOLD : C.text.muted}
                  />
                )}
              </View>
              {!isLast ? (
                <View style={[styles.progressLine, isDone && styles.progressLineDone]} />
              ) : null}
            </View>
            <Text
              style={[
                styles.progressLabel,
                isDone && styles.progressLabelDone,
                isActive && styles.progressLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** CTA copy framed around booking & ownership — avoids “pay” loss-aversion. */
function getBookingCtaLabel({
  paying,
  readyToPay,
  fees,
  selectedTimes,
  message,
  recordingRequested,
}) {
  const count = selectedTimes?.length || 0;
  if (paying) return 'Securing your session…';
  if (!count) return 'Choose your slot';
  if (typeof recordingRequested !== 'boolean') return 'Choose recording preference';
  if (!message.trim()) return 'Add your session goal';
  if (!fees) return 'Loading pricing…';
  if (readyToPay) {
    return count > 1
      ? `Secure Continuous Session · ₹${fees.totalAmount}`
      : `Secure My Spot · ₹${fees.totalAmount}`;
  }
  return count > 1
    ? `Book Continuous Session · ₹${fees.totalAmount}`
    : `Book My Session · ₹${fees.totalAmount}`;
}

function GoalPromptChips({ onSelect, selected }) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const B = theme.colors.buttons;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.promptRow}
    >
      {GOAL_PROMPTS.map(label => {
        const isSelected = selected === label;
        return (
          <TouchableOpacity
            key={label}
            style={[styles.promptChip, isSelected && styles.promptChipSelected]}
            onPress={() => onSelect(label)}
            activeOpacity={0.8}
          >
            {isSelected ? (
              <MaterialIcons name="check" size={12} color={B.successText} style={{ marginRight: 4 }} />
            ) : null}
            <Text style={[styles.promptChipText, isSelected && styles.promptChipTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function FeeRow({ label, amount, accent, bold }) {
  const feeStyles = useThemedStyles(createFeeStyles);
  return (
    <View style={feeStyles.row}>
      <Text style={[feeStyles.label, bold && feeStyles.bold]}>{label}</Text>
      <Text style={[feeStyles.amount, bold && feeStyles.bold, accent && feeStyles.accent]}>
        ₹{amount}
      </Text>
    </View>
  );
}

function BookingTimeChip({ slot, selected, booked, onPress, delayIndex = 0 }) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const B = theme.colors.buttons;
  const C = theme.colors;
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const isInteractive = !booked;

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
      toValue: selected ? 1.02 : 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [scale, selected]);

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
        toValue: selected ? 1.02 : 1,
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

  const durationMin = slotDurationMinutes(slot.start_time, slot.end_time);
  const cellStyle = booked
    ? styles.timeSlotBooked
    : selected
      ? styles.timeSlotSelected
      : styles.timeSlotAvailable;
  const textStyle = booked
    ? styles.timeSlotTextBooked
    : selected
      ? styles.timeSlotTextSelected
      : null;

  const cellBody = (
    <View style={[styles.timeSlotCell, cellStyle]}>
      {selected && !booked ? (
        <LinearGradient
          colors={B.successGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {booked ? (
        <MaterialIcons
          name="lock"
          size={14}
          color={C.accent.warning}
          style={styles.timeSlotStatusIcon}
        />
      ) : selected ? (
        <MaterialIcons
          name="check-circle"
          size={14}
          color={B.successText}
          style={styles.timeSlotStatusIcon}
        />
      ) : null}
      <Text style={[styles.timeSlotStart, textStyle]} numberOfLines={1}>
        {formatSlotTime(slot.start_time)}
      </Text>
      <Text style={[styles.timeSlotEnd, textStyle]} numberOfLines={1}>
        – {formatSlotTime(slot.end_time)}
      </Text>
      <View
        style={[
          styles.timeSlotDurationPill,
          selected && !booked && styles.timeSlotDurationPillSelected,
          booked && styles.timeSlotDurationPillBooked,
        ]}
      >
        <Text
          style={[
            styles.timeSlotDurationText,
            selected && !booked && styles.timeSlotDurationTextSelected,
            booked && styles.timeSlotTextBooked,
          ]}
          numberOfLines={1}
        >
          {booked ? 'Booked' : `${durationMin}m`}
        </Text>
      </View>
    </View>
  );

  const chipTransform =
    Platform.OS === 'ios'
      ? [{ translateY: chipY }]
      : [{ translateY: chipY }, { scale }];

  if (!isInteractive) {
    return (
      <Animated.View
        style={[
          styles.slotCellWrap,
          { opacity: chipOpacity, transform: chipTransform },
        ]}
      >
        {cellBody}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.slotCellWrap,
        { opacity: chipOpacity, transform: chipTransform },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.timeSlotPress}
      >
        <Animated.View pointerEvents="none" style={[styles.timeSlotGlow, { opacity: glowOpacity }]} />
        {cellBody}
      </Pressable>
    </Animated.View>
  );
}

function BookingSlotPeriodSection({ period, items, selectedTimes, onSelect }) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const slotAccent = theme.colors.accent.success;
  if (!items.length) return null;

  const selectedInPeriod = items.filter(({ slot }) =>
    selectedTimes.some(
      s =>
        (s.id && slot.id && s.id === slot.id) ||
        (s.start_time === slot.start_time && s.end_time === slot.end_time),
    ),
  ).length;

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
        <View style={styles.slotPeriodBadge}>
          <Text style={styles.slotPeriodBadgeText}>
            {selectedInPeriod > 0 ? `${selectedInPeriod} selected` : `${items.length} open`}
          </Text>
        </View>
      </View>
      <View style={styles.slotsGrid}>
        {items.map(({ slot, index }) => {
          const selected = selectedTimes.some(
            s =>
              (s.id && slot.id && s.id === slot.id) ||
              (s.start_time === slot.start_time && s.end_time === slot.end_time),
          );
          return (
            <BookingTimeChip
              key={slot.id || `${slot.start_time}-${slot.end_time}`}
              slot={slot}
              selected={selected}
              booked={isSlotBooked(slot)}
              delayIndex={index}
              onPress={() => onSelect(slot)}
            />
          );
        })}
      </View>
    </View>
  );
}

function BookingSlotsPanel({ selectedDate, slots, selectedTimes, onSelect }) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const B = theme.colors.buttons;
  const grouped = groupSlotsByPeriod(slots);
  const selectedCount = selectedTimes.length;
  const totalMins = selectedTimes.reduce(
    (sum, slot) => sum + slotDurationMinutes(slot.start_time, slot.end_time),
    0,
  );
  const spanStart = selectedCount ? selectedTimes[0].start_time : null;
  const spanEnd = selectedCount ? selectedTimes[selectedCount - 1].end_time : null;

  return (
    <View style={styles.slotsPanel}>
      <View style={styles.slotsPanelHeader}>
        <View style={styles.slotsPanelHeaderText}>
          <Text style={styles.slotsPanelDate}>{formatDisplayDate(selectedDate)}</Text>
          <Text style={styles.slotsPanelMeta}>
            {slots.filter(s => !isSlotBooked(s)).length} available
            {slots.some(s => isSlotBooked(s))
              ? ` · ${slots.filter(s => isSlotBooked(s)).length} booked`
              : ''}
            {' · choose continuous times'}
          </Text>
        </View>
        <View style={styles.slotsPanelBadge}>
          <Text style={styles.slotsPanelBadgeText}>
            {selectedCount > 0 ? selectedCount : slots.length}
          </Text>
        </View>
      </View>

      {selectedCount > 0 ? (
        <View style={styles.selectedSessionCard}>
          <View style={styles.selectedSessionIconWrap}>
            <MaterialIcons name="event-available" size={18} color={B.successText} />
          </View>
          <View style={styles.selectedSessionBody}>
            <Text style={styles.selectedSessionLabel}>
              {selectedCount > 1 ? 'Continuous session' : 'Selected session'}
            </Text>
            <Text style={styles.selectedSessionRange}>
              {formatSlotRange(spanStart, spanEnd)}
            </Text>
            <Text style={styles.selectedSessionMeta}>
              {totalMins} min
              {selectedCount > 1 ? ` · ${selectedCount} back-to-back slots` : ''}
            </Text>
          </View>
        </View>
      ) : null}

      {SLOT_PERIODS.map(period => (
        <BookingSlotPeriodSection
          key={period.id}
          period={period}
          items={grouped[period.id]}
          selectedTimes={selectedTimes}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

function createFeeStyles(theme) {
  const C = theme.colors;
  const GOLD = C.accent.primary;
  return StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    label: { fontSize: 13, color: C.text.secondary },
    amount: { fontSize: 13, color: C.text.secondary },
    bold: { fontWeight: '800', color: C.text.primary, fontSize: 15 },
    accent: { color: GOLD, fontSize: 17, fontWeight: '800' },
  });
}

export default function BookingScreen({ navigation, route }) {
  const styles = useThemedStyles(createBookingStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const PURPLE_LINK = C.buttons.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const scheduleStyles = useScheduleStyles();
  const mentorId = route.params?.mentorId;
  const mentorName = route.params?.mentorName ?? 'Mentor';
  const { profile, user, refreshProfile } = useAuth();
  const learnerId = profile?.id ?? user?.id ?? null;
  const insets = useSafeAreaInsets();
  const navBarInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const stickyBottomPad = navBarInset + T.spacing.md;

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [mentorAvailability, setMentorAvailability] = useState({});
  const [timeSlotsForDate, setTimeSlotsForDate] = useState([]);
  const [message, setMessage] = useState('');
  const [recordingRequested, setRecordingRequested] = useState(null);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [mentorData, setMentorData] = useState(null);
  const [feeConfig, setFeeConfig] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fxOrigin, setFxOrigin] = useState(null);
  const scrollRef = useRef(null);
  const recordingSectionY = useRef(0);
  const scrolledToRecordingFor = useRef(null);

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  const checkoutSlide = useRef(new Animated.Value(80)).current;
  const checkoutOpacity = useRef(new Animated.Value(0.6)).current;
  const totalPop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
    ]).start();
  }, [headerFade, headerSlide]);

  useEffect(() => {
    if (!mentorId) {
      Toast.show('Could not open booking. Please try again.');
      navigation.goBack();
      return undefined;
    }

    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        const [availability, mentorProfile] = await Promise.all([
          availabilityApi.getAvailabilityForMentor(mentorId),
          mentorApi.getMentorWithProfile(mentorId),
        ]);

        if (!active) return;
        setMentorData(mentorProfile);
        setPricePerHour(mentorProfile?.price_per_hour || 0);

        // Fee rules don't need the learner profile — always load so Pay CTA works on iOS
        // while auth profile is still hydrating.
        const rule = await paymentApi.getFeeRule();
        if (!active) return;
        setFeeConfig(
          rule
            ? {
                platformFeePercent: Number(rule.platform_fee_percent),
                gstPercent: Number(rule.gst_percent),
              }
            : null,
        );

        if (!availability?.length) {
          setMentorAvailability({});
          return;
        }

        const byDate = {};
        availability.forEach(slot => {
          if (!isSlotVisibleOnBooking(slot, slot.date)) return;
          if (!byDate[slot.date]) byDate[slot.date] = [];
          byDate[slot.date].push({
            id: slot.id,
            date: slot.date,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_booked: isSlotBooked(slot),
          });
        });
        setMentorAvailability(byDate);
      } catch (err) {
        if (!active) return;
        Toast.show('Failed to load mentor data: ' + err.message);
        setMentorAvailability({});
      } finally {
        if (active) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    };

    run();
    return () => { active = false; };
  }, [mentorId, navigation]);

  const reloadSlots = useCallback(async () => {
    if (!mentorId) return;
    try {
      const availability = await availabilityApi.getAvailabilityForMentor(mentorId);
      const byDate = {};
      (availability || []).forEach(slot => {
        if (!isSlotVisibleOnBooking(slot, slot.date)) return;
        if (!byDate[slot.date]) byDate[slot.date] = [];
        byDate[slot.date].push({
          id: slot.id,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_booked: isSlotBooked(slot),
        });
      });
      setMentorAvailability(byDate);
    } catch {
      /* keep last known slots */
    }
  }, [mentorId]);

  useAvailabilityRealtime(mentorId, reloadSlots);

  useEffect(() => {
    layoutSpring();
    const slots = mentorAvailability[selectedDate] || [];
    setTimeSlotsForDate(filterVisibleBookingSlots(slots, selectedDate));
  }, [selectedDate, mentorAvailability]);

  const selectionDateRef = useRef(selectedDate);
  useEffect(() => {
    const dateChanged = selectionDateRef.current !== selectedDate;
    selectionDateRef.current = selectedDate;
    setSelectedTimes(prev => {
      if (dateChanged) return [];
      if (!prev.length) return prev;
      const open = filterAvailableSlots(mentorAvailability[selectedDate] || [], selectedDate);
      const still = prev.filter(s =>
        open.some(
          o =>
            (o.id && s.id && o.id === s.id) ||
            (o.start_time === s.start_time && o.end_time === s.end_time),
        ),
      );
      if (still.length !== prev.length) {
        Toast.show('A selected slot is no longer available and was removed');
      }
      return still.length === prev.length ? prev : still;
    });
  }, [mentorAvailability, selectedDate]);

  // Hide slots that become due while the user stays on this screen.
  useEffect(() => {
    if (!selectedDate) return undefined;
    const prune = () => {
      setTimeSlotsForDate(prev => {
        const next = filterVisibleBookingSlots(prev, selectedDate);
        return next.length === prev.length ? prev : next;
      });
      setSelectedTimes(prev => {
        if (!prev.length) return prev;
        const next = prev.filter(s => isSlotAvailable(s, selectedDate));
        if (next.length < prev.length) {
          Toast.show('A selected slot is no longer available and was removed');
        }
        return next;
      });
    };
    const id = setInterval(prune, 30_000);
    return () => clearInterval(id);
  }, [selectedDate]);

  const handleSelectDate = dateStr => {
    if (!isDateAllowed(dateStr)) {
      Toast.show('Bookings are only available within the next 30 days');
      return;
    }
    const visible = filterVisibleBookingSlots(mentorAvailability[dateStr] || [], dateStr);
    if (!visible.length) {
      Toast.show('No slots on this date');
      return;
    }
    layoutSpring();
    setSelectedDate(dateStr);
  };

  const handleSelectTime = slot => {
    if (!isSlotAvailable(slot, selectedDate)) {
      Toast.show('That slot is no longer available');
      return;
    }
    layoutSpring();
    setSelectedTimes(prev => {
      const sameSlot = s =>
        (s.id && slot.id && s.id === slot.id) ||
        (s.start_time === slot.start_time && s.end_time === slot.end_time);
      const exists = prev.some(sameSlot);
      if (exists) {
        const next = prev.filter(s => !sameSlot(s));
        if (!areSlotsContiguous(next)) {
          Toast.show('Remove slots from either end of your continuous block');
          return prev;
        }
        return next;
      }
      const next = [...prev, slot].sort((a, b) => a.start_time.localeCompare(b.start_time));
      if (!areSlotsContiguous(next)) {
        Toast.show('Select continuous back-to-back slots only');
        return prev;
      }
      return next;
    });
    setRecordingRequested(null);
    scrolledToRecordingFor.current = null;
  };

  const selectedSlotKey = selectedTimes.map(s => s.id || s.start_time).join('|');

  useEffect(() => {
    if (!selectedTimes.length) return undefined;
    const firstId = selectedTimes[0]?.id || selectedTimes[0]?.start_time;
    const timer = setTimeout(() => {
      if (scrolledToRecordingFor.current === firstId) return;
      const y = Math.max(0, recordingSectionY.current - 16);
      if (y > 0) {
        scrolledToRecordingFor.current = firstId;
        scrollRef.current?.scrollTo?.({ y, animated: true });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [selectedSlotKey]);

  const slotCount = selectedTimes.length;
  const feesOne = pricePerHour > 0 ? calculateFees(pricePerHour, feeConfig || undefined) : null;
  const fees = feesOne && slotCount > 0
    ? {
        ...feesOne,
        mentorAmount: feesOne.mentorAmount * slotCount,
        platformBaseFee: feesOne.platformBaseFee * slotCount,
        gstOnFee: feesOne.gstOnFee * slotCount,
        convenienceFee: feesOne.convenienceFee * slotCount,
        totalAmount: feesOne.totalAmount * slotCount,
        totalAmountPaise: feesOne.totalAmountPaise * slotCount,
        mentorAmountPaise: feesOne.mentorAmountPaise * slotCount,
        platformFeePaise: feesOne.platformFeePaise * slotCount,
      }
    : feesOne;

  const readyToPay = Boolean(
    slotCount > 0 &&
      message.trim().length > 0 &&
      typeof recordingRequested === 'boolean' &&
      fees &&
      !paying,
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkoutSlide, {
        toValue: 0,
        friction: 9,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.timing(checkoutOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [checkoutSlide, checkoutOpacity]);

  useEffect(() => {
    if (readyToPay && fees) {
      Animated.spring(totalPop, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();
    } else {
      totalPop.setValue(0);
    }
  }, [readyToPay, fees, totalPop]);

  const mentorInitial = (mentorName || 'M').charAt(0).toUpperCase();

  const handlePay = async () => {
    if (!selectedDate || !selectedTimes.length) {
      Toast.show('Please select a date and at least one time slot');
      return;
    }
    // Final client-side prune for booked / due slots
    const stillValid = selectedTimes.filter(s => isSlotAvailable(s, selectedDate));
    if (stillValid.length !== selectedTimes.length) {
      setSelectedTimes(stillValid);
      Toast.show('A selected slot is no longer available and was removed');
      return;
    }
    if (!areSlotsContiguous(stillValid)) {
      Toast.show('Selected slots must be continuous back-to-back times');
      return;
    }
    if (!stillValid.length) {
      Toast.show('Please select a time slot');
      return;
    }
    if (!message.trim()) {
      Toast.show('Please share what you want to achieve');
      return;
    }
    if (typeof recordingRequested !== 'boolean') {
      Toast.show('Please choose whether you want the session recorded');
      return;
    }
    if (!fees) {
      Toast.show('Unable to load pricing. Please go back and try again.');
      return;
    }

    const payLearnerId = learnerId ?? user?.id ?? null;
    if (!payLearnerId) {
      Toast.show('Still signing in… try again in a moment.');
      refreshProfile?.();
      return;
    }

    const slotIds = stillValid.map(s => s.id).filter(Boolean);
    if (slotIds.length !== stillValid.length) {
      Toast.show('Some slots are invalid. Please reselect and try again.');
      return;
    }

    try {
      setPaying(true);

      const order = await paymentApi.createOrder({
        mentorId,
        learnerId: payLearnerId,
        slotIds,
        message: message.trim(),
        recordingRequested,
      });

      const spanMins = stillValid.reduce(
        (sum, s) => sum + slotDurationMinutes(s.start_time, s.end_time),
        0,
      );
      const sessionLabel =
        slotIds.length > 1
          ? `Continuous session (${spanMins} min) with ${mentorName}`
          : `1-on-1 session with ${mentorName}`;

      const paymentData = await openRazorpayCheckout({
        description: sessionLabel,
        currency: order.currency,
        key: order.keyId,
        amount: order.amount,
        order_id: order.orderId,
        name: 'Connectiqo',
        prefill: {
          email: profile?.email || user?.email || '',
          contact: profile?.phone || '',
          name: profile?.name || user?.user_metadata?.full_name || '',
        },
        theme: { color: T.colors.accent.secondary },
      });

      const verifyResult = await paymentApi.verifyAndBook({
        razorpayOrderId: order.orderId,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
        mentorId,
        learnerId: payLearnerId,
        slotIds,
        message: message.trim(),
        recordingRequested,
      });

      const bookingIds =
        Array.isArray(verifyResult?.bookingIds) && verifyResult.bookingIds.length
          ? verifyResult.bookingIds
          : verifyResult?.bookingId
            ? [verifyResult.bookingId]
            : [];
      if (!bookingIds.length) {
        console.warn('verifyAndBook returned no bookingId; reminder not scheduled');
      }

      Toast.show(
        slotIds.length > 1
          ? 'Continuous session booked! Payment successful.'
          : 'Booking confirmed! Payment successful.',
      );
      setPaying(false);
      navigation.navigate(SCREEN_NAMES.RootUnifiedTabs, {
        screen: SCREEN_NAMES.LearnerSection,
        params: { screen: SCREEN_NAMES.LearnerBookings },
      });

      // Schedule reminders in background — don't block navigation
      void (async () => {
        try {
          await requestNotificationPermission();
          await Promise.all(
            bookingIds.map((bookingId, index) => {
              const slot = stillValid[index] || stillValid[0];
              return scheduleSessionReminder({
                bookingId,
                sessionDate: selectedDate,
                sessionTime: slot?.start_time,
                mentorName,
                isMentor: false,
              });
            }),
          );
        } catch (reminderErr) {
          console.warn('Session reminder scheduling failed:', reminderErr?.message || reminderErr);
        }
      })();
      return;
    } catch (err) {
      if (err?.code === 'PAYMENT_CANCELLED' || err?.description === 'Payment cancelled') {
        Toast.show('Payment cancelled');
      } else {
        console.error('Payment error:', err);
        Toast.show(err.message || 'Payment failed. Please try again.');
      }
    } finally {
      setPaying(false);
    }
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1),
  );
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const calendarWeeks = padCalendarWeeks(
    (() => {
      const weeks = [];
      for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
      }
      return weeks;
    })(),
  );
  const today = new Date();
  const todayStr = formatDate(today);
  const isPrevMonthDisabled =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  const displayName = mentorData?.profiles?.name || mentorName;
  const avatarUrl = mentorData?.profiles?.avatar_url;
  const specialization = mentorData?.specialization;
  const mentorRating = mentorData?.rating;
  const sessionDurationMin = selectedTimes[0]
    ? slotDurationMinutes(selectedTimes[0].start_time, selectedTimes[0].end_time)
    : null;
  const totalSessionMins = selectedTimes.reduce(
    (sum, slot) => sum + slotDurationMinutes(slot.start_time, slot.end_time),
    0,
  );

  let animStep = 0;
  const nextDelay = () => {
    const delay = animStep * ENTRANCE_STEP_MS;
    animStep += 1;
    return delay;
  };

  if (initialLoading) {
    return (
      <View style={styles.screenRoot}>
        <SafeScreen scrollable padding={T.spacing.md} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
          <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
          <View style={scheduleStyles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={12}
            >
              <MaterialIcons name="arrow-back" size={22} color={T.colors.text.primary} />
            </TouchableOpacity>
            <View style={scheduleStyles.topBarCenter}>
              <Text style={scheduleStyles.topBarTitle}>Book a session</Text>
              <Text style={scheduleStyles.topBarSub}>Secure your 1-on-1 slot</Text>
            </View>
            <View style={scheduleStyles.topBarSide} />
          </View>
          </StackScreenHeader>
          <BookingSkeleton />
        </SafeScreen>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <CelebrationScreenFx active={readyToPay && !paying} origin={fxOrigin} />

      <SafeScreen
        scrollable
        padding={T.spacing.md}
        hasBottomTabs={false}
        includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}
        scrollViewRef={scrollRef}
      >
        <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
        <View style={scheduleStyles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
            disabled={paying}
          >
            <MaterialIcons name="arrow-back" size={22} color={T.colors.text.primary} />
          </TouchableOpacity>
          <View style={scheduleStyles.topBarCenter}>
            <Text style={scheduleStyles.topBarTitle}>Book a session</Text>
            <Text style={scheduleStyles.topBarSub}>Secure your 1-on-1 slot</Text>
          </View>
          <View style={scheduleStyles.topBarSide} />
        </View>
        </StackScreenHeader>

        <Animated.View
          style={[
            styles.bookingHeaderStack,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <View style={styles.mentorHeaderCard}>
            <ScheduleHeroBanner
              initial={mentorInitial}
              name={displayName}
              label="Your mentor"
              avatarUrl={avatarUrl}
              style={styles.mentorHeroInCard}
            >
              <Text style={styles.mentorHeaderMeta} numberOfLines={2}>
                {[
                  selectedTimes.length > 1
                    ? `Live · ${totalSessionMins} min continuous`
                    : sessionDurationMin
                      ? `Live · ${sessionDurationMin} min`
                      : 'Live · 1-on-1',
                  specialization || null,
                  mentorRating > 0 ? `★ ${Number(mentorRating).toFixed(1)}` : null,
                  pricePerHour > 0 ? `₹${pricePerHour}/session` : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </ScheduleHeroBanner>
          </View>

          <BookingProgressSteps
            selectedDate={selectedDate}
            selectedTimes={selectedTimes}
            message={message}
            recordingRequested={recordingRequested}
            readyToPay={readyToPay}
          />
        </Animated.View>

        <FadeSlideIn delay={nextDelay()}>
          <ScheduleSectionBlock
            step="01"
            title="Pick a date"
            subtitle="Green dots show days with open slots"
          >
            <View style={scheduleStyles.calendarPanel}>
              <View style={scheduleStyles.monthHeader}>
                <PressScale
                  onPress={() => {
                    if (isPrevMonthDisabled) return;
                    layoutSpring();
                    const p = new Date(currentDate);
                    p.setMonth(p.getMonth() - 1);
                    setCurrentDate(p);
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
                  <Text style={scheduleStyles.monthSub}>Next {BOOKING_WINDOW_DAYS} days</Text>
                </View>
                <PressScale
                  onPress={() => {
                    layoutSpring();
                    const n = new Date(currentDate);
                    n.setMonth(n.getMonth() + 1);
                    setCurrentDate(n);
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
                    const daySlots = mentorAvailability[dateStr] || [];
                    const isSelected = selectedDate === dateStr;
                    const availableCount = filterAvailableSlots(daySlots, dateStr).length;
                    const bookedCount = filterVisibleBookingSlots(daySlots, dateStr).filter(s =>
                      isSlotBooked(s),
                    ).length;
                    const canView = isDateAllowed(dateStr) && (availableCount > 0 || bookedCount > 0);

                    return (
                      <ScheduleDayCell
                        key={`d-${day}`}
                        day={day}
                        isSelected={isSelected}
                        isToday={dateStr === todayStr}
                        enabled={canView}
                        muteLabel={!isDateAllowed(dateStr) || (!availableCount && !bookedCount)}
                        hasSlots={availableCount > 0 || bookedCount > 0}
                        slotCount={availableCount + bookedCount}
                        slotTone={availableCount > 0 ? 'open' : 'booked'}
                        onPress={() => canView && handleSelectDate(dateStr)}
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

        <FadeInSection show={timeSlotsForDate.length > 0} delay={60}>
          <FadeSlideIn delay={nextDelay()}>
            <ScheduleSectionBlock
              step="02"
              title="Choose your time"
              subtitle="Select back-to-back slots to book one continuous meeting"
              accent="teal"
            >
              <BookingSlotsPanel
                selectedDate={selectedDate}
                slots={timeSlotsForDate}
                selectedTimes={selectedTimes}
                onSelect={handleSelectTime}
              />
            </ScheduleSectionBlock>
          </FadeSlideIn>
        </FadeInSection>

        {timeSlotsForDate.length === 0 && selectedDate && !loading && (
          <FadeInSection show delay={0}>
            <View style={styles.emptyCard}>
              <MaterialIcons name="event-busy" size={32} color={PURPLE_LINK} />
              <Text style={styles.emptyTitle}>No slots this day</Text>
              <Text style={styles.emptySub}>Pick another highlighted date on the calendar</Text>
            </View>
          </FadeInSection>
        )}

        {Object.keys(mentorAvailability).length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <MaterialIcons name="sentiment-dissatisfied" size={36} color={TEAL} />
            <Text style={styles.emptyTitle}>No availability yet</Text>
            <Text style={styles.emptySub}>This mentor hasn't opened booking slots</Text>
          </View>
        )}

        {selectedTimes.length > 0 ? (
          <View
            style={styles.recordingSection}
            onLayout={e => {
              const y = e.nativeEvent.layout.y;
              recordingSectionY.current = y;
              const firstId = selectedTimes[0]?.id || selectedTimes[0]?.start_time;
              if (
                firstId &&
                y > 0 &&
                scrolledToRecordingFor.current !== firstId
              ) {
                scrolledToRecordingFor.current = firstId;
                scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 16), animated: true });
              }
            }}
          >
            <ScheduleSectionBlock
              step="03"
              title="Session recording"
              subtitle={
                selectedTimes.length > 1
                  ? 'This preference applies to your continuous session'
                  : 'Would you like this session to be recorded?'
              }
              accent="teal"
            >
              <View style={styles.recordingChoices}>
                {[
                  {
                    value: true,
                    icon: 'videocam',
                    title: 'Yes, record it',
                    subtitle: 'Recording starts after mentor agrees and runs until the meeting ends.',
                  },
                  {
                    value: false,
                    icon: 'videocam-off',
                    title: 'No recording',
                    subtitle: 'Recording controls will be disabled for this session.',
                  },
                ].map(option => {
                  const selected = recordingRequested === option.value;
                  return (
                    <Pressable
                      key={String(option.value)}
                      style={[
                        styles.recordingChoice,
                        selected && styles.recordingChoiceSelected,
                      ]}
                      onPress={() => setRecordingRequested(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <View
                        style={[
                          styles.recordingChoiceIcon,
                          selected && styles.recordingChoiceIconSelected,
                        ]}
                      >
                        <MaterialIcons
                          name={option.icon}
                          size={21}
                          color={selected ? TEAL : C.text.muted}
                        />
                      </View>
                      <View style={styles.recordingChoiceCopy}>
                        <Text
                          style={[
                            styles.recordingChoiceTitle,
                            selected && styles.recordingChoiceTitleSelected,
                          ]}
                        >
                          {option.title}
                        </Text>
                        <Text style={styles.recordingChoiceSubtitle}>{option.subtitle}</Text>
                      </View>
                      <MaterialIcons
                        name={
                          selected ? 'radio-button-checked' : 'radio-button-unchecked'
                        }
                        size={21}
                        color={selected ? PURPLE_LINK : C.text.muted}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.recordingPrivacyNote}>
                <MaterialIcons name="privacy-tip" size={16} color={TEAL} />
                <Text style={styles.recordingPrivacyText}>
                  Recordings are private and available only to session participants.
                </Text>
              </View>
            </ScheduleSectionBlock>
          </View>
        ) : null}

        <FadeInSection show={selectedTimes.length > 0} delay={100}>
          <View>
            <ScheduleSectionBlock
              step="04"
              title="Session goal"
              subtitle={
                selectedTimes.length > 1
                  ? `Goal for your ${totalSessionMins} min continuous session with ${displayName.split(' ')[0]}`
                  : `What should ${displayName.split(' ')[0]} focus on?`
              }
              accent="gold"
            >
              <GoalPromptChips
                selected={selectedPrompt}
                onSelect={text => {
                  setSelectedPrompt(text);
                  setMessage(text);
                }}
              />
              <TextInput
                style={styles.messageInput}
                placeholder="Describe your goals, questions, or what success looks like…"
                placeholderTextColor={T.colors.text.muted}
                value={message}
                onChangeText={text => {
                  setMessage(text);
                  if (selectedPrompt && text !== selectedPrompt) {
                    setSelectedPrompt(null);
                  }
                }}
                multiline
                numberOfLines={4}
                maxLength={500}
                autoCorrect
                spellCheck
                autoCapitalize="sentences"
              />
              <View style={styles.charRow}>
                <MaterialIcons name="tips-and-updates" size={14} color={T.colors.text.muted} />
                <Text style={styles.charHint}>Clear goals help mentors prepare better</Text>
                <Text style={styles.charCount}>{message.length}/500</Text>
              </View>
            </ScheduleSectionBlock>
          </View>
        </FadeInSection>

        <FadeInSection
          show={
            selectedTimes.length > 0 &&
            !!fees &&
            typeof recordingRequested === 'boolean' &&
            message.trim().length > 0
          }
          delay={140}
        >
          <View>
            <ScheduleSectionBlock
              step="05"
              title="Confirm your session"
              subtitle="Clear, upfront pricing"
              accent="violet"
            >
              <View style={styles.ticketCard}>
                <View style={styles.ticketTop}>
                  <View>
                    <Text style={styles.ticketLabel}>Session ticket</Text>
                    <Text style={styles.ticketMentor}>{displayName}</Text>
                    {selectedTimes.length > 0 ? (
                      <View style={styles.ticketSlotMetaBlock}>
                        <Text style={styles.ticketSlotMeta}>{formatDisplayDate(selectedDate)}</Text>
                        <Text style={styles.ticketSlotMeta}>
                          {formatSlotRange(
                            selectedTimes[0].start_time,
                            selectedTimes[selectedTimes.length - 1].end_time,
                          )}
                          {' · '}
                          {totalSessionMins} min
                          {selectedTimes.length > 1 ? ' continuous' : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <MaterialIcons name="confirmation-number" size={28} color={GOLD} />
                </View>
              <View style={styles.ticketPerforation}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <View key={i} style={styles.perfDot} />
                ))}
              </View>
              {selectedTimes.length > 1 ? (
                <FeeRow
                  label={`${selectedTimes.length} × block fee (${sessionDurationMin || 30} min)`}
                  amount={fees?.mentorAmount}
                />
              ) : (
                <FeeRow
                  label={`Session fee (${sessionDurationMin || 30} min)`}
                  amount={fees?.mentorAmount}
                />
              )}
              <FeeRow label={`Convenience (${fees?.platformFeePercent}%)`} amount={fees?.platformBaseFee} />
              <FeeRow label={`GST (${fees?.gstPercent}%)`} amount={fees?.gstOnFee} />
              <View style={styles.feeDivider} />
              <FeeRow
                label="Your session total"
                amount={fees?.totalAmount}
                bold
                accent
              />
              <View style={styles.secureRow}>
                <MaterialIcons name="lock" size={14} color={T.colors.accent.success} />
                <Text style={styles.secureText}>Safe & encrypted checkout</Text>
              </View>
            </View>
          </ScheduleSectionBlock>
          </View>
        </FadeInSection>

        <View style={{ height: 160 + stickyBottomPad }} />
      </SafeScreen>

      {/* Sticky checkout */}
      <Animated.View
        style={[
          scheduleStyles.stickyBar,
          {
            paddingBottom: stickyBottomPad,
            opacity: checkoutOpacity,
            transform: [{ translateY: checkoutSlide }],
            zIndex: 30,
            elevation: 30,
          },
        ]}
      >
        <View style={styles.checkoutFooter}>
          {readyToPay && selectedTimes.length > 0 && fees ? (
            <Animated.View
              style={[
                styles.checkoutTotalRow,
                {
                  transform: [
                    {
                      scale: totalPop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.03],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View>
                <Text style={styles.checkoutTotalLabel}>
                  {selectedTimes.length > 1
                    ? `Ready to book · ${totalSessionMins} min continuous`
                    : 'Ready to book'}
                </Text>
              </View>
              <Text style={styles.checkoutTotalAmount}>₹{fees.totalAmount}</Text>
            </Animated.View>
          ) : (
            <View style={styles.checkoutHintBlock}>
              {selectedTimes.length > 0 && fees ? (
                <View style={styles.checkoutTotalRow}>
                  <View>
                    <Text style={styles.checkoutTotalLabel}>
                      {selectedTimes.length > 1
                        ? `${totalSessionMins} min continuous estimate`
                        : 'Session estimate'}
                    </Text>
                  </View>
                  <Text style={styles.checkoutTotalAmount}>₹{fees.totalAmount}</Text>
                </View>
              ) : null}
              <Text style={styles.checkoutHint}>
                {!selectedTimes.length
                  ? 'Select date & time slots to continue'
                  : typeof recordingRequested !== 'boolean'
                    ? 'Choose a recording preference to continue'
                    : !message.trim()
                      ? 'Add your session goal to continue'
                      : !fees
                        ? 'Loading pricing…'
                        : 'Complete the steps above to continue'}
              </Text>
            </View>
          )}

          <CelebrationPayButton
            label={getBookingCtaLabel({
              paying,
              readyToPay,
              fees,
              selectedTimes,
              message,
              recordingRequested,
            })}
            onPress={handlePay}
            disabled={
              !selectedTimes.length ||
              !message.trim() ||
              typeof recordingRequested !== 'boolean' ||
              !fees ||
              paying
            }
            loading={paying}
            ready={readyToPay}
            size="checkout"
            style={styles.checkoutPayBtn}
            onOriginMeasure={setFxOrigin}
          />
        </View>
      </Animated.View>

      <LoadingOverlay
        visible={loading || paying}
        message={paying ? 'Securing your session…' : 'Loading availability…'}
      />
    </View>
  );
}

function createBookingStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  return StyleSheet.create({
  screenRoot: { flex: 1, overflow: 'hidden', backgroundColor: C.primary.void },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookingHeaderStack: {
    gap: T.spacing.md,
    marginBottom: T.spacing.sm,
  },
  mentorHeaderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: softFill(theme),
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.sm,
  },
  mentorHeroInCard: {
    marginBottom: 0,
    paddingVertical: 0,
  },
  mentorHeaderMeta: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: C.text.secondary,
    letterSpacing: 0.1,
  },

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
    borderColor: PURPLE_LINK,
  },

  progressWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 4,
    paddingVertical: T.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: softFill(theme),
  },
  progressStepCol: { flex: 1, alignItems: 'center' },
  progressStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: softBorder(theme),
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  progressDotActive: {
    backgroundColor: S.accentGold,
    borderColor: 'rgba(240,216,117,0.35)',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: softFillStrong(theme),
    marginHorizontal: 4,
    borderRadius: 1,
  },
  progressLineDone: { backgroundColor: C.accent.success, opacity: 0.45 },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text.muted,
    marginTop: 6,
    textAlign: 'center',
  },
  progressLabelDone: { color: B.successText },
  progressLabelActive: { color: GOLD },

  slotsPanel: {
    backgroundColor: softFill(theme),
    borderRadius: 16,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: T.spacing.md,
  },
  slotsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: T.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: softBorder(theme),
  },
  slotsPanelHeaderText: { flex: 1, paddingRight: T.spacing.sm },
  slotsPanelDate: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: 0.2,
  },
  slotsPanelMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: 4,
    lineHeight: 17,
  },
  selectedSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
  },
  selectedSessionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: B.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSessionBody: { flex: 1 },
  selectedSessionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent.success,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  selectedSessionRange: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 3,
  },
  selectedSessionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.muted,
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
  slotPeriodTitle: { fontSize: 13, fontWeight: '800', color: C.text.primary },
  slotPeriodHint: { fontSize: 11, fontWeight: '600', color: C.text.muted, marginTop: 1 },
  slotPeriodBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentSuccess,
    borderWidth: 1,
    borderColor: B.successBorder,
  },
  slotPeriodBadgeText: { fontSize: 11, fontWeight: '700', color: C.accent.success },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.spacing.sm,
  },
  slotCellWrap: { width: '31.5%' },
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
    minHeight: 72,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 6,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  timeSlotAvailable: {
    backgroundColor: softFill(theme),
    borderColor: softBorder(theme),
  },
  timeSlotSelected: {
    borderColor: B.successBorder,
    borderWidth: 1.5,
  },
  timeSlotBooked: {
    backgroundColor: S.accentWarning,
    borderColor: B.warningBorder,
  },
  timeSlotStatusIcon: { position: 'absolute', top: 6, right: 6 },
  timeSlotStart: {
    fontSize: 13,
    fontWeight: '800',
    color: C.text.primary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  timeSlotEnd: {
    fontSize: 11,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  timeSlotTextSelected: { color: B.successText },
  timeSlotTextBooked: { color: C.accent.warning },
  timeSlotDurationPill: {
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: softFillStrong(theme),
  },
  timeSlotDurationPillSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  timeSlotDurationPillBooked: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  timeSlotDurationText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.text.muted,
  },
  timeSlotDurationTextSelected: {
    color: B.successText,
  },

  promptRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: T.spacing.md,
    paddingRight: T.spacing.md,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: T.borderRadius.chip,
    backgroundColor: S.accentGold,
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.25)',
  },
  promptChipSelected: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  promptChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  promptChipTextSelected: {
    color: B.successText,
  },

  messageInput: {
    backgroundColor: INPUT_BG,
    color: C.text.primary,
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    minHeight: 110,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.sm,
  },
  charHint: {
    flex: 1,
    fontSize: 11,
    color: C.text.muted,
  },
  charCount: {
    fontSize: 11,
    color: C.text.muted,
  },

  recordingChoices: {
    gap: T.spacing.sm,
  },
  recordingSection: {
    marginTop: T.spacing.sm,
    marginBottom: T.spacing.md,
  },
  recordingChoice: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    padding: T.spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: softBorder(theme),
    backgroundColor: softFill(theme),
  },
  recordingChoiceSelected: {
    borderColor: 'rgba(94,234,212,0.5)',
    backgroundColor: S.accentTeal,
  },
  recordingChoiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: softFillStrong(theme),
    borderWidth: 1,
    borderColor: softBorder(theme),
  },
  recordingChoiceIconSelected: {
    borderColor: 'rgba(94,234,212,0.35)',
    backgroundColor: 'rgba(94,234,212,0.12)',
  },
  recordingChoiceCopy: {
    flex: 1,
  },
  recordingChoiceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.secondary,
    marginBottom: 3,
  },
  recordingChoiceTitleSelected: {
    color: C.text.primary,
  },
  recordingChoiceSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: C.text.muted,
  },
  recordingPrivacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    marginTop: T.spacing.md,
    padding: T.spacing.md,
    borderRadius: 12,
    backgroundColor: softFill(theme),
  },
  recordingPrivacyText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: C.text.muted,
  },

  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
    backgroundColor: PANEL_BG,
    overflow: 'hidden',
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: T.spacing.md,
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: PURPLE_LINK,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ticketMentor: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 4,
  },
  ticketSlotMetaBlock: {
    marginTop: 4,
    gap: 2,
  },
  ticketSlotMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.muted,
  },
  ticketSlotTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: C.accent.success,
    marginTop: 4,
  },
  ticketPerforation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.spacing.md,
    overflow: 'hidden',
  },
  perfDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(167,139,250,0.25)',
  },
  feeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(167,139,250,0.22)',
    marginVertical: T.spacing.md,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: T.spacing.md,
  },
  secureText: { fontSize: 13, color: C.text.muted },

  emptyCard: {
    alignItems: 'center',
    padding: T.spacing.xxl,
    marginBottom: T.spacing.md,
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: T.spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: C.text.primary },
  emptySub: { fontSize: 13, color: C.text.muted, textAlign: 'center', lineHeight: 20 },

  checkoutFooter: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    overflow: 'visible',
  },
  checkoutTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  checkoutTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text.muted,
  },
  checkoutTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: GOLD,
  },
  checkoutHint: {
    fontSize: 13,
    color: C.text.muted,
    marginBottom: T.spacing.md,
  },
  checkoutHintBlock: {
    marginBottom: 0,
  },
  checkoutPayBtn: {
    width: '100%',
    marginVertical: 0,
    minHeight: PLATFORM_LAYOUT.buttonMinHeight + 6,
  },
});
}