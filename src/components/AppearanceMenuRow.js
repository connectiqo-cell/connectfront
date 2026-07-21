import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../hooks/useTheme';
import { THEME_MODES } from '../unifiedTheme';

function getSubtitle(followsSystem, isDark) {
  if (followsSystem) {
    return `System · ${isDark ? 'Dark' : 'Light'}`;
  }
  return isDark ? 'Dark theme' : 'Light theme';
}

/**
 * Switch toggles dark / light (overrides system).
 * Long-press resets to system default.
 */
export default function AppearanceMenuRow({ noBorder = false }) {
  const { theme, isDark, followsSystem, setThemePreference, resetToSystemTheme } = useTheme();
  const C = theme.colors;

  const onToggle = (value) => {
    setThemePreference(value ? THEME_MODES.LIGHT : THEME_MODES.DARK);
  };

  return (
    <Pressable
      onPress={() => onToggle(!isDark)}
      onLongPress={resetToSystemTheme}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: C.surface.panel,
          borderBottomColor: noBorder ? 'transparent' : C.border.light,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: C.surface.accentTeal }]}>
          <MaterialIcons
            name={isDark ? 'dark-mode' : 'light-mode'}
            size={20}
            color={C.accent.secondary}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: C.text.primary }]}>Appearance</Text>
          <Text style={[styles.subtitle, { color: C.text.secondary }]}>
            {getSubtitle(followsSystem, isDark)}
          </Text>
        </View>
      </View>
      <Switch
        value={!isDark}
        onValueChange={onToggle}
        trackColor={{
          false: C.surface.chipStrong,
          true: C.accent.secondary,
        }}
        thumbColor={isDark ? C.text.muted : '#ffffff'}
        ios_backgroundColor={C.surface.chipStrong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
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
});
