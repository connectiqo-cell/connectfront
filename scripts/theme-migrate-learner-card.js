const fs = require('fs');
const path = 'C:/Flutter/Freelancing/Project/connectfront/src/components/LearnerMentorCard.js';
let src = fs.readFileSync(path, 'utf8');

if (!src.includes('useThemedStyles')) {
  src = src.replace(
    "import { UNIFIED_THEME } from '../unifiedTheme';",
    "import { UNIFIED_THEME } from '../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../hooks/useTheme';",
  );
}

if (!src.includes('function createThemedStyles')) {
  const styleOpen = 'const styles = StyleSheet.create({';
  const idx = src.indexOf(styleOpen);
  const head = `function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  return StyleSheet.create({`;
  src = src.slice(0, idx) + head + src.slice(idx + styleOpen.length);
  const last = src.lastIndexOf('});');
  src = `${src.slice(0, last)}});\n}\n${src.slice(last + 3)}`;
}

const sig = '  fullWidth = false,\n}) {';
if (!src.includes('const styles = useThemedStyles')) {
  const inject = `  fullWidth = false,
}) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;`;
  if (!src.includes(sig)) throw new Error('sig missing');
  src = src.replace(sig, inject);
}

src = src.replace(
  /backgroundColor:\s*'rgba\(255,255,255,0\.07\)'/g,
  'backgroundColor: theme.colors.surface.panel',
);
src = src.replace(
  /borderColor:\s*'rgba\(255,255,255,0\.14\)'/g,
  'borderColor: theme.colors.border.light',
);

fs.writeFileSync(path, src);
console.log('OK');
