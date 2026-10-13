import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import StackScreenHeader from '../../components/StackScreenHeader';
import CosmicButton from '../../components/CosmicButton';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import {
  rescheduleApi,
  rescheduleReasonLabel,
  MAX_RESCHEDULE_ATTEMPTS,
} from '../../api/rescheduleApi';
import { formatDateForDisplay, formatTime } from '../../utils/dateHelpers';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const GLASS_BORDER = C.border.light;
const PANEL = S.panel;

function generateDates(daysAhead = 21) {
  const items = [];
  const today = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const value = `${yyyy}-${mm}-${dd}`;
    const label = d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    items.push({ label, value });
  }
  return items;
}

function generateTimeSlots() {
  const slots = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;
      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      const label = `${displayH}:${mm} ${period}`;
      slots.push({ label, value });
    }
  }
  return slots;
}

function slotDurationMinutes(slot) {
  if (!slot?.start_time || !slot?.end_time) return 30;
  const [sh, sm] = String(slot.start_time).slice(0, 5).split(':').map(Number);
  const [eh, em] = String(slot.end_time).slice(0, 5).split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins : 30;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function formatDisplayTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function DropdownSheet({ visible, title, items, selected, onSelect, onClose, insets }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[sheet.panel, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        <View style={sheet.handle} />
        <View style={sheet.header}>
          <Text style={sheet.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={22} color={C.text.muted} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={items}
          keyExtractor={item => String(item.value)}
          showsVerticalScrollIndicator={false}
          style={sheet.list}
          renderItem={({ item }) => {
            const isSelected = item.value === selected;
            return (
              <TouchableOpacity
                style={[sheet.item, isSelected && sheet.itemSelected]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[sheet.itemText, isSelected && sheet.itemTextSelected]}>
                  {item.label}
                </Text>
                {isSelected ? (
                  <MaterialIcons name="check-circle" size={20} color={TEAL} />
                ) : (
                  <MaterialIcons name="radio-button-unchecked" size={20} color={C.text.muted} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

function SelectorRow({ label, icon, value, placeholder, onPress, error }) {
  const styles = useThemedStyles(createRescheduleRequestStyles);
  const { theme } = useTheme();
  const localC = theme.colors;
  const localTeal = localC.accent.secondary;
  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selector, error && styles.selectorError]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <MaterialIcons name={icon} size={18} color={value ? localTeal : localC.text.muted} />
        <Text style={[styles.selectorValue, !value && styles.selectorPlaceholder]}>
          {value || placeholder}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={localC.text.muted} />
      </TouchableOpacity>
      {error ? <Text style={styles.selectorErrText}>{error}</Text> : null}
    </View>
  );
}

export default function RescheduleRequestScreen({ navigation, route }) {
  const styles = useThemedStyles(createRescheduleRequestStyles);
  const { theme } = useTheme();
  const localC = theme.colors;
  const localGold = localC.accent.primary;
  const localTeal = localC.accent.secondary;
  const { booking } = route.params;
  const insets = useSafeAreaInsets();

  const slot = booking?.availability_slots || {};
  const learnerName = booking?.profiles?.name || 'Creator';
  const reason = booking?.reschedule_reason;
  const deadline = booking?.reschedule_deadline;
  const durationMinutes = useMemo(() => slotDurationMinutes(slot), [slot]);
  const reasonLabel = rescheduleReasonLabel(reason, 'mentor');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!booking?.id) return undefined;
    rescheduleApi
      .getDeclinedCount(booking.id)
      .then(count => {
        if (!cancelled) setDeclinedCount(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [booking?.id]);

  const endTime = selectedTime ? addMinutes(selectedTime, durationMinutes) : null;
  const dateItems = generateDates(21);
  const timeItems = generateTimeSlots();

  const validate = () => {
    const e = {};
    if (!selectedDate) e.date = 'Please select a date';
    if (!selectedTime) e.time = 'Please select a start time';
    if (selectedTime && endTime) {
      const [h] = endTime.split(':').map(Number);
      if (h >= 23 || (h === 0 && selectedTime.split(':').map(Number)[0] > 0)) {
        e.time = 'Session would end too late — pick an earlier start time';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    if (booking?.status === 'reschedule_proposed') {
      Alert.alert('Already proposed', 'Waiting for the creator to respond to your current proposal.');
      return;
    }
    if (booking?.status === 'reschedule_unresolved') {
      Alert.alert('Unresolved', 'This booking can no longer be rescheduled.');
      return;
    }
    setLoading(true);
    try {
      await rescheduleApi.proposeSlot({
        bookingId: booking.id,
        date: selectedDate,
        startTime: `${selectedTime}:00`,
        endTime: `${endTime}:00`,
      });
      Toast.show('Proposal sent! The creator will be notified.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTime, endTime, booking, navigation]);

  const selectedDateLabel = dateItems.find(d => d.value === selectedDate)?.label || '';
  const attemptsLeft = Math.max(0, MAX_RESCHEDULE_ATTEMPTS - declinedCount);

  if (booking?.status === 'reschedule_unresolved') {
    return (
      <CosmicBackground style={{ flex: 1 }}>
        <View style={[styles.centeredFull, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <MaterialIcons name="event-busy" size={48} color={localC.text.muted} />
          <Text style={styles.resultTitle}>Reschedule unresolved</Text>
          <Text style={styles.resultSub}>
            You and {learnerName} could not agree on a new time after {MAX_RESCHEDULE_ATTEMPTS}{' '}
            proposals. This booking is now closed.
          </Text>
          <CosmicButton
            label="Back to Sessions"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: T.spacing.xl, width: '80%' }}
          />
        </View>
      </CosmicBackground>
    );
  }

  if (booking?.status === 'reschedule_proposed') {
    return (
      <CosmicBackground style={{ flex: 1 }}>
        <View style={[styles.centeredFull, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <MaterialIcons name="hourglass-empty" size={48} color={localGold} />
          <Text style={styles.resultTitle}>Waiting for {learnerName}</Text>
          <Text style={styles.resultSub}>
            You've already proposed a new time. {learnerName} has 48 hours to accept or decline.
          </Text>
          <CosmicButton
            label="Back to Sessions"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: T.spacing.xl, width: '80%' }}
          />
        </View>
      </CosmicBackground>
    );
  }

  return (
    <CosmicBackground style={{ flex: 1 }}>
      <StackScreenHeader>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color={localC.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Propose New Time</Text>
            <Text style={styles.headerSub}>For {learnerName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </StackScreenHeader>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contextCard}>
          <View style={styles.contextIconWrap}>
            <MaterialIcons name="event-repeat" size={28} color={localTeal} />
          </View>
          <Text style={styles.contextTitle}>Reschedule Request</Text>
          <Text style={styles.contextReason}>{reasonLabel}</Text>
          <View style={styles.contextDivider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={16} color={localTeal} />
            <Text style={styles.infoLabel}>Original date</Text>
            <Text style={styles.infoValue}>{formatDateForDisplay(slot.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="access-time" size={16} color={localTeal} />
            <Text style={styles.infoLabel}>Original time</Text>
            <Text style={styles.infoValue}>
              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
            </Text>
          </View>
          {deadline ? (
            <View style={styles.infoRow}>
              <MaterialIcons name="schedule" size={16} color={localGold} />
              <Text style={styles.infoLabel}>Propose by</Text>
              <Text style={styles.infoValue}>
                {formatDateForDisplay(deadline.split('T')[0])}
              </Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <MaterialIcons name="replay" size={16} color={localGold} />
            <Text style={styles.infoLabel}>Attempts</Text>
            <Text style={styles.infoValue}>
              {declinedCount + 1} of {MAX_RESCHEDULE_ATTEMPTS}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pick a new time</Text>
          <Text style={styles.sectionSub}>
            This slot will be reserved exclusively for {learnerName}.
          </Text>

          <SelectorRow
            label="Date"
            icon="event"
            value={selectedDateLabel}
            placeholder="Select a date"
            onPress={() => setShowDate(true)}
            error={errors.date}
          />
          <SelectorRow
            label="Start Time"
            icon="access-time"
            value={selectedTime ? formatDisplayTime(selectedTime) : ''}
            placeholder="Select start time"
            onPress={() => setShowTime(true)}
            error={errors.time}
          />

          <View style={styles.durationChip}>
            <MaterialIcons name="timelapse" size={16} color={localTeal} />
            <Text style={styles.durationChipText}>
              Session duration: {durationMinutes} minutes
            </Text>
          </View>
        </View>

        {selectedDate && selectedTime ? (
          <View style={styles.previewRow}>
            <MaterialIcons name="event-available" size={16} color={localTeal} />
            <Text style={styles.previewText}>
              {selectedDateLabel} · {formatDisplayTime(selectedTime)} – {formatDisplayTime(endTime)}
            </Text>
          </View>
        ) : null}

        <View style={styles.noteRow}>
          <MaterialIcons name="info-outline" size={16} color={localGold} />
          <Text style={styles.noteText}>
            {learnerName} has 48 hours to accept or decline.
            {attemptsLeft > 0
              ? ` If declined ${attemptsLeft} more time${attemptsLeft === 1 ? '' : 's'}, this booking becomes unresolved.`
              : ''}
          </Text>
        </View>

        <CosmicButton
          label={loading ? 'Sending…' : 'Send Proposal'}
          variant="success"
          onPress={handleSubmit}
          disabled={loading || (booking?.status && booking.status !== 'reschedule_needed')}
          style={{ marginTop: T.spacing.sm }}
        />
        <CosmicButton label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>

      <DropdownSheet
        visible={showDate}
        title="Select Date"
        items={dateItems}
        selected={selectedDate}
        onSelect={setSelectedDate}
        onClose={() => setShowDate(false)}
        insets={insets}
      />
      <DropdownSheet
        visible={showTime}
        title="Select Start Time"
        items={timeItems}
        selected={selectedTime}
        onSelect={setSelectedTime}
        onClose={() => setShowTime(false)}
        insets={insets}
      />
    </CosmicBackground>
  );
}

const sheet = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  panel: {
    backgroundColor: S.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: T.spacing.md,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: GLASS_BORDER,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: T.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: T.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    marginBottom: T.spacing.xs,
  },
  title: {
    ...T.typography.labelLg,
    fontWeight: '800',
    color: C.text.primary,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: T.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  itemSelected: {
    backgroundColor: S.accentTeal,
  },
  itemText: {
    ...T.typography.bodyMd,
    color: C.text.secondary,
    fontWeight: '600',
  },
  itemTextSelected: {
    color: TEAL,
    fontWeight: '800',
  },
});

function createRescheduleRequestStyles(theme) {
  const localT = theme;
  const localC = theme.colors;
  const localB = localC.buttons;
  const localS = localC.surface;
  const localGold = localC.accent.primary;
  const localTeal = localC.accent.secondary;
  const localPanel = localC.surface.panel;
  const localBorder = localC.border.light;
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: localT.spacing.md,
      gap: localT.spacing.md,
    },
    centeredFull: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: localT.spacing.xl,
      gap: localT.spacing.md,
    },
    resultTitle: {
      ...localT.typography.headingMd,
      color: localC.text.primary,
      fontWeight: '800',
      textAlign: 'center',
    },
    resultSub: {
      ...localT.typography.bodyMd,
      color: localC.text.muted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 300,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: localT.spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: localT.borderRadius.md,
      backgroundColor: localPanel,
      borderWidth: 1,
      borderColor: localBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: {
      ...localT.typography.headingXs,
      color: localC.text.primary,
      fontWeight: '800',
    },
    headerSub: {
      ...localT.typography.bodyXs,
      color: localC.text.muted,
      marginTop: 2,
    },
    contextCard: {
      backgroundColor: localPanel,
      borderRadius: localT.borderRadius.lg,
      borderWidth: 1,
      borderColor: localBorder,
      padding: localT.spacing.lg,
      alignItems: 'center',
      gap: localT.spacing.sm,
      ...Platform.select({ ios: localT.shadows.medium, android: { elevation: 4 } }),
    },
    contextIconWrap: {
      width: 56,
      height: 56,
      borderRadius: localT.borderRadius.md,
      backgroundColor: localS.accentTeal,
      borderWidth: 1,
      borderColor: localC.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: localT.spacing.xs,
    },
    contextTitle: {
      ...localT.typography.labelLg,
      fontWeight: '800',
      color: localC.text.primary,
    },
    contextReason: {
      ...localT.typography.bodySm,
      color: localC.text.muted,
      textAlign: 'center',
    },
    contextDivider: {
      width: '100%',
      height: 1,
      backgroundColor: localBorder,
      marginVertical: localT.spacing.xs,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: localT.spacing.sm,
      width: '100%',
    },
    infoLabel: {
      ...localT.typography.bodySm,
      color: localC.text.muted,
      flex: 1,
    },
    infoValue: {
      ...localT.typography.bodySm,
      fontWeight: '700',
      color: localC.text.primary,
    },
    section: {
      backgroundColor: localPanel,
      borderRadius: localT.borderRadius.lg,
      borderWidth: 1,
      borderColor: localBorder,
      padding: localT.spacing.lg,
      gap: localT.spacing.md,
    },
    sectionTitle: {
      ...localT.typography.labelMd,
      fontWeight: '800',
      color: localC.text.primary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionSub: {
      ...localT.typography.bodySm,
      color: localC.text.muted,
      lineHeight: 18,
    },
    selectorWrap: { gap: 6 },
    selectorLabel: {
      ...localT.typography.labelSm,
      color: localC.text.secondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: localT.spacing.sm,
      backgroundColor: localS.chipStrong,
      borderRadius: localT.borderRadius.md,
      borderWidth: 1,
      borderColor: localBorder,
      paddingHorizontal: localT.spacing.md,
      paddingVertical: 14,
    },
    selectorError: {
      borderColor: localC.accent.error,
    },
    selectorValue: {
      flex: 1,
      ...localT.typography.bodyMd,
      fontWeight: '700',
      color: localC.text.primary,
    },
    selectorPlaceholder: {
      color: localC.text.muted,
      fontWeight: '400',
    },
    selectorErrText: {
      ...localT.typography.bodyXs,
      color: localC.accent.error,
      fontWeight: '600',
    },
    durationChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: localT.spacing.sm,
      backgroundColor: localS.accentTeal,
      borderRadius: localT.borderRadius.md,
      borderWidth: 1,
      borderColor: localC.border.default,
      paddingHorizontal: localT.spacing.md,
      paddingVertical: 10,
    },
    durationChipText: {
      ...localT.typography.bodySm,
      fontWeight: '700',
      color: localTeal,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: localT.spacing.sm,
      padding: localT.spacing.md,
      backgroundColor: localS.accentTeal,
      borderRadius: localT.borderRadius.md,
      borderWidth: 1,
      borderColor: localC.border.default,
    },
    previewText: {
      ...localT.typography.labelMd,
      fontWeight: '700',
      color: localC.text.primary,
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: localT.spacing.sm,
      padding: localT.spacing.md,
      backgroundColor: localS.accentGold,
      borderRadius: localT.borderRadius.md,
      borderWidth: 1,
      borderColor: localB.goldOutlineBorder,
    },
    noteText: {
      flex: 1,
      ...localT.typography.bodySm,
      color: localGold,
      lineHeight: 18,
      fontWeight: '600',
    },
  });
}
