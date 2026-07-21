const fs = require('fs');
const file = 'C:/Flutter/Freelancing/Project/connectfront/src/components/MentorDetailSheet.js';
let src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

if (!src.includes('useThemedStyles')) {
  src = src.replace(
    "import { UNIFIED_THEME } from '../unifiedTheme';",
    "import { UNIFIED_THEME } from '../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../hooks/useTheme';",
  );
}

if (!src.includes('function createThemedStyles')) {
  const styleOpen = 'const styles = StyleSheet.create({';
  const useIdx = src.lastIndexOf(styleOpen);
  const head = [
    'function createThemedStyles(theme) {',
    '  const T = theme;',
    '  const C = theme.colors;',
    '  const B = C.buttons;',
    '  const S = C.surface;',
    '  const PURPLE_LINK = B.nebulaGradient[0];',
    '  const GOLD = C.accent.primary;',
    '  const TEAL = C.accent.secondary;',
    '  return StyleSheet.create({',
  ].join(nl);
  src = src.slice(0, useIdx) + head + src.slice(useIdx + styleOpen.length);
  const lastClose = src.lastIndexOf('});');
  src = `${src.slice(0, lastClose)}});${nl}}${nl}${src.slice(lastClose + 3)}`;
}

src = src.replace(/backgroundColor:\s*'#161432'/g, 'backgroundColor: theme.colors.surface.panel');
src = src.replace(/backgroundColor:\s*'#0f0e2a'/g, 'backgroundColor: theme.colors.surface.sheet');

// inject into exported component
const m = src.match(/export default function \w+\([^)]*\) \{/);
if (m && !src.includes('useThemedStyles(createThemedStyles)')) {
  src = src.replace(
    m[0],
    [
      m[0],
      '  const styles = useThemedStyles(createThemedStyles);',
      '  const { theme } = useTheme();',
      '  const C = theme.colors;',
      '  const GOLD = C.accent.primary;',
      '  const TEAL = C.accent.secondary;',
      '  const PURPLE_LINK = C.buttons.nebulaGradient[0];',
    ].join(nl),
  );
}

fs.writeFileSync(file, src);
console.log('OK MentorDetailSheet');
