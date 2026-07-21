/**
 * Finish MentorProfile migration + polish Videos soft fills.
 * Run: node scripts/theme-migrate-mentor-profile-finish.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, src) {
  fs.writeFileSync(path.join(ROOT, rel), src.replace(/\r\n/g, '\n'));
  console.log('OK', rel, 'lines', src.split(/\n/).length);
}

function findMatchingBrace(src, braceStart) {
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unclosed brace at ' + braceStart);
}

function wrapConstSheet(src, constName, factoryName) {
  if (src.includes(`function ${factoryName}(`)) return src;
  const open = `const ${constName} = StyleSheet.create({`;
  const idx = src.indexOf(open);
  if (idx < 0) {
    console.warn('  missing sheet', constName);
    return src;
  }
  const braceStart = src.indexOf('{', idx + `const ${constName} = StyleSheet.create`.length);
  const closeBrace = findMatchingBrace(src, braceStart);
  let end = closeBrace + 1;
  while (end < src.length && /\s/.test(src[end])) end++;
  if (src[end] === ')') end++;
  while (end < src.length && /\s/.test(src[end])) end++;
  if (src[end] === ';') end++;

  const styleBody = src.slice(braceStart + 1, closeBrace);
  const locals = [
    '  const T = theme;',
    '  const C = theme.colors;',
    '  const B = C.buttons;',
    '  const S = C.surface;',
    '  const PURPLE_LINK = B.nebulaGradient[0];',
    '  const GOLD = C.accent.primary;',
    '  const TEAL = C.accent.secondary;',
    '  const PANEL_BG = C.surface.panel;',
    '  const INPUT_BG = C.surface.sheet;',
    '  const SHEET_BG = C.surface.sheet;',
    '  const GLASS_BORDER = C.border.light;',
    '  const SCREEN_BG = C.primary.void;',
    '  return StyleSheet.create({',
  ].join('\n');

  return (
    src.slice(0, idx) +
    `function ${factoryName}(theme) {\n` +
    locals +
    styleBody +
    '});\n}' +
    src.slice(end)
  );
}

function injectAfterHook(src, fnName, lines, { exportDefault = false, afterLiveTheme = false } = {}) {
  const marker = exportDefault
    ? `export default function ${fnName}(`
    : `function ${fnName}(`;
  const idx = src.indexOf(marker);
  if (idx < 0) {
    console.warn('  missing fn', fnName);
    return src;
  }
  let i = idx + marker.length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  while (i < src.length && /\s/.test(src[i])) i++;
  const body = i + 1;
  const peek = src.slice(body, body + 500);
  if (lines.some((l) => {
    const m = l.match(/useThemedStyles\(([^)]+)\)/);
    return m && peek.includes(`useThemedStyles(${m[1]})`);
  })) {
    return src;
  }

  if (afterLiveTheme) {
    const patterns = [
      'const { theme: liveTheme } = useTheme();',
      'const { theme } = useTheme();',
    ];
    for (const p of patterns) {
      const at = src.indexOf(p, body);
      if (at > 0 && at < body + 250) {
        return src.slice(0, at + p.length) + '\n  ' + lines.join('\n  ') + src.slice(at + p.length);
      }
    }
  }

  return src.slice(0, body) + '\n  ' + lines.join('\n  ') + src.slice(body);
}

function softifyFactoryBody(src) {
  // Only inside create*Styles factories — apply globally to soft rgba used as fills/borders in styles
  return src
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.06\)'/g, 'backgroundColor: softFill(theme)')
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.07\)'/g, 'backgroundColor: softFill(theme)')
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.08\)'/g, 'backgroundColor: softFillStrong(theme)')
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.1[04]\)'/g, 'backgroundColor: softFillStrong(theme)')
    .replace(/borderColor:\s*'rgba\(255,255,255,0\.08\)'/g, 'borderColor: softBorder(theme)')
    .replace(/borderColor:\s*'rgba\(255,255,255,0\.1[24]\)'/g, 'borderColor: softBorder(theme)')
    .replace(/borderColor:\s*'rgba\(255,255,255,0\.12\)'/g, 'borderColor: softBorder(theme)');
}

function migrateMentor() {
  const rel = 'src/scenes/shared/MentorProfileScreen.js';
  let src = read(rel);
  if (src.includes('function createMentorProfileStyles(') && src.includes('softFill(theme)')) {
    console.log('SKIP', rel);
    return;
  }

  src = src.replace(
    "import { useTheme } from '../../hooks/useTheme';",
    "import { useTheme, useThemedStyles } from '../../hooks/useTheme';\nimport { softBorder, softFill, softFillStrong, avatarRingColors } from '../../theme/surfaceStyles';",
  );
  if (!src.includes('useThemedStyles')) {
    src = src.replace(
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';\nimport { softBorder, softFill, softFillStrong, avatarRingColors } from '../../theme/surfaceStyles';",
    );
  }

  // Theme-derived module accents (fallback for default params / non-hook helpers)
  src = src.replace(
    /const PURPLE_LINK = '#a78bfa';\nconst GOLD = '#f0d875';\nconst TEAL = '#2dd4bf';\nconst TEAL_DEEP = '#0c2a28';/,
    `const PURPLE_LINK = C.buttons.nebulaGradient[0];\nconst GOLD = C.accent.primary;\nconst TEAL = C.accent.secondary;\nconst TEAL_DEEP = C.surface.accentTeal;`,
  );

  src = wrapConstSheet(src, 'pressFx', 'createMentorPressFxStyles');
  src = wrapConstSheet(src, 'avatarFx', 'createMentorAvatarFxStyles');
  src = wrapConstSheet(src, 'statsBar', 'createMentorStatsBarStyles');
  src = wrapConstSheet(src, 'secHdr', 'createMentorSecHdrStyles');
  src = wrapConstSheet(src, 'railCard', 'createMentorRailCardStyles');
  src = wrapConstSheet(src, 'past', 'createMentorPastStyles');
  src = wrapConstSheet(src, 'sheet', 'createMentorSheetStyles');
  src = wrapConstSheet(src, 'styles', 'createMentorProfileStyles');
  src = softifyFactoryBody(src);

  src = injectAfterHook(src, 'PressableScale', [
    'const pressFx = useThemedStyles(createMentorPressFxStyles);',
  ]);
  src = injectAfterHook(src, 'AvatarPulseRing', [
    'const avatarFx = useThemedStyles(createMentorAvatarFxStyles);',
  ]);
  src = injectAfterHook(src, 'AnimatedTagChip', [
    'const styles = useThemedStyles(createMentorProfileStyles);',
  ]);
  src = injectAfterHook(
    src,
    'MetricsStatRow',
    ['const statsBar = useThemedStyles(createMentorStatsBarStyles);'],
    { afterLiveTheme: true },
  );
  src = injectAfterHook(
    src,
    'SectionHeaderRow',
    [
      'const secHdr = useThemedStyles(createMentorSecHdrStyles);',
      'const PURPLE_LINK = liveTheme.colors.buttons.nebulaGradient[0];',
    ],
    { afterLiveTheme: true },
  );
  // SectionHeaderRow may not have useTheme yet in olZQ — check
  {
    const idx = src.indexOf('function SectionHeaderRow(');
    const bodyPeek = src.slice(idx, idx + 400);
    if (!bodyPeek.includes('useTheme()')) {
      src = injectAfterHook(src, 'SectionHeaderRow', [
        'const { theme: liveTheme } = useTheme();',
        'const secHdr = useThemedStyles(createMentorSecHdrStyles);',
        'const PURPLE_LINK = liveTheme.colors.buttons.nebulaGradient[0];',
      ]);
    }
  }
  src = injectAfterHook(
    src,
    'PortraitVideoCard',
    ['const railCard = useThemedStyles(createMentorRailCardStyles);'],
    { afterLiveTheme: true },
  );
  {
    const idx = src.indexOf('function PortraitVideoCard(');
    const peek = src.slice(idx, idx + 500);
    if (!peek.includes('useTheme()')) {
      src = injectAfterHook(src, 'PortraitVideoCard', [
        'const { theme: liveTheme } = useTheme();',
        'const railCard = useThemedStyles(createMentorRailCardStyles);',
      ]);
    }
  }
  src = injectAfterHook(src, 'PastSessionRow', [
    'const { theme } = useTheme();',
    'const past = useThemedStyles(createMentorPastStyles);',
    'const C = theme.colors;',
    'const GOLD = C.accent.primary;',
    'const PURPLE_LINK = C.buttons.nebulaGradient[0];',
  ]);
  src = injectAfterHook(
    src,
    'MentorProfileScreen',
    [
      'const styles = useThemedStyles(createMentorProfileStyles);',
      'const sheet = useThemedStyles(createMentorSheetStyles);',
      'const T = liveTheme;',
      'const C = liveTheme.colors;',
      'const PURPLE_LINK = C.buttons.nebulaGradient[0];',
      'const GOLD = C.accent.primary;',
      'const TEAL = C.accent.secondary;',
      'const SCREEN_BG = C.primary.void;',
    ],
    { exportDefault: true, afterLiveTheme: true },
  );

  // Prefer avatarRingColors(liveTheme) when hardcoded premium gradient on avatar
  src = src.replace(
    /colors=\{\['rgba\(167,139,250,0\.95\)',\s*'rgba\(255,255,255,0\.55\)',\s*'rgba\(94,234,212,0\.5\)'\]\}/g,
    'colors={avatarRingColors(liveTheme)}',
  );

  write(rel, src);
}

function polishVideos() {
  const rel = 'src/scenes/learner/VideosScreen.js';
  let src = read(rel);
  if (!src.includes("from '../../theme/surfaceStyles'")) {
    src = src.replace(
      "import { useTheme, useThemedStyles } from '../../hooks/useTheme';",
      "import { useTheme, useThemedStyles } from '../../hooks/useTheme';\nimport { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';",
    );
  }
  // Soft fills inside factories (video chrome blacks stay)
  const before = src;
  src = src
    .replace(
      /emptyPanel: \{([\s\S]*?)backgroundColor: 'rgba\(255,255,255,0\.07\)'/,
      (m, inner) => `emptyPanel: {${inner}backgroundColor: softFill(theme)`,
    )
    .replace(
      /lockIconWrap: \{([\s\S]*?)backgroundColor: 'rgba\(255,255,255,0\.08\)'/,
      (m, inner) => `lockIconWrap: {${inner}backgroundColor: softFill(theme)`,
    )
    .replace(
      /bone: \{\n\s*backgroundColor: 'rgba\(255,255,255,0\.14\)'/,
      'bone: {\n    backgroundColor: softFillStrong(theme)',
    );
  // Also emptyIconRing border if soft
  src = src.replace(
    /emptyIconRing: \{([\s\S]*?)borderColor: STATIC_SOFT_BORDER/,
    (m, inner) => `emptyIconRing: {${inner}borderColor: softBorder(theme)`,
  );
  if (src === before) {
    // fallback global softify of those three exact lines inside file
    src = src
      .replace("backgroundColor: 'rgba(255,255,255,0.07)'", 'backgroundColor: softFill(theme)')
      .replace("backgroundColor: 'rgba(255,255,255,0.08)'", 'backgroundColor: softFill(theme)')
      .replace("backgroundColor: 'rgba(255,255,255,0.14)'", 'backgroundColor: softFillStrong(theme)');
  }
  write(rel, src);
}

migrateMentor();
polishVideos();
console.log('done');
