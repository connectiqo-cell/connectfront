import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildTheme,
  THEME_MODES,
  THEME_STORAGE_KEY,
  syncUnifiedTheme,
} from '../unifiedTheme';

export const ThemeContext = createContext(null);

function resolveMode(preference, systemScheme) {
  if (preference === THEME_MODES.SYSTEM) {
    return systemScheme === 'light' ? THEME_MODES.LIGHT : THEME_MODES.DARK;
  }
  return preference === THEME_MODES.LIGHT ? THEME_MODES.LIGHT : THEME_MODES.DARK;
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState(THEME_MODES.SYSTEM);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (
          stored === THEME_MODES.DARK ||
          stored === THEME_MODES.LIGHT ||
          stored === THEME_MODES.SYSTEM
        ) {
          setPreference(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mode = useMemo(
    () => resolveMode(preference, systemScheme),
    [preference, systemScheme],
  );

  const theme = useMemo(() => {
    const next = buildTheme(mode);
    syncUnifiedTheme(next);
    return next;
  }, [mode]);
  const isDark = mode === THEME_MODES.DARK;
  const followsSystem = preference === THEME_MODES.SYSTEM;

  const setThemePreference = useCallback(async (next) => {
    const value =
      next === THEME_MODES.LIGHT
        ? THEME_MODES.LIGHT
        : next === THEME_MODES.SYSTEM
          ? THEME_MODES.SYSTEM
          : THEME_MODES.DARK;
    setPreference(value);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Non-fatal — preference still applies for this session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference(isDark ? THEME_MODES.LIGHT : THEME_MODES.DARK);
  }, [isDark, setThemePreference]);

  const resetToSystemTheme = useCallback(() => {
    setThemePreference(THEME_MODES.SYSTEM);
  }, [setThemePreference]);

  const value = useMemo(
    () => ({
      theme,
      mode,
      preference,
      isDark,
      followsSystem,
      ready,
      setThemePreference,
      toggleTheme,
      resetToSystemTheme,
    }),
    [
      theme,
      mode,
      preference,
      isDark,
      followsSystem,
      ready,
      setThemePreference,
      toggleTheme,
      resetToSystemTheme,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export { THEME_MODES, THEME_STORAGE_KEY };
