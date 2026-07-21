import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

import { ThemeProvider } from '../../contexts/ThemeContext';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import CosmicButton from '../../components/CosmicButton';
import AppearanceMenuRow from '../../components/AppearanceMenuRow';

async function renderWithTheme(ui) {
  let tree;
  await act(async () => {
    tree = renderer.create(<ThemeProvider>{ui}</ThemeProvider>);
  });
  // Flush the async AsyncStorage preference load / setReady update.
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

describe('theme render smoke', () => {
  it('useThemedStyles keeps style props (no double StyleSheet.create)', async () => {
    let captured;
    // Named factory — shared cache keys off this reference.
    const createProbeStyles = (T) =>
      StyleSheet.create({
        box: { backgroundColor: T.colors.surface.panel, padding: 4 },
      });
    function Probe() {
      captured = useThemedStyles(createProbeStyles);
      return null;
    }
    await renderWithTheme(<Probe />);
    const resolved = StyleSheet.flatten(captured.box);
    // If styles were double-wrapped, these props would be undefined.
    expect(typeof resolved.backgroundColor).toBe('string');
    expect(resolved.backgroundColor).toMatch(/^#/);
    expect(resolved.padding).toBe(4);
  });

  it('useThemedStyles shares one stylesheet across instances', async () => {
    const createShared = (T) =>
      StyleSheet.create({
        row: { color: T.colors.text.primary },
      });
    const captures = [];
    function Probe() {
      captures.push(useThemedStyles(createShared));
      return null;
    }
    await renderWithTheme(
      <>
        <Probe />
        <Probe />
        <Probe />
      </>,
    );
    expect(captures.length).toBeGreaterThanOrEqual(3);
    // Same factory + mode must return the identical StyleSheet object.
    expect(captures.every((styles) => styles === captures[0])).toBe(true);
  });

  it('exposes theme + toggle from context', async () => {
    let ctx;
    function Probe() {
      ctx = useTheme();
      return null;
    }
    await renderWithTheme(<Probe />);
    expect(ctx.theme.colors).toBeDefined();
    expect(typeof ctx.setThemePreference).toBe('function');
    expect(typeof ctx.toggleTheme).toBe('function');
  });

  it('renders CosmicButton without throwing', async () => {
    await expect(
      renderWithTheme(<CosmicButton label="Book" onPress={() => {}} />),
    ).resolves.toBeDefined();
  });

  it('renders AppearanceMenuRow without throwing', async () => {
    await expect(
      renderWithTheme(<AppearanceMenuRow />),
    ).resolves.toBeDefined();
  });

  it('switches surface colors when preference changes', async () => {
    let ctx;
    function Probe() {
      ctx = useTheme();
      return <CosmicButton label="Toggle" onPress={() => {}} />;
    }
    await renderWithTheme(<Probe />);

    await act(async () => {
      await ctx.setThemePreference('dark');
    });
    expect(ctx.theme.colors.surface.panel).toBe('#161432');

    await act(async () => {
      ctx.setThemePreference('light');
    });
    expect(ctx.theme.colors.surface.panel).toBe('#ffffff');
  });
});
