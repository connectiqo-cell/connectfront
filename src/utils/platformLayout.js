import { Platform } from 'react-native';
import { UNIFIED_THEME as T } from '../unifiedTheme';
import { scaleUi } from './iosUiScale';

export { scaleUi, IOS_UI_SCALE } from './iosUiScale';

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

/**
 * Stack overlay screens (Settings, Booking, etc.) — iOS uses SafeScreen without top inset
 * and StackScreenHeader for a single status-bar offset; Android keeps SafeScreen top inset.
 */
export const STACK_OVERLAY_LAYOUT = {
  safeScreenIncludeTopInset: Platform.OS !== 'ios',
  headerInsetTop: Platform.OS === 'ios',
};

/**
 * Bottom-tab Home screen — edge-to-edge content; SafeScreen applies safe-area insets only.
 */
export const HOME_TAB_LAYOUT = {
  safeScreenPadding: 0,
  scrollPaddingTop: () => 0,
};

/** Shared iOS/Android layout tokens for forms, buttons, and flex rows. */
export const PLATFORM_LAYOUT = {
  formFieldMinHeight: Platform.OS === 'ios' ? scaleUi(52) : 50,
  formIconSlotWidth: Platform.OS === 'ios' ? scaleUi(24) : 22,
  formInputPaddingVertical: 0,
  buttonMinHeight: Platform.OS === 'ios' ? scaleUi(52) : 50,
  buttonCompactMinHeight: Platform.OS === 'ios' ? scaleUi(42) : 40,
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
  const isIos = Platform.OS === 'ios';

  return {
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: chipBg,
      borderColor,
      borderWidth: 1,
      borderRadius: isIos ? scaleUi(12) : 12,
      paddingHorizontal: T.spacing.md,
      marginBottom: T.spacing.lg,
      minHeight: PLATFORM_LAYOUT.formFieldMinHeight,
    },
    inputIconSlot: {
      width: PLATFORM_LAYOUT.formIconSlotWidth,
      height: PLATFORM_LAYOUT.formIconSlotWidth,
      marginRight: T.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    inputIcon: {
      textAlign: 'center',
    },
    input: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'stretch',
      color: textColor,
      fontSize: isIos ? T.typography.bodyMd.fontSize : T.typography.bodySm.fontSize,
      fontWeight: T.typography.bodySm.fontWeight,
      padding: 0,
      margin: 0,
      backgroundColor: 'transparent',
      ...(isIos
        ? {
            paddingVertical: 0,
          }
        : {
            paddingVertical: PLATFORM_LAYOUT.formInputPaddingVertical,
            textAlignVertical: 'center',
            includeFontPadding: false,
          }),
    },
    eyeIcon: {
      padding: T.spacing.sm,
      alignSelf: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    fullWidthButton: {
      width: '100%',
      alignSelf: 'stretch',
    },
  };
}
