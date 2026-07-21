/**
 * Unified Theme System — cosmic / galaxy aesthetic
 * Supports dark + light via buildTheme(mode). Use useTheme() in components.
 */

import { Platform } from 'react-native';
import {
  scaleUi,
  scaleSpacingMap,
  scaleRadiusMap,
  scaleTypographyStyle,
} from './utils/iosUiScale';
import {
  DARK_COLORS,
  LIGHT_COLORS,
  DARK_SHADOWS,
  LIGHT_SHADOWS,
} from './theme/colorSchemes';

export const THEME_MODES = Object.freeze({
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system',
});

export const THEME_STORAGE_KEY = '@connectiqo/theme_mode';

const BASE_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const BASE_BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  chip: 10,
  round: 50,
};

const BASE_TYPOGRAPHY = {
  headingXL: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  headingLg: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  headingMd: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  headingSm: { fontSize: 20, fontWeight: '700', lineHeight: 28 },
  headingXs: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  bodyLg: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodyMd: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  bodySm: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  bodyXs: { fontSize: 11, fontWeight: '400', lineHeight: 14 },
  labelLg: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  labelMd: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  labelSm: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
};

function buildTypography() {
  if (Platform.OS !== 'ios') {
    return BASE_TYPOGRAPHY;
  }
  return Object.fromEntries(
    Object.entries(BASE_TYPOGRAPHY).map(([key, style]) => [
      key,
      scaleTypographyStyle(style),
    ]),
  );
}

function buildTabBar(tabBarBase) {
  if (Platform.OS !== 'ios') {
    return tabBarBase;
  }
  return {
    ...tabBarBase,
    outerRadius: scaleUi(tabBarBase.outerRadius),
    iconSize: scaleUi(tabBarBase.iconSize),
    iconSizeFocused: scaleUi(tabBarBase.iconSizeFocused),
    uploadFabSize: scaleUi(tabBarBase.uploadFabSize),
    uploadFabLift: scaleUi(tabBarBase.uploadFabLift),
    floating: {
      horizontalInset: scaleUi(tabBarBase.floating.horizontalInset),
      bottomGap: scaleUi(tabBarBase.floating.bottomGap),
      barMinHeight: scaleUi(tabBarBase.floating.barMinHeight),
      contentReserve: scaleUi(tabBarBase.floating.contentReserve),
    },
  };
}

/**
 * Deep clone plain objects/arrays so a built theme never shares nested
 * references with the source DARK_COLORS / LIGHT_COLORS constants. Without
 * this, syncUnifiedTheme's deep-assign would mutate the shared palette in
 * place and cross-contaminate dark/light tokens on the next mode switch.
 */
function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = deepClone(value[key]);
    });
    return out;
  }
  return value;
}

function resolveColorScheme(mode) {
  return deepClone(mode === THEME_MODES.LIGHT ? LIGHT_COLORS : DARK_COLORS);
}

function resolveShadows(mode) {
  return deepClone(mode === THEME_MODES.LIGHT ? LIGHT_SHADOWS : DARK_SHADOWS);
}

/** Build a full theme object for dark or light mode. */
export function buildTheme(mode = THEME_MODES.DARK) {
  const scheme = resolveColorScheme(mode);
  const { tabBarBase, ...colors } = scheme;

  return {
    mode,
    colors: {
      ...colors,
      tabBar: buildTabBar(tabBarBase),
    },
    spacing: scaleSpacingMap(BASE_SPACING),
    borderRadius: scaleRadiusMap(BASE_BORDER_RADIUS),
    shadows: resolveShadows(mode),
    typography: buildTypography(),
  };
}

/**
 * Default light theme — kept for legacy imports.
 * Prefer useTheme() so screens react to light/dark changes.
 * ThemeProvider also syncs this object when mode changes so
 * runtime reads of UNIFIED_THEME.colors pick up light/dark tokens.
 * Legacy module-level StyleSheet.create calls are evaluated before
 * ThemeProvider resolves AsyncStorage/system mode, so default to the
 * light palette to keep non-migrated headings readable in light UI.
 */
export const UNIFIED_THEME = buildTheme(THEME_MODES.LIGHT);

/** Deep-assign active theme into UNIFIED_THEME (same object identity). */
export function syncUnifiedTheme(nextTheme) {
  if (!nextTheme || nextTheme === UNIFIED_THEME) return UNIFIED_THEME;
  UNIFIED_THEME.mode = nextTheme.mode;

  const deepAssign = (target, source) => {
    if (!source || typeof source !== 'object') return;
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        deepAssign(target[key], value);
      } else {
        target[key] = value;
      }
    });
  };

  deepAssign(UNIFIED_THEME.colors, nextTheme.colors);
  deepAssign(UNIFIED_THEME.shadows, nextTheme.shadows);
  return UNIFIED_THEME;
}

export default UNIFIED_THEME;
