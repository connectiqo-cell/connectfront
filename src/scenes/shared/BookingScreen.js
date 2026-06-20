import React, { useEffect, useState, useRef } from 'react';
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
import RazorpayCheckout from 'react-native-razorpay';
import Toast from 'react-native-simple-toast';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import CelebrationPayButton, { CelebrationScreenFx } from '../../components/CelebrationPayButton';
import {
  scheduleStyles,
  ScheduleSectionBlock,
  SchedulePreviewBar,
  SchedulePreviewChip,
  ScheduleDayCell,
  ScheduleHeroBanner,
  ScheduleCalendarLegend,
  CALENDAR_DAY_LABELS,
  padCalendarWeeks,
} from '../../components/schedule/ScheduleUI';
import { availabilityApi } from '../../api/availabilityApi';
import { mentorApi } from '../../api/mentorApi';
import { paymentApi } from '../../api/paymentApi';
import { scheduleSessionReminder, requestNotificationPermission } from '../../utils/sessionReminder';
import { calculateFees } from '../../utils/feeCalculator';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = T.colors.buttons;
const S = T.colors.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';
const INPUT_BG = '#0f0e2a';
const GLASS_BORDER = 'rgba(167,139,250,0.22)';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const layoutSpring = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(280, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
};

const ENTRANCE_STEP_MS = 45;
const SLOT_BUFFER_MINS = 30;
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

const isTimeInPast = (dateStr, timeStr) => {
  const now = new Date();
  if (dateStr !== formatDate(now)) return false;
  const [hours, mins] = timeStr.substring(0, 5).split(':').map(Number);
  const slotTime = new Date();
  slotTime.setHours(hours, mins, 0, 0);
  return slotTime.getTime() - now.getTime() < SLOT_BUFFER_MINS * 60 * 1000;
};

const formatSlotTime = time24 => {
  const [h, m] = time24.substring(0, 5).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
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

function FadeInSection({ show, children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(28)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (!show) {
      opacity.setValue(0);
      translateY.setValue(28);
      scale.setValue(0.94);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 65,
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
  }, [show, delay, opacity, translateY, scale]);

  if (!show) return null;

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

const GOAL_PROMPTS = [
  'Career guidance',
  'Interview prep',
  'Skill improvement',
  'Project feedback',
  'Resume review',
];

function PressScale({ onPress, children, style, disabled, scaleTo = 0.94, showGlow = false }) {
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
  return (
    <View style={sk.wrap}>
      <SkeletonBone style={sk.hero} />
      <SkeletonBone style={sk.preview} />
      <SkeletonBone style={sk.progress} />
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
  hero: { height: 96, borderRadius: 16 },
  preview: { height: 44, borderRadius: 14 },
  progress: { height: 52, borderRadius: 14 },
  sectionTitle: { height: 36, width: '55%', borderRadius: 8 },
  calendar: { height: 280, borderRadius: 16 },
  slots: { height: 200, borderRadius: 16 },
});

function BookingProgressSteps({ selectedDate, selectedTime, message, readyToPay }) {
  const steps = [
    { id: 1, label: 'Date', icon: 'event', done: !!selectedDate },
    { id: 2, label: 'Time', icon: 'schedule', done: !!selectedTime },
    { id: 3, label: 'Goal', icon: 'flag', done: message.trim().length > 0 },
    { id: 4, label: 'Pay', icon: 'lock', done: readyToPay },
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
function getBookingCtaLabel({ paying, readyToPay, fees, selectedTime, message }) {
  if (paying) return 'Securing your spot…';
  if (!fees) return 'Get started';
  if (readyToPay) return `Secure My Spot · ₹${fees.totalAmount}`;
  if (selectedTime && !message.trim()) return 'One step left to book';
  if (selectedTime) return `Book My Session · ₹${fees.totalAmount}`;
  return 'Choose your slot';
}

function SessionPreviewBar({ selectedDate, selectedTime, mentorName, readyToPay }) {
  if (!selectedDate && !selectedTime) return null;

  const fmt = t => (t ? t.substring(0, 5) : '');
  const timeLabel = selectedTime
    ? `${fmt(selectedTime.start_time)} – ${fmt(selectedTime.end_time)}`
    : null;

  return (
    <SchedulePreviewBar>
      <SchedulePreviewChip
        icon={<MaterialIcons name="person" size={13} color={T.colors.accent.secondary} />}
        label={mentorName}
      />
      {selectedDate ? (
        <SchedulePreviewChip
          icon={<MaterialIcons name="event" size={13} color={T.colors.accent.primary} />}
          label={formatDisplayDate(selectedDate)}
        />
      ) : null}
      {timeLabel ? (
        <SchedulePreviewChip
          icon={<MaterialIcons name="schedule" size={13} color={T.colors.accent.success} />}
          label={timeLabel}
        />
      ) : null}
      {readyToPay ? (
        <SchedulePreviewChip
          variant="ready"
          icon={<MaterialIcons name="check-circle" size={13} color={B.successText} />}
          label="Ready"
          textStyle={{ color: B.successText }}
        />
      ) : null}
    </SchedulePreviewBar>
  );
}

function GoalPromptChips({ onSelect, selected }) {
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
  return (
    <View style={feeStyles.row}>
      <Text style={[feeStyles.label, bold && feeStyles.bold]}>{label}</Text>
      <Text style={[feeStyles.amount, bold && feeStyles.bold, accent && feeStyles.accent]}>
        ₹{amount}
      </Text>
    </View>
  );
}

function BookingTimeChip({ slot, selected, onPress, delayIndex = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

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
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, friction: 6, tension: 160, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
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

  const cellBody = (
    <View style={[styles.timeSlotCell, selected ? styles.timeSlotSelected : styles.timeSlotAvailable]}>
      {selected ? (
        <LinearGradient
          colors={B.successGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {selected ? (
        <MaterialIcons
          name="check-circle"
          size={13}
          color={B.successText}
          style={styles.timeSlotStatusIcon}
        />
      ) : (
        <MaterialIcons name="videocam" size={12} color={TEAL} style={styles.timeSlotStatusIcon} />
      )}
      <Text style={[styles.timeSlotStart, selected && styles.timeSlotTextSelected]} numberOfLines={1}>
        {formatSlotTime(slot.start_time)}
      </Text>
      <Text style={[styles.timeSlotEnd, selected && styles.timeSlotTextSelected]} numberOfLines={1}>
        to {formatSlotTime(slot.end_time)}
      </Text>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.slotCellWrap,
        { opacity: chipOpacity, transform: [{ translateY: chipY }, { scale }] },
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

function BookingSlotPeriodSection({ period, items, selectedTime, onSelect }) {
  if (!items.length) return null;

  return (
    <View style={styles.slotPeriodBlock}>
      <View style={styles.slotPeriodHeader}>
        <View style={styles.slotPeriodTitleRow}>
          <View style={styles.slotPeriodIcon}>
            <MaterialIcons name={period.icon} size={14} color={TEAL} />
          </View>
          <View>
            <Text style={styles.slotPeriodTitle}>{period.label}</Text>
            <Text style={styles.slotPeriodHint}>{period.hint}</Text>
          </View>
        </View>
        <View style={styles.slotPeriodBadge}>
          <Text style={styles.slotPeriodBadgeText}>{items.length} open</Text>
        </View>
      </View>
      <View style={styles.slotsGrid}>
        {items.map(({ slot, index }) => (
          <BookingTimeChip
            key={slot.id || `${slot.start_time}-${slot.end_time}`}
            slot={slot}
            selected={
              selectedTime?.start_time === slot.start_time &&
              selectedTime?.end_time === slot.end_time
            }
            delayIndex={index}
            onPress={() => onSelect(slot)}
          />
        ))}
      </View>
    </View>
  );
}

function BookingSlotsPanel({ selectedDate, slots, selectedTime, onSelect }) {
  const grouped = groupSlotsByPeriod(slots);

  return (
    <View style={styles.slotsPanel}>
      <View style={styles.slotsPanelHeader}>
        <View style={styles.slotsPanelHeaderText}>
          <Text style={styles.slotsPanelDate}>{formatDisplayDate(selectedDate)}</Text>
          <Text style={styles.slotsPanelMeta}>
            {slots.length} slot{slots.length !== 1 ? 's' : ''} available
          </Text>
        </View>
        {slots.length > 0 ? (
          <View style={styles.slotsPanelBadge}>
            <Text style={styles.slotsPanelBadgeText}>{slots.length}</Text>
          </View>
        ) : null}
      </View>

      {SLOT_PERIODS.map(period => (
        <BookingSlotPeriodSection
          key={period.id}
          period={period}
          items={grouped[period.id]}
          selectedTime={selectedTime}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

const feeStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, color: C.text.secondary },
  amount: { fontSize: 13, color: C.text.secondary },
  bold: { fontWeight: '800', color: C.text.primary, fontSize: 15 },
  accent: { color: GOLD, fontSize: 17, fontWeight: '800' },
});

export default function BookingScreen({ navigation, route }) {
  const { mentorId, mentorName } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const navBarInset = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);
  const stickyBottomPad = navBarInset + T.spacing.md;

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedTime, setSelectedTime] = useState(null);
  const [mentorAvailability, setMentorAvailability] = useState({});
  const [timeSlotsForDate, setTimeSlotsForDate] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [mentorData, setMentorData] = useState(null);
  const [feeConfig, setFeeConfig] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fxOrigin, setFxOrigin] = useState(null);

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

        if (profile?.id) {
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
        }

        if (!availability?.length) {
          setMentorAvailability({});
          return;
        }

        const byDate = {};
        availability.forEach(slot => {
          if (!byDate[slot.date]) byDate[slot.date] = [];
          byDate[slot.date].push({
            id: slot.id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_booked: slot.is_booked,
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
  }, [mentorId, profile?.id]);

  useEffect(() => {
    layoutSpring();
    const slots = mentorAvailability[selectedDate] || [];
    const available = slots
      .filter(s => !s.is_booked && !isTimeInPast(selectedDate, s.start_time))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    setTimeSlotsForDate(available);
    setSelectedTime(null);
  }, [selectedDate, mentorAvailability]);

  const handleSelectDate = dateStr => {
    if (!isDateAllowed(dateStr)) {
      Toast.show('Bookings are only available within the next 30 days');
      return;
    }
    if (!(mentorAvailability[dateStr]?.length)) {
      Toast.show('No availability on this date');
      return;
    }
    layoutSpring();
    setSelectedDate(dateStr);
  };

  const handleSelectTime = slot => {
    layoutSpring();
    setSelectedTime(slot);
  };

  const fees = pricePerHour > 0 ? calculateFees(pricePerHour, feeConfig || undefined) : null;

  const readyToPay = Boolean(
    selectedTime && message.trim().length > 0 && fees && !paying,
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
    if (!selectedDate || !selectedTime) {
      Toast.show('Please select a date and time slot');
      return;
    }
    if (!message.trim()) {
      Toast.show('Please share what you want to achieve');
      return;
    }
    if (!fees) {
      Toast.show('Unable to load pricing. Please go back and try again.');
      return;
    }

    try {
      setPaying(true);

      const order = await paymentApi.createOrder({
        mentorId,
        learnerId: profile.id,
        slotId: selectedTime.id,
        message: message.trim(),
      });

      const razorpayOptions = {
        description: `1-on-1 session with ${mentorName}`,
        currency: order.currency,
        key: order.keyId,
        amount: String(order.amount),
        order_id: order.orderId,
        name: 'Connectiqo',
        prefill: {
          email: profile.email || '',
          contact: profile.phone || '',
          name: profile.name || '',
        },
        theme: { color: T.colors.accent.secondary },
      };

      const paymentData = await RazorpayCheckout.open(razorpayOptions);

      const verifyResult = await paymentApi.verifyAndBook({
        razorpayOrderId: order.orderId,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
        mentorId,
        learnerId: profile.id,
        slotId: selectedTime.id,
        message: message.trim(),
      });

      const newBookingId = verifyResult?.bookingId;
      if (!newBookingId) {
        console.warn('verifyAndBook returned no bookingId; reminder not scheduled');
      }

      Toast.show('Booking confirmed! Payment successful.');
      setPaying(false);
      navigation.navigate(SCREEN_NAMES.RootUnifiedTabs, {
        screen: SCREEN_NAMES.LearnerSection,
        params: { screen: SCREEN_NAMES.LearnerBookings },
      });

      // Schedule reminder in background — don't block navigation
      void (async () => {
        try {
          await requestNotificationPermission();
          if (newBookingId) {
            await scheduleSessionReminder({
              bookingId: newBookingId,
              sessionDate: selectedDate,
              sessionTime: selectedTime.start_time,
              mentorName,
              isMentor: false,
            });
          }
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
  const sessionDurationMin = selectedTime
    ? slotDurationMinutes(selectedTime.start_time, selectedTime.end_time)
    : null;

  let animStep = 0;
  const nextDelay = () => {
    const delay = animStep * ENTRANCE_STEP_MS;
    animStep += 1;
    return delay;
  };

  if (initialLoading) {
    return (
      <View style={styles.screenRoot}>
        <SafeScreen scrollable padding={T.spacing.md} hasBottomTabs={false}>
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
          <BookingSkeleton />
        </SafeScreen>
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <CelebrationScreenFx active={readyToPay && !paying} origin={fxOrigin} />

      <SafeScreen scrollable padding={T.spacing.md} hasBottomTabs={false}>
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

        <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
          <ScheduleHeroBanner
            initial={mentorInitial}
            name={displayName}
            label="Your mentor"
            avatarUrl={avatarUrl}
          >
            <View style={scheduleStyles.metaRow}>
              <View style={scheduleStyles.metaPill}>
                <MaterialIcons name="videocam" size={12} color={T.colors.accent.secondary} />
                <Text style={scheduleStyles.metaPillText}>
                  {sessionDurationMin ? `Live · ${sessionDurationMin} min` : 'Live · 1-on-1'}
                </Text>
              </View>
              {specialization ? (
                <View style={scheduleStyles.metaPill}>
                  <MaterialIcons name="work-outline" size={12} color={PURPLE_LINK} />
                  <Text style={scheduleStyles.metaPillText} numberOfLines={1}>
                    {specialization}
                  </Text>
                </View>
              ) : null}
              {mentorRating > 0 ? (
                <View style={scheduleStyles.metaPill}>
                  <MaterialIcons name="star" size={12} color={GOLD} />
                  <Text style={scheduleStyles.metaPillText}>{Number(mentorRating).toFixed(1)}</Text>
                </View>
              ) : null}
              {pricePerHour > 0 ? (
                <View style={scheduleStyles.metaPill}>
                  <MaterialIcons name="payments" size={12} color={T.colors.accent.primary} />
                  <Text style={scheduleStyles.metaPillText}>₹{pricePerHour}/hr</Text>
                </View>
              ) : null}
            </View>
          </ScheduleHeroBanner>

          <SessionPreviewBar
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            mentorName={displayName}
            readyToPay={readyToPay}
          />

          <BookingProgressSteps
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            message={message}
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
                    const isSelected = selectedDate === dateStr;
                    const hasSlots = (mentorAvailability[dateStr] || []).length > 0;
                    const availableCount = (mentorAvailability[dateStr] || []).filter(
                      s => !s.is_booked && !isTimeInPast(dateStr, s.start_time),
                    ).length;
                    const canBook = isDateAllowed(dateStr) && availableCount > 0;

                    return (
                      <ScheduleDayCell
                        key={`d-${day}`}
                        day={day}
                        isSelected={isSelected}
                        isToday={dateStr === todayStr}
                        enabled={canBook}
                        muteLabel={!isDateAllowed(dateStr) || !hasSlots}
                        hasSlots={hasSlots && availableCount > 0}
                        slotCount={availableCount}
                        slotTone="open"
                        onPress={() => canBook && handleSelectDate(dateStr)}
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
              title="Choose a time"
              subtitle="Tap a slot to reserve your session"
              accent="teal"
            >
              <BookingSlotsPanel
                selectedDate={selectedDate}
                slots={timeSlotsForDate}
                selectedTime={selectedTime}
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

        <FadeInSection show={!!selectedTime} delay={100}>
          <FadeSlideIn delay={nextDelay()}>
            <ScheduleSectionBlock
              step="03"
              title="Session goal"
              subtitle={`What should ${displayName.split(' ')[0]} focus on?`}
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
              />
              <View style={styles.charRow}>
                <MaterialIcons name="tips-and-updates" size={14} color={T.colors.text.muted} />
                <Text style={styles.charHint}>Clear goals help mentors prepare better</Text>
                <Text style={styles.charCount}>{message.length}/500</Text>
              </View>
            </ScheduleSectionBlock>
          </FadeSlideIn>
        </FadeInSection>

        <FadeInSection show={!!selectedTime && !!fees} delay={140}>
          <FadeSlideIn delay={nextDelay()}>
            <ScheduleSectionBlock step="04" title="Confirm your session" subtitle="Clear, upfront pricing" accent="violet">
              <View style={styles.ticketCard}>
                <View style={styles.ticketTop}>
                  <View>
                    <Text style={styles.ticketLabel}>Session ticket</Text>
                    <Text style={styles.ticketMentor}>{displayName}</Text>
                    {selectedTime ? (
                      <Text style={styles.ticketSlotMeta}>
                        {formatDisplayDate(selectedDate)} · {formatSlotTime(selectedTime.start_time)} – {formatSlotTime(selectedTime.end_time)}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="confirmation-number" size={28} color={GOLD} />
                </View>
              <View style={styles.ticketPerforation}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <View key={i} style={styles.perfDot} />
                ))}
              </View>
              <FeeRow label="Session fee (20 min)" amount={fees?.mentorAmount} />
              <FeeRow label={`Convenience (${fees?.platformFeePercent}%)`} amount={fees?.platformBaseFee} />
              <FeeRow label={`GST (${fees?.gstPercent}%)`} amount={fees?.gstOnFee} />
              <View style={styles.feeDivider} />
              <FeeRow label="Your session total" amount={fees?.totalAmount} bold accent />
              <View style={styles.secureRow}>
                <MaterialIcons name="lock" size={14} color={T.colors.accent.success} />
                <Text style={styles.secureText}>Safe & encrypted checkout</Text>
              </View>
            </View>
          </ScheduleSectionBlock>
          </FadeSlideIn>
        </FadeInSection>

        <View style={{ height: 112 + stickyBottomPad }} />
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
          {selectedTime && fees ? (
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
                  {readyToPay ? 'Ready to book' : 'Session estimate'}
                </Text>
              </View>
              <Text style={styles.checkoutTotalAmount}>₹{fees.totalAmount}</Text>
            </Animated.View>
          ) : (
            <Text style={styles.checkoutHint}>
              {selectedTime ? 'Add your session goal to continue' : 'Select date & time to continue'}
            </Text>
          )}

          <CelebrationPayButton
            label={getBookingCtaLabel({
              paying,
              readyToPay,
              fees,
              selectedTime,
              message,
            })}
            onPress={handlePay}
            disabled={!selectedTime || !message.trim() || paying}
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

const styles = StyleSheet.create({
  screenRoot: { flex: 1, overflow: 'hidden' },

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
    marginBottom: T.spacing.lg,
    paddingHorizontal: 4,
    paddingVertical: T.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
    borderRadius: 1,
  },
  progressLineDone: { backgroundColor: 'rgba(52,211,153,0.45)' },
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
    backgroundColor: 'rgba(255,255,255,0.07)',
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPeriodTitle: { fontSize: 13, fontWeight: '800', color: C.text.primary },
  slotPeriodHint: { fontSize: 11, fontWeight: '600', color: C.text.muted, marginTop: 1 },
  slotPeriodBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: T.borderRadius.chip,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
  },
  slotPeriodBadgeText: { fontSize: 11, fontWeight: '700', color: TEAL },
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
    borderColor: TEAL,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  timeSlotSelected: {
    borderColor: B.successBorder,
    borderWidth: 1.5,
  },
  timeSlotStatusIcon: { position: 'absolute', top: 6, right: 6 },
  timeSlotStart: { fontSize: 13, fontWeight: '800', color: C.text.primary },
  timeSlotEnd: { fontSize: 10, fontWeight: '600', color: C.text.muted, marginTop: 2 },
  timeSlotTextSelected: { color: B.successText },

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
  ticketSlotMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.muted,
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
  checkoutPayBtn: {
    width: '100%',
    marginVertical: 0,
  },
});
