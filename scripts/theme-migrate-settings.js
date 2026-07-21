const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '../src/scenes/settings/UnifiedSettingsScreen.js',
);
let src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

src = src.replace(
  "import { UNIFIED_THEME } from '../../unifiedTheme';",
  "import { useTheme, useThemedStyles } from '../../hooks/useTheme';",
);

const start = src.indexOf('const T = UNIFIED_THEME;');
const end = src.indexOf('async function openExternal');
if (start < 0 || end < 0) {
  console.error('markers missing', start, end);
  process.exit(1);
}

const palette = [
  "const APP_VERSION = '0.0.1';",
  "const SUPPORT_EMAIL = 'contact@connectiqo.com';",
  "const PRIVACY_URL = 'https://connectiqo.com/privacy';",
  "const TERMS_URL = 'https://connectiqo.com/terms';",
  '',
  'function useSettingsPalette() {',
  '  const { theme } = useTheme();',
  '  const C = theme.colors;',
  '  const S = C.surface;',
  '  const PURPLE_LINK = C.buttons.nebulaGradient[0];',
  '  const GOLD = C.accent.primary;',
  '  const TEAL = C.accent.secondary;',
  '  return {',
  '    theme,',
  '    T: theme,',
  '    C,',
  '    B: C.buttons,',
  '    S,',
  '    PURPLE_LINK,',
  '    GOLD,',
  '    TEAL,',
  '    PANEL_BG: C.surface.panel,',
  '    ACCENT_COLORS: { gold: GOLD, teal: TEAL, purple: PURPLE_LINK },',
  '    ACCENT_BG: {',
  '      gold: S.accentGold,',
  '      teal: S.accentTeal,',
  '      purple: S.accentViolet,',
  '    },',
  '  };',
  '}',
  '',
].join(nl);

src = src.slice(0, start) + palette + src.slice(end);

const styleOpen = 'const styles = StyleSheet.create({';
const styleIdx = src.indexOf(styleOpen);
if (styleIdx < 0) {
  console.error('StyleSheet missing');
  process.exit(1);
}

const styleFactory = [
  'function createSettingsStyles(theme) {',
  '  const T = theme;',
  '  const C = theme.colors;',
  '  const B = C.buttons;',
  '  const S = C.surface;',
  '  const PURPLE_LINK = B.nebulaGradient[0];',
  '  const GOLD = C.accent.primary;',
  '  const TEAL = C.accent.secondary;',
  '  const PANEL_BG = C.surface.panel;',
  '  return StyleSheet.create({',
].join(nl);

src = src.slice(0, styleIdx) + styleFactory + src.slice(styleIdx + styleOpen.length);

const lastClose = src.lastIndexOf('});');
src = `${src.slice(0, lastClose)}});${nl}}${nl}${src.slice(lastClose + 3)}`;

function injectAfter(fnSig, lines) {
  const idx = src.indexOf(fnSig);
  if (idx < 0) throw new Error('missing ' + fnSig.slice(0, 60));
  const insertAt = idx + fnSig.length;
  const block = nl + lines.map((l) => (l ? `  ${l}` : '')).join(nl);
  src = src.slice(0, insertAt) + block + src.slice(insertAt);
}

injectAfter(
  'function SectionHeaderRow({ title, count, subtitle, replayToken = 0, delay = 0 }) {',
  [
    'const styles = useThemedStyles(createSettingsStyles);',
    'const { C } = useSettingsPalette();',
  ],
);
injectAfter('function QuickStat({ label, value, loading }) {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { TEAL } = useSettingsPalette();',
]);
injectAfter('function PulseBadge({ count, style, textStyle, max = 9 }) {', [
  'const styles = useThemedStyles(createSettingsStyles);',
]);
injectAfter(
  'function MenuRow({\n  icon,\n  accent,\n  label,\n  subtitle,\n  onPress,\n  badge,\n  noBorder,\n  destructive,\n  index = 0,\n  replayToken = 0,\n}) {'.replace(
    /\n/g,
    nl,
  ),
  [
    'const styles = useThemedStyles(createSettingsStyles);',
    'const { C, S, PURPLE_LINK, ACCENT_COLORS, ACCENT_BG } = useSettingsPalette();',
  ],
);
injectAfter('function AvatarGlowRing() {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { TEAL } = useSettingsPalette();',
]);
injectAfter('function RefreshButton({ onPress, refreshing }) {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { C, TEAL } = useSettingsPalette();',
]);
injectAfter('function SubsRow({ row, onPress, index, replayToken = 0 }) {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { C, PURPLE_LINK, TEAL } = useSettingsPalette();',
]);
injectAfter('function FloatingEmptyIcon() {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { PURPLE_LINK } = useSettingsPalette();',
]);
injectAfter('export default function UnifiedSettingsScreen({ navigation }) {', [
  'const styles = useThemedStyles(createSettingsStyles);',
  'const { C, S, GOLD, TEAL, PURPLE_LINK, PANEL_BG } = useSettingsPalette();',
]);

fs.writeFileSync(file, src);
console.log('OK');
