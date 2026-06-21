import { Platform } from 'react-native';
import { UNIFIED_THEME as T } from '../unifiedTheme';

/**
 * Content padding below the status bar when SafeScreen includeTopInset is true.
 * Stack overlays use StackScreenHeader for the top inset instead.
 */
export function getScreenContentTopPadding(padding = 0, insets, includeTopInset = true) {
  return padding + (includeTopInset ? insets.top : 0);
}

/** Top padding for stack overlay app bars (card presentation — edge-to-edge on iOS). */
export function getStackHeaderTopPadding(insets, extra = 0) {
  return insets.top + extra;
}

/** Full top offset when a screen manages its own status-bar inset (no SafeScreen top inset). */
export function getManualTopPadding(insets, padding = 0) {
  return padding + insets.top;
}

/** Shared iOS/Android layout tokens for forms, buttons, and flex rows. */
export const PLATFORM_LAYOUT = {
  formFieldMinHeight: Platform.OS === 'ios' ? 52 : 50,
  formIconSlotWidth: 22,
  formInputPaddingVertical: Platform.OS === 'ios' ? 2 : 0,
  formInputLineHeight: Platform.OS === 'ios' ? 20 : undefined,
  buttonMinHeight: Platform.OS === 'ios' ? 52 : 50,
  buttonCompactMinHeight: Platform.OS === 'ios' ? 42 : 40,
};

/** Flex child in a horizontal row — prevents iOS overflow/squash. */
export function iosFlexChild(extra = {}) {
  return Platform.OS === 'ios'
    ? { flex: 1, flexBasis: 0, minWidth: 0, ...extra }
    : { flex: 1, minWidth: 0, ...extra };
}

/** Wrap centered content inside LinearGradient so labels render on iOS. */
export const iosGradientInner = Platform.select({
  ios: {
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  default: {},
});

/** Left-aligned text block inside LinearGradient on iOS. */
export const iosGradientTextBlock = Platform.select({
  ios: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  default: {},
});

/** Circular clip wrapper for profile photos on iOS. */
export function iosAvatarClip(size, extra = {}) {
  const radius = size / 2;
  return Platform.OS === 'ios'
    ? {
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        backgroundColor: '#0f0e2a',
        ...extra,
      }
    : extra;
}

/** Full-bleed image inside a circular clip on iOS. */
export function iosAvatarImageStyle(size) {
  return {
    width: size,
    height: size,
  };
}

/** Auth / settings text fields — use with local chip/surface colors. */
export function createFormFieldStyles({ chipBg, borderColor, textColor }) {
  return {
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: chipBg,
      borderColor,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: T.spacing.md,
      marginBottom: T.spacing.lg,
      minHeight: PLATFORM_LAYOUT.formFieldMinHeight,
    },
    inputIcon: {
      marginRight: T.spacing.md,
      width: PLATFORM_LAYOUT.formIconSlotWidth,
      textAlign: 'center',
    },
    input: {
      flex: 1,
      color: textColor,
      ...T.typography.bodySm,
      padding: 0,
      paddingVertical: PLATFORM_LAYOUT.formInputPaddingVertical,
      lineHeight: PLATFORM_LAYOUT.formInputLineHeight,
    },
    eyeIcon: {
      padding: T.spacing.sm,
    },
    fullWidthButton: {
      width: '100%',
      alignSelf: 'stretch',
    },
  };
}
