/**
 * Migrate EarningsScreen + WalletScreen stylesheets to useThemedStyles
 * so amounts / stat numbers follow live light/dark theme.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function migrateEarnings() {
  const file = path.join(root, 'src/scenes/mentor/EarningsScreen.js');
  let src = fs.readFileSync(file, 'utf8');

  if (!src.includes("from '../../hooks/useTheme'")) {
    src = src.replace(
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useThemedStyles } from '../../hooks/useTheme';",
    );
  }

  // Inject hook into components that use `styles.`
  const injectTargets = [
    'function PressScale(',
    'function PulseIconRing(',
    'function EarningsSkeleton(',
    'function EarningsChartBoard(',
    'function SectionHeader(',
    'function ChartSkeleton(',
    'function StatSegment(',
    'function PeriodTab(',
    'function TxnRow(',
    'export default function MentorEarningsScreen()',
  ];

  for (const sig of injectTargets) {
    const idx = src.indexOf(sig);
    if (idx < 0) {
      console.warn('missing', sig);
      continue;
    }
    // Find end of function signature (first `{` after sig)
    const brace = src.indexOf('{', idx);
    const after = src.slice(brace + 1, brace + 80);
    if (after.includes('useThemedStyles(createEarningsStyles)')) continue;
    src = src.slice(0, brace + 1) + '\n  const styles = useThemedStyles(createEarningsStyles);' + src.slice(brace + 1);
  }

  // Convert styles StyleSheet
  if (src.includes('const styles = StyleSheet.create({')) {
    src = src.replace(
      'const styles = StyleSheet.create({',
      `function createEarningsStyles(theme) {
  const T = theme;
  const C = T.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const TEAL = C.accent.secondary;
  const GOLD = C.accent.primary;
  const GLASS_BORDER = C.border.light;
  const isLight = T.mode === 'light';
  return StyleSheet.create({`,
    );
    // Close factory: last `});` before end — replace the styles closing
    // Find "const chart = StyleSheet" or end — styles is after chart in this file actually styles is last
  }

  // Replace dark glass tokens inside the factory body (whole file is fine for these)
  const replacements = [
    ["backgroundColor: 'rgba(255,255,255,0.07)'", 'backgroundColor: isLight ? S.panel : \'rgba(255,255,255,0.07)\''],
    ["backgroundColor: 'rgba(255,255,255,0.06)'", 'backgroundColor: isLight ? S.panel : \'rgba(255,255,255,0.06)\''],
    ["backgroundColor: 'rgba(0,0,0,0.15)'", 'backgroundColor: isLight ? S.sheet : \'rgba(0,0,0,0.15)\''],
    ["backgroundColor: 'rgba(255,255,255,0.14)'", 'backgroundColor: isLight ? C.border.light : \'rgba(255,255,255,0.14)\''],
    ["backgroundColor: 'rgba(255,255,255,0.12)'", 'backgroundColor: isLight ? C.border.light : \'rgba(255,255,255,0.12)\''],
    ["borderBottomColor: 'rgba(255,255,255,0.1)'", 'borderBottomColor: C.border.light'],
    ["borderColor: 'rgba(255,255,255,0.14)'", 'borderColor: C.border.light'],
    ["borderColor: 'rgba(255,255,255,0.08)'", 'borderColor: C.border.light'],
  ];

  // Only apply replacements after createEarningsStyles starts
  const factoryIdx = src.indexOf('function createEarningsStyles');
  if (factoryIdx >= 0) {
    let head = src.slice(0, factoryIdx);
    let body = src.slice(factoryIdx);
    for (const [from, to] of replacements) {
      body = body.split(from).join(to);
    }
    // Close StyleSheet with }); } instead of });
    // The styles block ends with `});` at end of file essentially
    const lastClose = body.lastIndexOf('\n});\n');
    if (lastClose >= 0 && !body.includes('});\n}')) {
      body = body.slice(0, lastClose) + '\n  });\n}\n' + body.slice(lastClose + 4);
    }
    src = head + body;
  }

  fs.writeFileSync(file, src);
  console.log('EarningsScreen migrated');
}

function migrateWallet() {
  const file = path.join(root, 'src/scenes/settings/WalletScreen.js');
  let src = fs.readFileSync(file, 'utf8');

  if (!src.includes("from '../../hooks/useTheme'")) {
    src = src.replace(
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';",
    );
  }

  const injectTargets = [
    'function SectionBlock(',
    'function StatTile(',
    'function MenuRow(',
    'function QuickAmountChip(',
    'function InfoRow(',
    'function TransactionRow(',
    'function GuideRow(',
    'export default function WalletScreen(',
  ];

  for (const sig of injectTargets) {
    const idx = src.indexOf(sig);
    if (idx < 0) {
      console.warn('missing', sig);
      continue;
    }
    const brace = src.indexOf('{', idx);
    const after = src.slice(brace + 1, brace + 100);
    if (after.includes('useThemedStyles(createWalletStyles)')) continue;
    src = src.slice(0, brace + 1) + '\n  const styles = useThemedStyles(createWalletStyles);' + src.slice(brace + 1);
  }

  if (src.includes('const styles = StyleSheet.create({')) {
    src = src.replace(
      'const styles = StyleSheet.create({',
      `function createWalletStyles(theme) {
  const T = theme;
  const C = T.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  return StyleSheet.create({`,
    );

    const lastClose = src.lastIndexOf('\n});\n');
    if (lastClose >= 0 && !src.includes('function createWalletStyles') === false) {
      // ensure we close factory once
      if (!src.trimEnd().endsWith('}')) {
        // handled below
      }
    }
    // Close factory: find last }); of createWalletStyles
    const factoryIdx = src.indexOf('function createWalletStyles');
    const afterFactory = src.slice(factoryIdx);
    const closeIdx = afterFactory.lastIndexOf('\n});');
    if (closeIdx >= 0) {
      const abs = factoryIdx + closeIdx;
      // Check if already closed with }\n
      if (!src.slice(abs, abs + 10).includes('});\n}')) {
        src = src.slice(0, abs) + '\n  });\n}' + src.slice(abs + 4);
      }
    }
  }

  // Ensure balance amount and key number colors use theme tokens (already in factory via C)
  fs.writeFileSync(file, src);
  console.log('WalletScreen migrated');
}

migrateEarnings();
migrateWallet();
