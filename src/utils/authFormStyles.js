import { UNIFIED_THEME as T } from '../unifiedTheme';
import { createFormFieldStyles } from './platformLayout';

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
