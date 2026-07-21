import { useContext, useMemo } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import { UNIFIED_THEME, THEME_MODES } from '../unifiedTheme';

/** factory → Map(mode → StyleSheet) — shared across all component instances */
const themedStyleCache = new WeakMap();

function getCachedStyles(factory, theme, mode) {
  if (typeof factory !== 'function') {
    return {};
  }
  const cacheKey = mode || theme?.mode || THEME_MODES.DARK;
  let byMode = themedStyleCache.get(factory);
  if (!byMode) {
    byMode = new Map();
    themedStyleCache.set(factory, byMode);
  }
  let styles = byMode.get(cacheKey);
  if (!styles) {
    styles = factory(theme) || {};
    byMode.set(cacheKey, styles);
  }
  return styles;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    const fallbackIsDark = UNIFIED_THEME.mode === THEME_MODES.DARK;
    return {
      theme: UNIFIED_THEME,
      mode: UNIFIED_THEME.mode,
      preference: THEME_MODES.SYSTEM,
      isDark: fallbackIsDark,
      followsSystem: true,
      ready: true,
      setThemePreference: () => {},
      toggleTheme: () => {},
      resetToSystemTheme: () => {},
    };
  }
  return context;
}

/**
 * Theme-aware styles.
 * Pass a factory that returns StyleSheet.create({ ... }) using the theme.
 * Do not wrap again — double StyleSheet.create breaks style props.
 *
 * Styles are cached globally per (factory, mode) so list rows and helpers
 * share one StyleSheet instead of rebuilding one per mounted instance.
 *
 * @example
 * const styles = useThemedStyles((T) =>
 *   StyleSheet.create({ title: { color: T.colors.text.primary } }),
 * );
 */
export function useThemedStyles(factory) {
  const { theme, mode } = useTheme();
  return useMemo(
    () => getCachedStyles(factory, theme, mode),
    [factory, theme, mode],
  );
}
