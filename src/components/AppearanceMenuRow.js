import { View, Text, Pressable, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../hooks/useTheme';
import { THEME_MODES } from '../unifiedTheme';

function getSubtitle(followsSystem, isDark) {
  if (followsSystem) {
    return `Following system · currently ${isDark ? 'Dark' : 'Light'}`;
  }
  return isDark ? 'Dark theme' : 'Light theme';
}

/**
 * Dark / Light segmented control for Settings → Preferences.
 * Long-press the row to reset to system theme.
 */
export default function AppearanceMenuRow({ noBorder = false }) {
  const { theme, isDark, followsSystem, setThemePreference, resetToSystemTheme } = useTheme();
  const C = theme.colors;
  const TEAL = C.accent.secondary;
  const trackBg = C.surface.chipStrong || C.surface.chip || 'rgba(255,255,255,0.08)';
  const activeBg = isDark ? TEAL : C.buttons?.nebulaGradient?.[0] || '#6d4aff';
  const activeText = C.text.onAccent || '#ffffff';
  const idleText = C.text.secondary;

  const selectLight = () => setThemePreference(THEME_MODES.LIGHT);
  const selectDark = () => setThemePreference(THEME_MODES.DARK);

  return (
    <Pressable
      onLongPress={resetToSystemTheme}
      delayLongPress={450}
      accessibilityRole="summary"
      accessibilityHint="Long press to use system appearance"
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: noBorder ? 'transparent' : C.border.light,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: C.surface.accentTeal,
              borderColor: C.border.light,
            },
          ]}
        >
          <MaterialIcons
            name={isDark ? 'dark-mode' : 'light-mode'}
            size={20}
            color={TEAL}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: C.text.primary }]}>Appearance</Text>
          <Text style={[styles.subtitle, { color: C.text.muted || C.text.secondary }]}>
            {getSubtitle(followsSystem, isDark)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.segmentTrack,
          {
            backgroundColor: trackBg,
            borderColor: C.border.light,
          },
        ]}
        accessibilityRole="tablist"
      >
        <Pressable
          onPress={selectDark}
          accessibilityRole="tab"
          accessibilityState={{ selected: isDark }}
          accessibilityLabel="Dark theme"
          style={[
            styles.segmentBtn,
            isDark && { backgroundColor: activeBg },
          ]}
          hitSlop={4}
        >
          <MaterialIcons
            name="dark-mode"
            size={14}
            color={isDark ? activeText : idleText}
          />
          <Text
            style={[
              styles.segmentLabel,
              { color: isDark ? activeText : idleText },
              isDark && styles.segmentLabelActive,
            ]}
          >
            Dark
          </Text>
        </Pressable>

        <Pressable
          onPress={selectLight}
          accessibilityRole="tab"
          accessibilityState={{ selected: !isDark }}
          accessibilityLabel="Light theme"
          style={[
            styles.segmentBtn,
            !isDark && { backgroundColor: activeBg },
          ]}
          hitSlop={4}
        >
          <MaterialIcons
            name="light-mode"
            size={14}
            color={!isDark ? activeText : idleText}
          />
          <Text
            style={[
              styles.segmentLabel,
              { color: !isDark ? activeText : idleText },
              !isDark && styles.segmentLabelActive,
            ]}
          >
            Light
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 3,
    borderWidth: 1,
    gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    minWidth: 68,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentLabelActive: {
    fontWeight: '800',
  },
});
