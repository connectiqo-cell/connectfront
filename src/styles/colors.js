/**
 * @deprecated Prefer theme.colors.meeting via useTheme() in new code.
 * Kept for meeting module compatibility — values follow live UNIFIED_THEME
 * so light/dark meeting chrome updates when ThemeProvider syncs.
 */
import { UNIFIED_THEME } from '../unifiedTheme';

function meeting() {
  return UNIFIED_THEME.colors.meeting;
}

const colors = {
  primary: {
    get 100() {
      return meeting()[100];
    },
    get 200() {
      return meeting()[200];
    },
    get 400() {
      return meeting()[400];
    },
    get 500() {
      return meeting()[500];
    },
    get 600() {
      return meeting()[600];
    },
    get 700() {
      return meeting()[700];
    },
    get 800() {
      return meeting()[800];
    },
    get 900() {
      return meeting()[900];
    },
  },
  /** Call shell / root canvas (light in light theme). */
  get black() {
    return meeting()[900];
  },
  get purple() {
    return meeting().accent;
  },
  /** Sheet / control border tone. */
  get sheet() {
    return meeting().sheet;
  },
  /** Ink on muted mic/cam pill. */
  get ink() {
    return meeting().ink;
  },
};

export default colors;
