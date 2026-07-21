const fs = require('fs');

function migrate(file, exportSig) {
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
    if (useIdx < 0) throw new Error('styles missing ' + file);
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
    if (!src.includes(exportSig)) throw new Error('export missing ' + exportSig);
    src = src.replace(
      exportSig,
      [
        exportSig,
        '  const styles = useThemedStyles(createThemedStyles);',
        '  const { theme } = useTheme();',
        '  const C = theme.colors;',
        '  const GOLD = C.accent.primary;',
        '  const TEAL = C.accent.secondary;',
        '  const PURPLE_LINK = C.buttons.nebulaGradient[0];',
        '  const PANEL_BG = C.surface.panel;',
      ].join(nl),
    );
  }

  src = src.replace(
    /backgroundColor:\s*'#161432'/g,
    'backgroundColor: theme.colors.surface.panel',
  );
  src = src.replace(
    /backgroundColor:\s*'#0f0e2a'/g,
    'backgroundColor: theme.colors.surface.sheet',
  );
  src = src.replace(
    /backgroundColor:\s*'rgba\(255,255,255,0\.0[4-9]\)'/g,
    'backgroundColor: theme.colors.surface.panel',
  );
  src = src.replace(
    /borderColor:\s*'rgba\(255,255,255,0\.1[0-9]?\)'/g,
    'borderColor: theme.colors.border.light',
  );

  fs.writeFileSync(file, src);
  console.log('OK', file);
}

migrate(
  'C:/Flutter/Freelancing/Project/connectfront/src/scenes/learner/HomeScreen.js',
  'export default function LearnerHomeScreen({ navigation }) {',
);
migrate(
  'C:/Flutter/Freelancing/Project/connectfront/src/scenes/mentor/CallsScreen.js',
  'export default function MentorCallsScreen({ navigation }) {',
);
