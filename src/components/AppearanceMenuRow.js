import { View, Text, Switch, Pressable, StyleSheet, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../hooks/useTheme';
import { THEME_MODES } from '../unifiedTheme';

/**
 * Light / Dark toggle in Settings.
 * Uses a native Switch so it stays visible on all screen sizes.
 */
export default function AppearanceMenuRow({ noBorder = false }) {
  const { theme, isDark, followsSystem, setThemePreference, resetToSystemTheme } = useTheme();
  const C = theme.colors;
  const isLight = !isDark;
  const TEAL = C.accent.secondary;
  const PURPLE = C.buttons?.nebulaGradient?.[0] || '#6d4aff';

  const onToggle = (value) => {
    // Switch ON = Light theme
    setThemePreference(value ? THEME_MODES.LIGHT : THEME_MODES.DARK);
  };

  const subtitle = followsSystem
    ? `System · ${isLight ? 'Light' : 'Dark'} · tap to override`
    : isLight
      ? 'Light · tap switch for Dark'
      : 'Dark · tap switch for Light';

  return (
    <Pressable
      onPress={() => onToggle(!isLight)}
      onLongPress={resetToSystemTheme}
      delayLongPress={450}
      accessibilityRole="switch"
      accessibilityState={{ checked: isLight }}
      accessibilityLabel="Appearance"
      accessibilityHint="Toggle light or dark theme. Long press to follow system theme."
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: noBorder ? 'transparent' : C.border.light,
          backgroundColor: pressed ? C.surface.accentViolet || 'transparent' : 'transparent',
        },
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: C.surface.accentTeal || 'rgba(94,234,212,0.15)',
              borderColor: C.border.light,
            },
          ]}
        >
          <MaterialIcons
            name={isLight ? 'wb-sunny' : 'nights-stay'}
            size={22}
            color={isLight ? PURPLE : TEAL}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: C.text.primary }]}>Appearance</Text>
          <Text style={[styles.subtitle, { color: C.text.muted || C.text.secondary }]}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Switch
        value={isLight}
        onValueChange={onToggle}
        trackColor={{
          false: Platform.OS === 'ios' ? 'rgba(120,120,128,0.32)' : C.surface.chipStrong || '#555',
          true: PURPLE,
        }}
        thumbColor={Platform.OS === 'ios' ? '#ffffff' : isLight ? '#ffffff' : '#f4f3f4'}
        ios_backgroundColor="rgba(120,120,128,0.32)"
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
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 12,
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
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
