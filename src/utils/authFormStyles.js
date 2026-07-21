import { UNIFIED_THEME as T } from '../unifiedTheme';
import { createFormFieldStyles } from './platformLayout';

/** Theme-aware auth input chrome (Login / Signup). */
export function createAuthFormStyles(theme) {
  const C = theme.colors;
  const S = C.surface;
  const base = createFormFieldStyles({
    chipBg: S.chip,
    borderColor: C.border.light,
    textColor: C.text.primary,
  });
  return {
    ...base,
    inputError: {
      borderColor: C.accent.error,
    },
  };
}

/** @deprecated Prefer createAuthFormStyles(theme) — frozen at module load. */
const C = T.colors;
const S = C.surface;
const base = createFormFieldStyles({
  chipBg: S.chip,
  borderColor: C.border.light,
  textColor: C.text.primary,
});

export const AUTH_FORM_STYLES = {
  ...base,
  inputError: {
    borderColor: C.accent.error,
  },
};
