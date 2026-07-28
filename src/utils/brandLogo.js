/**
 * Brand mark assets — pick by theme for in-app UI.
 * App icons always use dark_logo (see scripts/generate-*-icons.js).
 */
export const DARK_BRAND_LOGO = require('../assets/images/dark_logo.png');
export const LIGHT_BRAND_LOGO = require('../assets/images/light_logo.png');

/** @param {boolean} isDark */
export function getBrandLogo(isDark) {
  return isDark ? DARK_BRAND_LOGO : LIGHT_BRAND_LOGO;
}
