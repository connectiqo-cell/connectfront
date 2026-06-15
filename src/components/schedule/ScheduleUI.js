import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../../unifiedTheme';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;

const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(167,139,250,0.22)';

export const CALENDAR_DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Ensures each calendar row has exactly 7 columns. */
export function padCalendarWeeks(weeks = []) {
  return weeks.map(week => {
    const padded = [...week];
    while (padded.length < 7) padded.push(null);
    return padded.slice(0, 7);
  });
}
export const scheduleStyles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  topBarSide: { width: 40 },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: {
    fontSize: 15,
    color: C.text.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  topBarSub: {
    fontSize: 11,
    color: PURPLE_LINK,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  heroBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_BG,
    overflow: 'hidden',
    marginBottom: T.spacing.md,
    padding: T.spacing.lg,
    ...Platform.select({ ios: T.shadows.medium, android: { elevation: 6 } }),
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.md },
  heroBody: { flex: 1, minWidth: 0 },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: PURPLE_LINK,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: T.borderRadius.chip,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaPillText: { fontSize: 10, fontWeight: '700', color: C.text.primary },

  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.primary.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: PURPLE_LINK },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS_BG,
    paddingVertical: 10,
    paddingHorizontal: T.spacing.md,
    marginBottom: T.spacing.lg,
    overflow: 'hidden',
  },
  previewScroll: { gap: T.spacing.sm, paddingRight: T.spacing.sm },
  previewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: T.borderRadius.chip,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewChipReady: {
    backgroundColor: S.accentSuccess,
    borderColor: B.successBorder,
  },
  previewChipWarning: {
    backgroundColor: S.accentWarning,
    borderColor: B.warningBorder,
  },
  previewChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text.primary,
    maxWidth: 140,
  },

  sectionBlock: { marginBottom: T.spacing.lg },
  sectionBlockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginBottom: T.spacing.md,
  },
  sectionStepBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionAccentGold: { backgroundColor: S.accentGold, borderColor: 'rgba(240,216,117,0.25)' },
  sectionAccentTeal: { backgroundColor: S.accentTeal, borderColor: 'rgba(94,234,212,0.25)' },
  sectionAccentViolet: { backgroundColor: S.accentViolet, borderColor: 'rgba(167,139,250,0.35)' },
  sectionStepNum: { fontSize: 13, fontWeight: '900', color: C.text.primary },
  sectionBlockTitles: { flex: 1 },
  sectionBlockTitle: { fontSize: 15, fontWeight: '800', color: C.text.primary },
  sectionBlockSub: { fontSize: 12, color: C.text.muted, marginTop: 2 },

  calendarPanel: {
    backgroundColor: GLASS_BG,
    borderRadius: 12,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.spacing.md,
    paddingBottom: T.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavBtnDisabled: { opacity: 0.35 },
  monthTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  monthYear: {
    fontSize: 17,
    color: C.text.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  monthSub: {
    fontSize: 11,
    color: C.text.muted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  calendarGrid: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: T.spacing.sm,
  },
  dayHeadersRow: {
    flexDirection: 'row',
    marginBottom: T.spacing.xs,
    paddingBottom: T.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: C.text.muted,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCellWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    minHeight: 44,
  },
  dayButton: {
    width: '100%',
    maxWidth: 42,
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  dayButtonAvailable: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: S.dayAvailableBorder,
  },
  dayButtonPast: {
    opacity: 0.28,
    backgroundColor: 'transparent',
  },
  dayButtonToday: {
    borderColor: 'rgba(94,234,212,0.55)',
    backgroundColor: 'rgba(94,234,212,0.08)',
  },
  dayButtonSelected: {
    width: '100%',
    maxWidth: 42,
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: B.primaryBorder,
    position: 'relative',
  },
  dayInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 14,
    color: C.text.primary,
    fontWeight: '700',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  dayNumberSelected: { color: B.primaryText, fontWeight: '800' },
  dayNumberDisabled: { color: C.text.muted, fontWeight: '600' },
  dayNumberToday: { color: TEAL, fontWeight: '800' },
  slotIndicator: {
    position: 'absolute',
    bottom: 5,
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL,
  },
  slotIndicatorBooked: {
    backgroundColor: C.accent.warning,
  },
  slotIndicatorSelected: {
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.spacing.md,
    marginTop: T.spacing.md,
    paddingTop: T.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL,
  },
  legendDotBooked: {
    backgroundColor: C.accent.warning,
  },
  legendDotToday: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: TEAL,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.text.muted,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
    backgroundColor: S.checkoutBar,
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
  },
});

export function ScheduleSectionBlock({ step, title, subtitle, children, accent = 'gold' }) {
  const accentStyle =
    accent === 'teal'
      ? scheduleStyles.sectionAccentTeal
      : accent === 'violet'
        ? scheduleStyles.sectionAccentViolet
        : scheduleStyles.sectionAccentGold;

  return (
    <View style={scheduleStyles.sectionBlock}>
      <View style={scheduleStyles.sectionBlockHead}>
        <View style={[scheduleStyles.sectionStepBadge, accentStyle]}>
          <Text style={scheduleStyles.sectionStepNum}>{step}</Text>
        </View>
        <View style={scheduleStyles.sectionBlockTitles}>
          <Text style={scheduleStyles.sectionBlockTitle}>{title}</Text>
          {subtitle ? <Text style={scheduleStyles.sectionBlockSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

export function SchedulePreviewBar({ children }) {
  return (
    <View style={scheduleStyles.previewBar}>
      <LinearGradient
        colors={S.previewGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <MaterialIcons name="auto-awesome" size={16} color={GOLD} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={scheduleStyles.previewScroll}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function SchedulePreviewChip({ icon, label, variant = 'default', textStyle }) {
  const chipStyle =
    variant === 'ready'
      ? scheduleStyles.previewChipReady
      : variant === 'warning'
        ? scheduleStyles.previewChipWarning
        : scheduleStyles.previewChip;

  return (
    <View style={chipStyle}>
      {icon}
      <Text style={[scheduleStyles.previewChipText, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ScheduleCalendarLegend() {
  return (
    <View style={scheduleStyles.calendarLegend}>
      <View style={scheduleStyles.legendItem}>
        <View style={scheduleStyles.legendDot} />
        <Text style={scheduleStyles.legendText}>Open slots</Text>
      </View>
      <View style={scheduleStyles.legendItem}>
        <View style={[scheduleStyles.legendDot, scheduleStyles.legendDotBooked]} />
        <Text style={scheduleStyles.legendText}>Booked</Text>
      </View>
      <View style={scheduleStyles.legendItem}>
        <View style={scheduleStyles.legendDotToday} />
        <Text style={scheduleStyles.legendText}>Today</Text>
      </View>
    </View>
  );
}

export function ScheduleDayCell({
  day,
  isSelected,
  isToday = false,
  enabled,
  hasSlots,
  slotCount,
  slotTone = 'open',
  muteLabel,
  onPress,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const showSlotIndicator = Boolean(hasSlots && Number(slotCount) > 0);

  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.08, friction: 4, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [isSelected, scale]);

  const onPressIn = () => {
    if (!enabled) return;
    Animated.spring(pressScale, {
      toValue: 0.9,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    if (!enabled) return;
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const combinedScale = Animated.multiply(scale, pressScale);

  const inner = (
    <View style={scheduleStyles.dayInner}>
      <Text
        style={[
          scheduleStyles.dayNumber,
          isSelected ? scheduleStyles.dayNumberSelected : null,
          muteLabel && !isSelected ? scheduleStyles.dayNumberDisabled : null,
          isToday && !isSelected && !muteLabel ? scheduleStyles.dayNumberToday : null,
        ]}
      >
        {String(day)}
      </Text>
      {showSlotIndicator ? (
        <View
          style={[
            scheduleStyles.slotIndicator,
            slotTone === 'booked' ? scheduleStyles.slotIndicatorBooked : null,
            isSelected ? scheduleStyles.slotIndicatorSelected : null,
          ]}
        />
      ) : null}
    </View>
  );

  if (isSelected) {
    return (
      <View style={scheduleStyles.dayCellWrap}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          disabled={!enabled}
        >
          <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
            <LinearGradient
              colors={B.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={scheduleStyles.dayButtonSelected}
            >
              {inner}
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={scheduleStyles.dayCellWrap}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!enabled}
      >
        <Animated.View
          style={[
            scheduleStyles.dayButton,
            enabled ? scheduleStyles.dayButtonAvailable : null,
            !enabled ? scheduleStyles.dayButtonPast : null,
            isToday && enabled ? scheduleStyles.dayButtonToday : null,
            { transform: [{ scale: combinedScale }] },
          ]}
        >
          {inner}
        </Animated.View>
      </Pressable>
    </View>
  );
}

export function ScheduleHeroBanner({ initial, name, label, avatarUrl, children }) {
  return (
    <View style={scheduleStyles.heroBanner}>
      <LinearGradient
        colors={S.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={scheduleStyles.heroRow}>
        <LinearGradient colors={B.premiumGradient} style={scheduleStyles.avatarRing}>
          <View style={scheduleStyles.avatarInner}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={scheduleStyles.avatarImage} />
            ) : (
              <Text style={scheduleStyles.avatarText}>{initial}</Text>
            )}
          </View>
        </LinearGradient>
        <View style={scheduleStyles.heroBody}>
          <Text style={scheduleStyles.heroLabel}>{label}</Text>
          <Text style={scheduleStyles.heroName} numberOfLines={1}>
            {name}
          </Text>
          {children}
        </View>
      </View>
    </View>
  );
}

export { T as scheduleTheme, B as scheduleButtons, S as scheduleSurface, PURPLE_LINK, GOLD, TEAL };
