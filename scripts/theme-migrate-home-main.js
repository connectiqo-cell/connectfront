const fs = require('fs');
const file = 'C:/Flutter/Freelancing/Project/connectfront/src/scenes/home/HomeScreen.js';
let src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

if (!src.includes('useThemedStyles')) {
  src = src.replace(
    "import { UNIFIED_THEME } from '../../unifiedTheme';",
    "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';",
  );
}

if (!src.includes('function createThemedStyles')) {
  const styleOpen = 'const styles = StyleSheet.create({';
  const useIdx = src.lastIndexOf(styleOpen);
  if (useIdx < 0) throw new Error('styles missing');
  const head = [
    'function createThemedStyles(theme) {',
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
  src = src.slice(0, useIdx) + head + src.slice(useIdx + styleOpen.length);
  const lastClose = src.lastIndexOf('});');
  src = `${src.slice(0, lastClose)}});${nl}}${nl}${src.slice(lastClose + 3)}`;
}

if (!src.includes('useThemedStyles(createThemedStyles)')) {
  src = src.replace(
    'export default function HomeScreen() {',
    [
      'export default function HomeScreen() {',
      '  const styles = useThemedStyles(createThemedStyles);',
      '  const { theme } = useTheme();',
      '  const C = theme.colors;',
      '  const GOLD = C.accent.primary;',
      '  const TEAL = C.accent.secondary;',
      '  const PURPLE_LINK = C.buttons.nebulaGradient[0];',
    ].join(nl),
  );
}

// Strengthen heading tokens inside createThemedStyles
src = src.replace(
  /appName:\s*\{[\s\S]*?\},/,
  [
    'appName: {',
    '    ...T.typography.headingSm,',
    '    color: C.text.primary,',
    "    fontWeight: '800',",
    '    letterSpacing: -0.3,',
    '  },',
  ].join(nl),
);

src = src.replace(
  /secHdrTitle:\s*\{[\s\S]*?\},/,
  [
    'secHdrTitle: {',
    '    ...T.typography.headingXs,',
    '    fontSize: 16,',
    "    fontWeight: '800',",
    '    color: C.text.primary,',
    '    letterSpacing: -0.1,',
  ].join(nl) + nl + '  },',
);

fs.writeFileSync(file, src);
console.log('OK HomeScreen');
