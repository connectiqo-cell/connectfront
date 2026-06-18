import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { UNIFIED_THEME } from '../../unifiedTheme';
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

// Validates YYYY-MM-DD
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

// Validates HH:MM (24-hour)
function isValidTime(str) {
  if (!/^\d{2}:\d{2}$/.test(str)) return false;
  const [h, m] = str.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// Auto-insert dashes as user types date: "20260618" → "2026-06-18"
function autoFormatDate(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

// Auto-insert colon as user types time: "1430" → "14:30"
function autoFormatTime(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function InputField({ label, placeholder, value, onChangeText, hint, error, keyboardType = 'default' }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.text.muted}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {hint ? <Text style={styles.inputHint}>{hint}</Text> : null}
      {error ? <Text style={styles.inputErrText}>{error}</Text> : null}
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={16} color={TEAL} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function RescheduleRequestScreen({ navigation, route }) {
  const { booking } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const slot = booking?.availability_slots || {};
  const learnerName = booking?.profiles?.name || 'Learner';
  const reason = booking?.reschedule_reason;
  const deadline = booking?.reschedule_deadline;

  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const reasonLabel =
    reason === 'mentor_noshow'
      ? "You didn't join the session"
      : reason === 'technical'
        ? 'Session ended too early (technical)'
        : 'Session could not be completed';

  const validate = () => {
    const e = {};
    if (!isValidDate(date)) e.date = 'Enter a valid date (YYYY-MM-DD), at least tomorrow';
    else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (new Date(date) < tomorrow) e.date = 'Date must be tomorrow or later';
    }
    if (!isValidTime(startTime)) e.startTime = 'Enter a valid time (HH:MM, 24-hour)';
    if (!isValidTime(endTime)) e.endTime = 'Enter a valid time (HH:MM, 24-hour)';
    if (!e.startTime && !e.endTime && startTime >= endTime) {
      e.endTime = 'End time must be after start time';
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
        mentorId: profile.id,
        learnerId: booking.learner_id,
        date,
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        reason,
      });
      Toast.show('Proposal sent! Learner will be notified.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send proposal');
    } finally {
      setLoading(false);
    }
  }, [date, startTime, endTime, booking, profile, reason, navigation]);

  return (
    <CosmicBackground style={{ flex: 1 }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Propose New Time</Text>
            <Text style={styles.headerSub}>For {learnerName}</Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        {/* Context card */}
        <View style={styles.contextCard}>
          <View style={styles.contextIconWrap}>
            <MaterialIcons name="event-repeat" size={28} color={TEAL} />
          </View>
          <Text style={styles.contextTitle}>Reschedule Request</Text>
          <Text style={styles.contextReason}>{reasonLabel}</Text>
          <View style={styles.contextDivider} />
          <InfoRow icon="event" label="Original date" value={formatDateForDisplay(slot.date)} />
          <InfoRow
            icon="access-time"
            label="Original time"
            value={`${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`}
          />
          {deadline ? (
            <InfoRow
              icon="schedule"
              label="Propose by"
              value={formatDateForDisplay(deadline.split('T')[0])}
            />
          ) : null}
        </View>

        {/* Input section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your available time</Text>
          <Text style={styles.sectionSub}>
            Pick a date and time that works for you. This slot will be reserved exclusively for {learnerName}.
          </Text>

          <InputField
            label="Date"
            placeholder="YYYY-MM-DD"
            value={date}
            onChangeText={v => setDate(autoFormatDate(v))}
            hint="e.g. 2026-07-15"
            error={errors.date}
            keyboardType="numeric"
          />
          <InputField
            label="Start time (24-hour)"
            placeholder="HH:MM"
            value={startTime}
            onChangeText={v => setStartTime(autoFormatTime(v))}
            hint="e.g. 14:00 for 2:00 PM"
            error={errors.startTime}
            keyboardType="numeric"
          />
          <InputField
            label="End time (24-hour)"
            placeholder="HH:MM"
            value={endTime}
            onChangeText={v => setEndTime(autoFormatTime(v))}
            hint="e.g. 15:00 for 3:00 PM"
            error={errors.endTime}
            keyboardType="numeric"
          />
        </View>

        {/* Preview */}
        {isValidDate(date) && isValidTime(startTime) && isValidTime(endTime) ? (
          <View style={styles.previewRow}>
            <MaterialIcons name="event-available" size={16} color={TEAL} />
            <Text style={styles.previewText}>
              {formatDateForDisplay(date)} · {startTime} – {endTime}
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
          style={styles.cta}
        />
        <CosmicButton
          label="Cancel"
          variant="ghost"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
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
  headerSide: { width: 40 },
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

  inputField: { gap: 6 },
  inputLabel: {
    ...T.typography.labelSm,
    color: C.text.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: S.chipStrong,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 14,
    ...T.typography.bodyMd,
    fontWeight: '700',
    color: C.text.primary,
  },
  inputFocused: {
    borderColor: TEAL,
    backgroundColor: S.accentTeal,
  },
  inputError: {
    borderColor: C.accent.error,
  },
  inputHint: {
    ...T.typography.bodyXs,
    color: C.text.muted,
  },
  inputErrText: {
    ...T.typography.bodyXs,
    color: C.accent.error,
    fontWeight: '600',
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

  cta: { marginTop: T.spacing.sm },
});
