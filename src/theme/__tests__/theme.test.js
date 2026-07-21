import { buildTheme, THEME_MODES, UNIFIED_THEME } from '../../unifiedTheme';
import { DARK_COLORS, LIGHT_COLORS } from '../colorSchemes';

describe('theme system', () => {
  it('exposes dark, light, and system modes', () => {
    expect(THEME_MODES.DARK).toBe('dark');
    expect(THEME_MODES.LIGHT).toBe('light');
    expect(THEME_MODES.SYSTEM).toBe('system');
  });

  it('buildTheme(dark) uses dark void background', () => {
    const theme = buildTheme(THEME_MODES.DARK);
    expect(theme.mode).toBe('dark');
    expect(theme.colors.primary.void).toBe(DARK_COLORS.primary.void);
    expect(theme.colors.text.primary).toBe(DARK_COLORS.text.primary);
  });

  it('buildTheme(light) uses light void background', () => {
    const theme = buildTheme(THEME_MODES.LIGHT);
    expect(theme.mode).toBe('light');
    expect(theme.colors.primary.void).toBe(LIGHT_COLORS.primary.void);
    expect(theme.colors.text.primary).toBe(LIGHT_COLORS.text.primary);
    expect(theme.colors.surface.panel).toBe('#ffffff');
    expect(theme.colors.component.card).toBe('#ffffff');
  });

  it('defaults legacy UNIFIED_THEME to readable light headings', () => {
    expect(UNIFIED_THEME.mode).toBe(THEME_MODES.LIGHT);
    expect(UNIFIED_THEME.colors.text.primary).toBe('#12102a');
    expect(UNIFIED_THEME.colors.primary.void).toBe('#f8f9ff');
  });

  it('keeps light body text dark enough for white cards', () => {
    const light = buildTheme(THEME_MODES.LIGHT);
    expect(light.colors.text.secondary).toBe('#4f4c6b');
    expect(light.colors.text.muted).toBe('#6f6c8a');
  });

  it('keeps dark gradient button accents on dark theme', () => {
    const dark = buildTheme(THEME_MODES.DARK);
    expect(dark.colors.buttons.primaryGradient).toEqual(['#f0d875', '#5eead4']);
  });

  it('uses purple brand accents for light cosmic theme', () => {
    const light = buildTheme(THEME_MODES.LIGHT);
    expect(light.colors.accent.primary).toBe('#6d4aff');
    expect(light.colors.accent.secondary).toBe('#7c3aed');
    expect(light.colors.primary.void).toBe('#f8f9ff');
    expect(light.colors.buttons.primaryGradient).toEqual(['#6d4aff', '#8b5cf6']);
    expect(light.colors.buttons.primaryText).toBe('#ffffff');
    expect(light.colors.surface.chip).toBe('#f0eeff');
    expect(light.colors.border.accent).toBe('#6d4aff');
  });

  it('inverts surfaces between dark and light', () => {
    const dark = buildTheme(THEME_MODES.DARK);
    const light = buildTheme(THEME_MODES.LIGHT);
    expect(dark.colors.surface.panel).toBe('#161432');
    expect(light.colors.surface.panel).toBe('#ffffff');
  });

  it('includes tabBar config for each mode', () => {
    const dark = buildTheme(THEME_MODES.DARK);
    const light = buildTheme(THEME_MODES.LIGHT);
    expect(dark.colors.tabBar.flatBarBase).toBe('#161432');
    expect(light.colors.tabBar.flatBarBase).toBe('#ffffff');
  });

  it('does not share nested references between built themes (no palette leak)', () => {
    // Building light must never mutate a subsequently built dark theme.
    const light = buildTheme(THEME_MODES.LIGHT);
    light.colors.surface.panel = '#deadbeef';
    const dark = buildTheme(THEME_MODES.DARK);
    expect(dark.colors.surface.panel).toBe('#161432');
    // And re-building light still yields the original light value.
    expect(buildTheme(THEME_MODES.LIGHT).colors.surface.panel).toBe('#ffffff');
  });

  it('uses light meeting chrome text and keeps video tiles dark', () => {
    const light = buildTheme(THEME_MODES.LIGHT);
    const dark = buildTheme(THEME_MODES.DARK);
    expect(light.colors.meeting[100]).toBe('#12102a');
    expect(light.colors.meeting[900]).toBe('#f8f9ff');
    expect(light.colors.meeting[800]).toBe('#02010c');
    expect(dark.colors.meeting[100]).toBe('#f0f0fc');
    expect(dark.colors.meeting[900]).toBe('#000008');
  });
});
