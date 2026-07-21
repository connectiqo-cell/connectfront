const fs = require('fs');
const path = require('path');

function migrate(fileRel, { importLine, fnSig, factoryLocals, componentLocals }) {
  const file = path.join(__dirname, '..', fileRel);
  let src = fs.readFileSync(file, 'utf8');
  const nl = src.includes('\r\n') ? '\r\n' : '\n';

  if (!src.includes('useThemedStyles')) {
    src = src.replace(
      importLine.from,
      importLine.to,
    );
  }

  if (src.includes('function createThemedStyles')) {
    console.log('already', fileRel);
    return;
  }

  const styleOpen = 'const styles = StyleSheet.create({';
  const idx = src.indexOf(styleOpen);
  if (idx < 0) throw new Error('no styles');

  src =
    src.slice(0, idx) +
    ['function createThemedStyles(theme) {', ...factoryLocals, '  return StyleSheet.create({'].join(nl) +
    src.slice(idx + styleOpen.length);

  const lastClose = src.lastIndexOf('});');
  src = `${src.slice(0, lastClose)}});${nl}}${nl}${src.slice(lastClose + 3)}`;

  const fi = src.indexOf(fnSig);
  if (fi < 0) throw new Error('fnSig missing in ' + fileRel);
  const at = fi + fnSig.length;
  src =
    src.slice(0, at) +
    nl +
    componentLocals.map((l) => `  ${l}`).join(nl) +
    src.slice(at);

  src = src.replace(
    /backgroundColor:\s*'rgba\(255,255,255,0\.07\)'/g,
    'backgroundColor: theme.colors.surface.panel',
  );
  src = src.replace(
    /borderColor:\s*'rgba\(255,255,255,0\.14\)'/g,
    'borderColor: theme.colors.border.light',
  );
  src = src.replace(
    /borderColor:\s*'rgba\(255,255,255,0\.2\)'/g,
    'borderColor: theme.colors.border.light',
  );

  // Inside createThemedStyles, UNIFIED_THEME.spacing etc still ok for layout
  fs.writeFileSync(file, src);
  console.log('OK', fileRel);
}

migrate('src/components/BookingCard.js', {
  importLine: {
    from: "import { UNIFIED_THEME } from '../unifiedTheme';",
    to: "import { UNIFIED_THEME } from '../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../hooks/useTheme';",
  },
  fnSig: '  pressScale = false,\r\n}) => {',
  factoryLocals: [
    '  const T = theme.colors;',
    '  const S = theme.colors.surface;',
  ],
  componentLocals: [
    'const styles = useThemedStyles(createThemedStyles);',
    'const { theme } = useTheme();',
    'const T = theme.colors;',
    'const S = theme.colors.surface;',
    'const B = theme.colors.buttons;',
    'const PURPLE_LINK = B.nebulaGradient[0];',
  ],
});

migrate('src/components/LearnerMentorCard.js', {
  importLine: {
    from: "import { UNIFIED_THEME } from '../unifiedTheme';",
    to: "import { UNIFIED_THEME } from '../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../hooks/useTheme';",
  },
  fnSig: '  fullWidth = false,\r\n}) {',
  factoryLocals: [
    '  const T = theme;',
    '  const C = theme.colors;',
    '  const B = C.buttons;',
    '  const S = C.surface;',
    '  const PURPLE_LINK = B.nebulaGradient[0];',
    '  const GOLD = C.accent.primary;',
    '  const TEAL = C.accent.secondary;',
  ],
  componentLocals: [
    'const styles = useThemedStyles(createThemedStyles);',
    'const { theme } = useTheme();',
    'const C = theme.colors;',
    'const B = C.buttons;',
    'const S = C.surface;',
    'const PURPLE_LINK = B.nebulaGradient[0];',
    'const GOLD = C.accent.primary;',
    'const TEAL = C.accent.secondary;',
  ],
});
