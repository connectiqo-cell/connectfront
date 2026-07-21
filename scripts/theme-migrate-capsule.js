const fs = require('fs');
const path = 'C:/Flutter/Freelancing/Project/connectfront/src/components/CapsuleTabBar.js';
let src = fs.readFileSync(path, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

if (!src.includes('useTheme')) {
  src = src.replace(
    "import { UNIFIED_THEME } from '../unifiedTheme';",
    "import { UNIFIED_THEME } from '../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../hooks/useTheme';",
  );
}

if (!src.includes('function createThemedStyles')) {
  const styleOpen = 'const styles = StyleSheet.create({';
  const idx = src.indexOf(styleOpen);
  const head = [
    'function createThemedStyles(theme) {',
    '  const T = theme;',
    '  const C = theme.colors;',
    '  const B = C.buttons;',
    '  const TB = C.tabBar;',
    '  const PURPLE_LINK = B.nebulaGradient[0];',
    '  const GOLD = C.accent.primary;',
    '  const TEAL = C.accent.secondary;',
    '  return StyleSheet.create({',
  ].join(nl);
  src = src.slice(0, idx) + head + src.slice(idx + styleOpen.length);
  const last = src.lastIndexOf('});');
  src = `${src.slice(0, last)}});${nl}}${nl}${src.slice(last + 3)}`;
}

const sig = 'export const CosmicTopTabBar = ({ state, descriptors, navigation, compact = false }) => {';
if (!src.includes('useThemedStyles(createThemedStyles)')) {
  if (!src.includes(sig)) throw new Error('sig missing');
  src = src.replace(
    sig,
    `${sig}${nl}  const styles = useThemedStyles(createThemedStyles);${nl}  const { theme } = useTheme();${nl}  const C = theme.colors;${nl}  const B = C.buttons;${nl}  const TB = C.tabBar;${nl}  const PURPLE_LINK = B.nebulaGradient[0];${nl}  const GOLD = C.accent.primary;${nl}  const TEAL = C.accent.secondary;`,
  );
}

fs.writeFileSync(path, src);
console.log('OK capsule');
