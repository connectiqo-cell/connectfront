/**
 * @deprecated Prefer theme.colors.meeting via useTheme() in new code.
 * Kept for meeting module compatibility — values follow live UNIFIED_THEME
 * so light/dark meeting chrome updates when ThemeProvider syncs.
 */
import { UNIFIED_THEME } from '../unifiedTheme';

function meeting() {
  return UNIFIED_THEME.colors.meeting;
}

function buttons() {
  return UNIFIED_THEME.colors.buttons;
}

function accent() {
  return UNIFIED_THEME.colors.accent;
}

function status() {
  return UNIFIED_THEME.colors.status;
}

function text() {
  return UNIFIED_THEME.colors.text;
}

function component() {
  return UNIFIED_THEME.colors.component;
}

function border() {
  return UNIFIED_THEME.colors.border;
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
  /** Bottom sheet / menu panel surface. */
  get sheet() {
    return meeting().sheet;
  },
  /** Mic/cam/chat control outline on call chrome. */
  get controlBorder() {
    return meeting().controlBorder || meeting().sheet;
  },
  /** Ink on muted mic/cam pill. */
  get ink() {
    return meeting().ink;
  },
  /** Brand / primary action (chat badge, dividers). */
  get brand() {
    return component().button;
  },
  /** Text on brand-colored pills and primary buttons. */
  get onBrand() {
    return text().onAccent;
  },
  get dangerSolid() {
    return buttons().dangerSolid;
  },
  get dangerBg() {
    return buttons().dangerBg;
  },
  get dangerText() {
    return buttons().dangerText;
  },
  get dangerSolidText() {
    return buttons().dangerSolidText;
  },
  get statusActive() {
    return status().active;
  },
  get borderLight() {
    return border().light;
  },
  get overlay() {
    return component().overlay;
  },
  /** Text/icons on call chrome (light canvas), not on video tiles. */
  get chromeInk() {
    return meeting()[100];
  },
  get chromeMuted() {
    return meeting()[400];
  },
  /** Labels on dark video tiles — canvas stays dark in both themes. */
  get onVideo() {
    return '#ffffff';
  },
  get onVideoMuted() {
    return 'rgba(255, 255, 255, 0.55)';
  },
  get onVideoShadow() {
    return 'rgba(0, 0, 0, 0.8)';
  },
};

export default colors;
