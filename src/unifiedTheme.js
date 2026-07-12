/**
 * Unified Theme System — cosmic / galaxy aesthetic
 * Deep space palette, nebula gradients, stellar accents
 */

import { Platform } from 'react-native';
import {
  scaleUi,
  scaleSpacingMap,
  scaleRadiusMap,
  scaleTypographyStyle,
} from './utils/iosUiScale';

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

const BASE_TAB_BAR = {
  outerRadius: 26,
  glassGradient: ['#0f0e2a', '#161432', '#12102a'],
  glassBorder: 'rgba(167, 139, 250, 0.22)',
  activeIndicatorGradient: ['#f0d875', '#5eead4'],
  activePillGradient: [
    'rgba(167, 139, 250, 0.28)',
    'rgba(94, 234, 212, 0.18)',
    'rgba(240, 216, 117, 0.1)',
  ],
  iconRingGradient: [
    'rgba(167, 139, 250, 0.55)',
    'rgba(240, 216, 117, 0.45)',
    'rgba(94, 234, 212, 0.35)',
  ],
  rimBorder: 'rgba(167, 139, 250, 0.22)',
  labelShadow: 'rgba(240, 216, 117, 0.35)',
  iconSize: 23,
  iconSizeFocused: 25,
  floating: {
    horizontalInset: 16,
    bottomGap: 12,
    barMinHeight: 64,
    contentReserve: 115,
  },
  uploadFabSize: 52,
  uploadFabLift: 22,
  flatBarBase: '#161432',
  flatBarEdge: [
    'rgba(167, 139, 250, 0.4)',
    'rgba(94, 234, 212, 0.3)',
    'rgba(240, 216, 117, 0.22)',
    'rgba(167, 139, 250, 0.18)',
  ],
  topNavActiveWash: [
    'rgba(124, 58, 237, 0.14)',
    'rgba(94, 234, 212, 0.1)',
    'rgba(236, 72, 153, 0.06)',
  ],
  topNavIconRing: [
    'rgba(240, 216, 117, 0.35)',
    'rgba(94, 234, 212, 0.2)',
    'rgba(167, 139, 250, 0.25)',
  ],
};

function buildTabBar() {
  if (Platform.OS !== 'ios') {
    return BASE_TAB_BAR;
  }
  return {
    ...BASE_TAB_BAR,
    outerRadius: scaleUi(BASE_TAB_BAR.outerRadius),
    iconSize: scaleUi(BASE_TAB_BAR.iconSize),
    iconSizeFocused: scaleUi(BASE_TAB_BAR.iconSizeFocused),
    uploadFabSize: scaleUi(BASE_TAB_BAR.uploadFabSize),
    uploadFabLift: scaleUi(BASE_TAB_BAR.uploadFabLift),
    floating: {
      horizontalInset: scaleUi(BASE_TAB_BAR.floating.horizontalInset),
      bottomGap: scaleUi(BASE_TAB_BAR.floating.bottomGap),
      barMinHeight: scaleUi(BASE_TAB_BAR.floating.barMinHeight),
      contentReserve: scaleUi(BASE_TAB_BAR.floating.contentReserve),
    },
  };
}

export const UNIFIED_THEME = {
  colors: {
    primary: {
      void: '#000008',
      dark: '#02010c',
      light: '#050514',
      nebula: '#0a0518',
      gradient: ['#000008', '#040210', '#08061c', '#041020', '#020208'],
    },

    cosmic: {
      nebulaHaze: [
        'rgba(124, 58, 237, 0.14)',
        'rgba(14, 165, 233, 0.07)',
        'rgba(236, 72, 153, 0.04)',
        'rgba(124, 58, 237, 0.1)',
      ],
      nebulaLocations: [0, 0.35, 0.62, 1],
      /** Same stops as CosmicBackground + bottom tab sky */
      mainGradientLocations: [0, 0.28, 0.52, 0.78, 1],
      hazeOpacity: 0.72,
    },

    /** Bottom tab bar — solid panel strip + gold/teal accents */
    tabBar: buildTabBar(),

    accent: {
      primary: '#f0d875',
      secondary: '#5eead4',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#38bdf8',
    },

    text: {
      primary: '#f0f0fc',
      secondary: '#b8b8d4',
      muted: '#8888a8',
      disabled: '#545470',
      onAccent: '#060412',
    },

    component: {
      card: 'rgba(255, 255, 255, 0.04)',
      input: 'rgba(255, 255, 255, 0.032)',
      /** @deprecated prefer colors.buttons — kept for legacy backgroundColor overrides */
      button: '#7c3aed',
      buttonSecondary: 'rgba(167, 139, 250, 0.18)',
      overlay: 'rgba(0, 0, 6, 0.92)',
      disabled: 'rgba(255, 255, 255, 0.04)',
    },

    /** Cosmic button variants — use with <Button variant="primary" /> */
    buttons: {
      primaryGradient: ['#f0d875', '#5eead4'],
      primaryText: '#060412',
      primaryBorder: 'rgba(240, 216, 117, 0.35)',
      primaryShadow: 'rgba(94, 234, 212, 0.35)',

      secondaryBg: 'rgba(167, 139, 250, 0.18)',
      secondaryText: '#c4b5fd',
      secondaryBorder: 'rgba(167, 139, 250, 0.28)',
      secondaryPressed: 'rgba(124, 58, 237, 0.28)',

      outlineText: '#5eead4',
      outlineBorder: 'rgba(94, 234, 212, 0.45)',
      outlinePressedBg: 'rgba(94, 234, 212, 0.1)',

      successGradient: ['#34d399', '#5eead4'],
      successText: '#060412',
      successBorder: 'rgba(52, 211, 153, 0.35)',

      dangerBg: 'rgba(248, 113, 113, 0.15)',
      dangerText: '#fca5a5',
      dangerBorder: 'rgba(248, 113, 113, 0.4)',
      dangerSolid: '#ef4444',
      dangerSolidText: '#ffffff',

      nebulaGradient: ['#a78bfa', '#5eead4'],
      nebulaText: '#060412',
      nebulaBorder: 'rgba(167, 139, 250, 0.4)',

      premiumGradient: ['#7c3aed', '#f0d875'],
      premiumText: '#f0f0fc',
      premiumBorder: 'rgba(240, 216, 117, 0.35)',

      infoGradient: ['#38bdf8', '#5eead4'],
      infoText: '#060412',
      infoBorder: 'rgba(56, 189, 248, 0.4)',

      warningBg: 'rgba(251, 191, 36, 0.15)',
      warningText: '#fcd34d',
      warningBorder: 'rgba(251, 191, 36, 0.4)',
      warningGradient: ['#fbbf24', '#f0d875'],
      warningGradientText: '#060412',

      goldOutlineText: '#f0d875',
      goldOutlineBorder: 'rgba(240, 216, 117, 0.4)',
      goldOutlinePressedBg: 'rgba(240, 216, 117, 0.08)',

      disabledText: '#545470',
      disabledBorder: 'rgba(167, 139, 250, 0.12)',
    },

    /** Reusable translucent surfaces (cards, chips, section accents) */
    surface: {
      /** Solid panels used across settings, bookings, videos, etc. */
      panel: '#161432',
      sheet: '#0f0e2a',
      chip: 'rgba(255, 255, 255, 0.05)',
      chipStrong: 'rgba(255, 255, 255, 0.06)',
      heroGradient: [
        'rgba(124, 58, 237, 0.35)',
        'rgba(94, 234, 212, 0.15)',
        'rgba(0, 0, 8, 0.85)',
      ],
      previewGradient: ['rgba(124, 58, 237, 0.2)', 'rgba(94, 234, 212, 0.08)'],
      checkoutBar: 'rgba(0, 0, 8, 0.98)',
      accentGold: 'rgba(240, 216, 117, 0.12)',
      accentTeal: 'rgba(94, 234, 212, 0.1)',
      accentViolet: 'rgba(167, 139, 250, 0.12)',
      accentSuccess: 'rgba(52, 211, 153, 0.15)',
      accentWarning: 'rgba(251, 191, 36, 0.12)',
      dayAvailableBorder: 'rgba(94, 234, 212, 0.25)',
      slotDot: 'rgba(94, 234, 212, 0.2)',
      slotDotSelected: 'rgba(6, 4, 18, 0.35)',
      promptChip: 'rgba(240, 216, 117, 0.1)',
    },

    /**
     * Legacy meeting UI scale — maps old colors.primary[n] to cosmic tokens.
     * Prefer UNIFIED_THEME.colors directly in new code.
     */
    meeting: {
      100: '#f0f0fc',
      200: '#b8b8d4',
      400: '#8888a8',
      500: '#545470',
      600: 'rgba(255, 255, 255, 0.04)',
      700: 'rgba(255, 255, 255, 0.032)',
      800: '#02010c',
      900: '#000008',
      accent: '#a78bfa',
    },

    border: {
      light: 'rgba(167, 139, 250, 0.22)',
      default: 'rgba(94, 234, 212, 0.28)',
      strong: 'rgba(240, 216, 117, 0.45)',
      accent: '#5eead4',
    },

    status: {
      pending: '#fbbf24',
      approved: '#34d399',
      rejected: '#f87171',
      active: '#34d399',
      inactive: '#6b7280',
      available: '#34d399',
      unavailable: '#f87171',
    },
  },

  spacing: scaleSpacingMap(BASE_SPACING),

  borderRadius: scaleRadiusMap(BASE_BORDER_RADIUS),

  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    small: {
      shadowColor: 'rgba(167, 139, 250, 0.45)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    },
    medium: {
      shadowColor: 'rgba(94, 234, 212, 0.35)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
    large: {
      shadowColor: 'rgba(124, 58, 237, 0.55)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 18,
      elevation: 12,
    },
    glow: {
      shadowColor: '#c4b5fd',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.75,
      shadowRadius: 22,
      elevation: 12,
    },
  },

  typography: buildTypography(),
};

export default UNIFIED_THEME;
