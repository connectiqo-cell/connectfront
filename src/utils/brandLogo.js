/**
 * Brand mark asset used across in-app UI.
 * App icons are generated from the same file (see scripts/generate-*-icons.js).
 */
export const BRAND_LOGO = require('../assets/images/connectiqo_logo.png');

/** @deprecated Prefer BRAND_LOGO — kept for existing call sites. */
export const DARK_BRAND_LOGO = BRAND_LOGO;
/** @deprecated Prefer BRAND_LOGO — kept for existing call sites. */
export const LIGHT_BRAND_LOGO = BRAND_LOGO;

/** @param {boolean} [_isDark] theme flag (logo is theme-agnostic) */
export function getBrandLogo(_isDark) {
  return BRAND_LOGO;
}
