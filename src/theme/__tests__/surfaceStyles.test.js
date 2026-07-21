import {
  softFill,
  softFillStrong,
  softBorder,
  cardFill,
  avatarWell,
  avatarRingColors,
  STATIC_SOFT_FILL,
} from '../surfaceStyles';
import { buildTheme, THEME_MODES } from '../../unifiedTheme';

describe('surfaceStyles', () => {
  const light = buildTheme(THEME_MODES.LIGHT);
  const dark = buildTheme(THEME_MODES.DARK);

  it('uses chip / panel tokens in light mode', () => {
    expect(softFill(light)).toBe(light.colors.surface.chip);
    expect(softFillStrong(light)).toBe(light.colors.surface.chipStrong);
    expect(cardFill(light)).toBe(light.colors.component.card);
    expect(softBorder(light)).toBe(light.colors.border.light);
    expect(avatarWell(light)).toBe(light.colors.surface.sheet);
  });

  it('keeps translucent white glass in dark mode', () => {
    expect(softFill(dark)).toBe('rgba(255,255,255,0.06)');
    expect(softFillStrong(dark)).toBe('rgba(255,255,255,0.1)');
    expect(cardFill(dark)).toBe('rgba(255,255,255,0.07)');
  });

  it('uses purple avatar rings in light and gold/teal in dark', () => {
    expect(avatarRingColors(light)[0]).toContain('109,74,255');
    expect(avatarRingColors(dark)[0]).toContain('167,139,250');
  });

  it('exposes static purple glass for module-level StyleSheets', () => {
    expect(STATIC_SOFT_FILL).toContain('109, 74, 255');
  });
});
