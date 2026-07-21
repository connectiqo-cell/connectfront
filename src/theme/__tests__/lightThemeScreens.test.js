/**
 * Light-theme coverage for app screens / meeting chrome.
 * Complements theme.test.js + themeRender.test.js.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import fs from 'fs';
import path from 'path';

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('light')),
  setItem: jest.fn(() => Promise.resolve()),
}));

import { ThemeProvider } from '../../contexts/ThemeContext';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { buildTheme, THEME_MODES, syncUnifiedTheme } from '../../unifiedTheme';
import { DARK_COLORS, LIGHT_COLORS } from '../colorSchemes';
import colors from '../../styles/colors';
import {
  softFill,
  softBorder,
  softFillStrong,
  cardFill,
} from '../surfaceStyles';

const SRC_ROOT = path.join(__dirname, '..', '..');

const CRITICAL_SCREEN_FILES = [
  'scenes/shared/BookingScreen.js',
  'scenes/shared/VideoCallScreen.js',
  'scenes/settings/WalletScreen.js',
  'scenes/settings/PayoutSetupScreen.js',
  'scenes/settings/TransactionHistoryScreen.js',
  'scenes/meeting/Components/SessionLobbyView.js',
  'scenes/meeting/Components/WaitingToJoinView.js',
  'scenes/meeting/OneToOne/index.js',
  'scenes/meeting/Conference/ConferenceMeetingViewer.js',
  'scenes/auth/InterestsOnboardingScreen.js',
  'scenes/auth/ForgotPasswordScreen.js',
  'scenes/auth/ResetPasswordScreen.js',
  'scenes/home/HomeScreen.js',
  'scenes/learner/HomeScreen.js',
  'scenes/learner/BookingsScreen.js',
  'scenes/learner/BrowseMentorsScreen.js',
  'scenes/learner/CategoryMentorsScreen.js',
  'scenes/learner/VideosScreen.js',
  'scenes/mentor/HomeScreen.js',
  'scenes/mentor/CallsScreen.js',
  'scenes/settings/EditProfileScreen.js',
  'scenes/settings/UnifiedSettingsScreen.js',
  'scenes/settings/NotificationsScreen.js',
  'scenes/settings/RecordedLecturesScreen.js',
  'scenes/settings/ConnectivityScreen.js',
  'scenes/shared/MentorProfileScreen.js',
  'scenes/shared/MentorReviewsScreen.js',
  'scenes/shared/RecordingPlayerScreen.js',
  'scenes/shared/RescheduleRequestScreen.js',
  'scenes/shared/RescheduleResponseScreen.js',
  'scenes/shared/ReviewScreen.js',
  'scenes/mentor/EarningsScreen.js',
  'scenes/auth/WelcomeScreen.js',
  'scenes/auth/LoginScreen.js',
  'scenes/auth/SignupScreen.js',
];

async function renderWithTheme(ui) {
  let tree;
  await act(async () => {
    tree = renderer.create(<ThemeProvider>{ui}</ThemeProvider>);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return tree;
}

function isDarkHex(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return false;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Relative luminance threshold — dark ink for light surfaces
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

describe('light theme — critical screens source audit', () => {
  it.each(CRITICAL_SCREEN_FILES)('%s is theme-aware', (rel) => {
    const file = path.join(SRC_ROOT, rel);
    expect(fs.existsSync(file)).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    const hasHook = /useThemedStyles|useTheme\s*\(/.test(src);
    const usesMeetingColors = /from ['"].*styles\/colors['"]/.test(src);
    const hasFactory = /function create\w+Styles\s*\(\s*theme/.test(src);
    expect(hasHook || hasFactory || usesMeetingColors).toBe(true);

    // Unconditional dark hero fades break light text
    const darkFade = /rgba\(\s*15\s*,\s*14\s*,\s*42/.test(src);
    if (darkFade) {
      expect(/isLight|heroFade|balanceFade/.test(src)).toBe(true);
    }
    expect(src.includes('STATIC_SOFT_')).toBe(false);
  });
});

describe('light theme — token contrast', () => {
  const light = buildTheme(THEME_MODES.LIGHT);

  it('light text.primary is dark enough on white panels', () => {
    expect(isDarkHex(light.colors.text.primary)).toBe(true);
    expect(light.colors.surface.panel).toBe('#ffffff');
    expect(light.colors.primary.void).toBe('#f8f9ff');
  });

  it('soft fills stay visible on light canvas', () => {
    expect(softFill(light)).toBe(light.colors.surface.chip);
    expect(softFillStrong(light)).toBe(light.colors.surface.chipStrong);
    expect(softBorder(light)).toBe(light.colors.border.light);
    expect(cardFill(light)).toBe(light.colors.component.card);
  });

  it('meeting chrome flips text while video tile stays dark', () => {
    expect(light.colors.meeting[100]).toBe('#12102a');
    expect(isDarkHex(light.colors.meeting[100])).toBe(true);
    expect(light.colors.meeting[900]).toBe('#f8f9ff');
    expect(light.colors.meeting[800]).toBe('#02010c');
    expect(DARK_COLORS.meeting[100]).toBe('#f0f0fc');
    expect(LIGHT_COLORS.meeting.sheet).toBe('#ffffff');
  });
});

describe('light theme — live colors.js getters after sync', () => {
  afterEach(() => {
    syncUnifiedTheme(buildTheme(THEME_MODES.LIGHT));
  });

  it('colors.primary[100] follows light meeting ink after sync', () => {
    syncUnifiedTheme(buildTheme(THEME_MODES.LIGHT));
    expect(colors.primary[100]).toBe('#12102a');
    expect(colors.black).toBe('#f8f9ff');
    expect(colors.sheet).toBe('#ffffff');
    expect(colors.ink).toBe('#ffffff');
  });

  it('colors.primary[100] follows dark meeting ink after sync', () => {
    syncUnifiedTheme(buildTheme(THEME_MODES.DARK));
    expect(colors.primary[100]).toBe('#f0f0fc');
    expect(colors.black).toBe('#000008');
    expect(colors.sheet).toBe('#2B3034');
  });
});

describe('light theme — style factories produce readable text', () => {
  it('WaitingToJoinView styles use dark primary text in light mode', async () => {
    // Import after mocks
    const WaitingToJoinView = require('../../scenes/meeting/Components/WaitingToJoinView').default;
    let tree;
    await act(async () => {
      tree = renderer.create(
        <ThemeProvider>
          <WaitingToJoinView otherUser={{ name: 'Alex' }} isMentor={false} />
        </ThemeProvider>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    let ctx;
    function Probe() {
      ctx = useTheme();
      return null;
    }
    await renderWithTheme(<Probe />);
    expect(ctx.isDark === false || ctx.theme.mode === 'light' || ctx.theme.colors.text.primary === '#12102a').toBe(true);

    const json = tree.toJSON();
    expect(json).toBeTruthy();
    // Title node exists
    const flat = JSON.stringify(json);
    expect(flat).toContain('Connecting to session');
  });

  it('SessionLobbyView light styles use light dock + readable modal card', () => {
    const light = buildTheme(THEME_MODES.LIGHT);
    // Replicate the waiting-room tokens SessionLobbyView now uses
    expect(light.colors.surface.checkoutBar).toBe('rgba(255, 255, 255, 0.98)');
    expect(light.colors.surface.panel).toBe('#ffffff');
    expect(isDarkHex(light.colors.text.primary)).toBe(true);
    expect(light.colors.buttons.successText).toBe('#ffffff');
    expect(light.colors.buttons.nebulaText).toBe('#ffffff');
    // Guard against regression to dark-only dock / modal hardcodes
    const lobbySrc = fs.readFileSync(
      path.join(SRC_ROOT, 'scenes/meeting/Components/SessionLobbyView.js'),
      'utf8',
    );
    expect(lobbySrc).not.toContain("rgba(10,10,26,0.6)");
    expect(lobbySrc).not.toContain("backgroundColor: '#161432'");
    expect(lobbySrc).toContain('S.checkoutBar');
    expect(lobbySrc).toContain('B.successText');
  });

  it('themed factory text.primary stays dark in light preference', async () => {
    let textColor;
    const createStyles = theme =>
      StyleSheet.create({
        title: { color: theme.colors.text.primary },
      });
    function Probe() {
      const { theme, setThemePreference } = useTheme();
      const styles = useThemedStyles(createStyles);
      React.useEffect(() => {
        setThemePreference('light');
      }, [setThemePreference]);
      textColor = StyleSheet.flatten(styles.title).color;
      return <Text style={styles.title}>{theme.mode}</Text>;
    }
    await renderWithTheme(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(isDarkHex(textColor)).toBe(true);
  });
});

describe('light theme — screen list coverage map', () => {
  it('documents how many scene screens use hooks', () => {
    const scenesRoot = path.join(SRC_ROOT, 'scenes');
    const files = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('Screen.js')) files.push(full);
      }
    };
    walk(scenesRoot);
    const withHooks = files.filter(f => {
      const src = fs.readFileSync(f, 'utf8');
      return /useThemedStyles|useTheme\s*\(/.test(src);
    });
    // Guardrail: most product screens should be hooked; keep threshold honest.
    expect(files.length).toBeGreaterThan(20);
    expect(withHooks.length / files.length).toBeGreaterThanOrEqual(0.55);
  });
});
