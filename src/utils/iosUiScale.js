import { Platform, PixelRatio } from 'react-native';

/** iOS-only scale — SF Pro reads smaller than Android Roboto at the same pt/sp. */
export const IOS_UI_SCALE = 1.14;

/** Scale layout values on iOS only; Android values are unchanged. */
export function scaleUi(value) {
  if (Platform.OS !== 'ios' || typeof value !== 'number') {
    return value;
  }
  return PixelRatio.roundToNearestPixel(value * IOS_UI_SCALE);
}

/** Scale a typography token on iOS only. */
export function scaleTypographyStyle(style) {
  if (Platform.OS !== 'ios' || !style) {
    return style;
  }
  return {
    ...style,
    fontSize: scaleUi(style.fontSize),
    lineHeight: style.lineHeight != null ? scaleUi(style.lineHeight) : undefined,
  };
}

/** Scale a spacing map on iOS only. */
export function scaleSpacingMap(spacing) {
  if (Platform.OS !== 'ios') {
    return spacing;
  }
  return Object.fromEntries(
    Object.entries(spacing).map(([key, value]) => [key, scaleUi(value)]),
  );
}

/** Scale a border-radius map on iOS only. */
export function scaleRadiusMap(radius) {
  if (Platform.OS !== 'ios') {
    return radius;
  }
  return Object.fromEntries(
    Object.entries(radius).map(([key, value]) => [
      key,
      value === 50 ? 50 : scaleUi(value),
    ]),
  );
}
