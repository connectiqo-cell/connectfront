/**
 * Light/dark surface helpers for cosmic glass chrome.
 * Prefer these over hardcoded rgba(255,255,255,*) fills that vanish on lavender.
 */

export function isLightMode(theme) {
  return theme?.mode === 'light';
}

/** Soft panel / badge fill (chips, status pills, secondary wells). */
export function softFill(theme) {
  const C = theme.colors;
  return isLightMode(theme) ? C.surface.chip : 'rgba(255,255,255,0.06)';
}

/** Slightly stronger fill (skeletons, pressed wells, image-card chrome). */
export function softFillStrong(theme) {
  const C = theme.colors;
  return isLightMode(theme) ? C.surface.chipStrong : 'rgba(255,255,255,0.1)';
}

/** Card / search-field surface on the cosmic canvas. */
export function cardFill(theme) {
  const C = theme.colors;
  return isLightMode(theme) ? C.component.card : 'rgba(255,255,255,0.07)';
}

/** Hairline / soft border for glass panels. */
export function softBorder(theme) {
  const C = theme.colors;
  return isLightMode(theme) ? C.border.light : 'rgba(255,255,255,0.12)';
}

/** Stronger ring (avatar rings, focused fields). */
export function ringBorder(theme) {
  const C = theme.colors;
  return isLightMode(theme) ? C.border.default : 'rgba(255,255,255,0.35)';
}

/** Inner well behind circular avatars. */
export function avatarWell(theme) {
  return theme.colors.surface.sheet;
}

/** Gradient ring colors for profile avatars. */
export function avatarRingColors(theme) {
  if (isLightMode(theme)) {
    return ['rgba(109,74,255,0.9)', 'rgba(139,92,246,0.55)', 'rgba(99,102,241,0.45)'];
  }
  return ['rgba(167,139,250,0.95)', 'rgba(255,255,255,0.55)', 'rgba(94,234,212,0.5)'];
}

/**
 * Mode-agnostic purple glass for module-level StyleSheet.create
 * (cannot read live theme). Readable on both lavender and dark canvases.
 */
export const STATIC_SOFT_FILL = 'rgba(109, 74, 255, 0.08)';
export const STATIC_SOFT_FILL_STRONG = 'rgba(109, 74, 255, 0.12)';
export const STATIC_SOFT_BORDER = 'rgba(109, 74, 255, 0.14)';
