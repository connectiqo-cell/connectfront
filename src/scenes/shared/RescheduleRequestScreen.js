import React, { useState, useCallback } from 'react';
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
import { rescheduleApi } from '../../api/rescheduleApi';
import { formatDateForDisplay, formatTime } from '../../utils/dateHelpers';
import { useAuth } from '../../hooks/useAuth';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;
const TEAL = C.accent.secondary;
const GOLD = C.accent.primary;
const GLASS_BORDER = C.border.light;
const PANEL = S.panel;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateDates(daysAhead = 21) {
  const items = [];
  const today = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const value = `${yyyy}-${mm}-${dd}`;
    const label = d.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
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

const SESSION_DURATION_MINUTES = 30;

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

// ── DropdownSheet ─────────────────────────────────────────────────────────────

function DropdownSheet({ visible, title, items, selected, onSelect, onClose, insets }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[sheet.panel, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
        {/* Handle */}
        <View style={sheet.handle} />

        {/* Title + close */}
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
                onPress={() => { onSelect(item.value); onClose(); }}
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

// ── SelectorRow ───────────────────────────────────────────────────────────────

function SelectorRow({ label, icon, value, placeholder, onPress, error }) {
  const styles = useThemedStyles(createRescheduleRequestStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.selector, error && styles.selectorError]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <MaterialIcons name={icon} size={18} color={value ? TEAL : C.text.muted} />
        <Text style={[styles.selectorValue, !value && styles.selectorPlaceholder]}>
          {value || placeholder}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={C.text.muted} />
      </TouchableOpacity>
      {error ? <Text style={styles.selectorErrText}>{error}</Text> : null}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RescheduleRequestScreen({ navigation, route }) {
  const styles = useThemedStyles(createRescheduleRequestStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const { booking } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const slot        = booking?.availability_slots || {};
  const learnerName = booking?.profiles?.name || 'Learner';
  const reason      = booking?.reschedule_reason;
  const deadline    = booking?.reschedule_deadline;

  const reasonLabel =
    reason === 'mentor_noshow'
      ? "You didn't join the session"
      : reason === 'technical'
        ? 'Session ended too early (technical)'
        : 'Session could not be completed';

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [errors,       setErrors]       = useState({});
  const [loading,      setLoading]      = useState(false);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const endTime = selectedTime ? addMinutes(selectedTime, SESSION_DURATION_MINUTES) : null;

  const dateItems = generateDates(21);
  const timeItems = generateTimeSlots();

  const validate = () => {
    const e = {};
    if (!selectedDate) e.date = 'Please select a date';
    if (!selectedTime) e.time = 'Please select a start time';
    if (selectedTime) {
      const [h] = endTime.split(':').map(Number);
      if (h >= 23) e.time = 'Session would end too late — pick an earlier start time';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await rescheduleApi.proposeSlot({
        bookingId: booking.id,
        mentorId:  profile.id,
        learnerId: booking.learner_id,
        date:      selectedDate,
        startTime: `${selectedTime}:00`,
        endTime:   `${endTime}:00`,
        reason,
      });
      Toast.show('Proposal sent! Learner will be notified.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedTime, endTime, booking, profile, reason, navigation]);

  const selectedDateLabel = dateItems.find(d => d.value === selectedDate)?.label || '';

  return (
    <CosmicBackground style={{ flex: 1 }}>
      <StackScreenHeader>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Context card */}
        <View style={styles.contextCard}>
          <View style={styles.contextIconWrap}>
            <MaterialIcons name="event-repeat" size={28} color={TEAL} />
          </View>
          <Text style={styles.contextTitle}>Reschedule Request</Text>
          <Text style={styles.contextReason}>{reasonLabel}</Text>
          <View style={styles.contextDivider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={16} color={TEAL} />
            <Text style={styles.infoLabel}>Original date</Text>
            <Text style={styles.infoValue}>{formatDateForDisplay(slot.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="access-time" size={16} color={TEAL} />
            <Text style={styles.infoLabel}>Original time</Text>
            <Text style={styles.infoValue}>{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</Text>
          </View>
          {deadline ? (
            <View style={styles.infoRow}>
              <MaterialIcons name="schedule" size={16} color={GOLD} />
              <Text style={styles.infoLabel}>Propose by</Text>
              <Text style={styles.infoValue}>{formatDateForDisplay(deadline.split('T')[0])}</Text>
            </View>
          ) : null}
        </View>

        {/* Selectors */}
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

          {/* Fixed duration chip */}
          <View style={styles.durationChip}>
            <MaterialIcons name="timelapse" size={16} color={TEAL} />
            <Text style={styles.durationChipText}>Session duration: 30 minutes</Text>
          </View>
        </View>

        {/* Preview */}
        {selectedDate && selectedTime ? (
          <View style={styles.previewRow}>
            <MaterialIcons name="event-available" size={16} color={TEAL} />
            <Text style={styles.previewText}>
              {selectedDateLabel} · {formatDisplayTime(selectedTime)} – {formatDisplayTime(endTime)}
            </Text>
          </View>
        ) : null}

        {/* Note */}
        <View style={styles.noteRow}>
          <MaterialIcons name="info-outline" size={16} color={GOLD} />
          <Text style={styles.noteText}>
            {learnerName} will have 48 hours to accept or decline. If declined, you can propose another time.
          </Text>
        </View>

        <CosmicButton
          label={loading ? 'Sending…' : 'Send Proposal'}
          variant="success"
          onPress={handleSubmit}
          disabled={loading}
          style={{ marginTop: T.spacing.sm }}
        />
        <CosmicButton
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>

      {/* Dropdown sheets */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

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
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const isLight = T.mode === 'light';
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: T.spacing.md,
    gap: T.spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...T.typography.headingXs,
    color: C.text.primary,
    fontWeight: '800',
  },
  headerSub: {
    ...T.typography.bodyXs,
    color: C.text.muted,
    marginTop: 2,
  },

  contextCard: {
    backgroundColor: PANEL,
    borderRadius: T.borderRadius.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
    alignItems: 'center',
    gap: T.spacing.sm,
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 4 } }),
  },
  contextIconWrap: {
    width: 56,
    height: 56,
    borderRadius: T.borderRadius.md,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: C.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.xs,
  },
  contextTitle: {
    ...T.typography.labelLg,
    fontWeight: '800',
    color: C.text.primary,
  },
  contextReason: {
    ...T.typography.bodySm,
    color: C.text.muted,
    textAlign: 'center',
  },
  contextDivider: {
    width: '100%',
    height: 1,
    backgroundColor: GLASS_BORDER,
    marginVertical: T.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    width: '100%',
  },
  infoLabel: {
    ...T.typography.bodySm,
    color: C.text.muted,
    flex: 1,
  },
  infoValue: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: C.text.primary,
  },

  section: {
    backgroundColor: PANEL,
    borderRadius: T.borderRadius.lg,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
    gap: T.spacing.md,
  },
  sectionTitle: {
    ...T.typography.labelMd,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionSub: {
    ...T.typography.bodySm,
    color: C.text.muted,
    lineHeight: 18,
  },

  selectorWrap: { gap: 6 },
  selectorLabel: {
    ...T.typography.labelSm,
    color: C.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    backgroundColor: S.chipStrong,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 14,
  },
  selectorError: {
    borderColor: C.accent.error,
  },
  selectorValue: {
    flex: 1,
    ...T.typography.bodyMd,
    fontWeight: '700',
    color: C.text.primary,
  },
  selectorPlaceholder: {
    color: C.text.muted,
    fontWeight: '400',
  },
  selectorErrText: {
    ...T.typography.bodyXs,
    color: C.accent.error,
    fontWeight: '600',
  },

  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: C.border.default,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 10,
  },
  durationChipText: {
    ...T.typography.bodySm,
    fontWeight: '700',
    color: TEAL,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    padding: T.spacing.md,
    backgroundColor: S.accentTeal,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: C.border.default,
  },
  previewText: {
    ...T.typography.labelMd,
    fontWeight: '700',
    color: C.text.primary,
  },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.sm,
    padding: T.spacing.md,
    backgroundColor: S.accentGold,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: B.goldOutlineBorder,
  },
  noteText: {
    flex: 1,
    ...T.typography.bodySm,
    color: GOLD,
    lineHeight: 18,
    fontWeight: '600',
  },
});
}