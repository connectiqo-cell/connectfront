/**
 * Migrate VideosScreen, ReviewScreen, MentorProfileScreen to useThemedStyles.
 * Uses brace-matching so StyleSheet blocks are never truncated.
 * Run: node scripts/theme-migrate-three-large.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function write(rel, src) {
  fs.writeFileSync(path.join(ROOT, rel), src);
  console.log('OK', rel, 'lines', src.split(/\r?\n/).length);
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
  // Original form is StyleSheet.create({ ... }); — consume `)`, then `;`
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

  const replacement =
    `function ${factoryName}(theme) {\n` +
    locals +
    styleBody +
    '});\n}';

  return src.slice(0, idx) + replacement + src.slice(end);
}

/** Insert lines right after `) {` that opens the named function. */
function injectIntoFn(src, fnName, lines, { exportDefault = false } = {}) {
  const marker = exportDefault
    ? `export default function ${fnName}(`
    : `function ${fnName}(`;
  const idx = src.indexOf(marker);
  if (idx < 0) {
    console.warn('  missing fn', fnName);
    return src;
  }
  // Find matching ) { for the function signature (skip nested parens in defaults carefully)
  let i = idx + marker.length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  // i is just past ')'
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') {
    console.warn('  no body for', fnName);
    return src;
  }
  const bodyStart = i + 1;
  const peek = src.slice(bodyStart, bodyStart + 400);
  const already = lines.every((l) => {
    const key = l.includes('useThemedStyles')
      ? l.match(/useThemedStyles\([^)]+\)/)?.[0]
      : null;
    if (key) return peek.includes(key);
    return false;
  });
  if (already || lines.some((l) => {
    const m = l.match(/useThemedStyles\(([^)]+)\)/);
    return m && peek.includes(`useThemedStyles(${m[1]})`);
  })) {
    return src;
  }

  const block = '\n  ' + lines.join('\n  ');
  return src.slice(0, bodyStart) + block + src.slice(bodyStart);
}

function replaceStaticSoft(src) {
  return src
    .replace(/STATIC_SOFT_FILL_STRONG/g, 'softFillStrong(theme)')
    .replace(/STATIC_SOFT_FILL(?!_)/g, 'softFill(theme)')
    .replace(/STATIC_SOFT_BORDER/g, 'softBorder(theme)');
}

function palette(stylesVar, factory) {
  return [
    `const ${stylesVar} = useThemedStyles(${factory});`,
    'const { theme } = useTheme();',
    'const T = theme;',
    'const C = theme.colors;',
    'const B = C.buttons;',
    'const S = C.surface;',
    'const PURPLE_LINK = B.nebulaGradient[0];',
    'const GOLD = C.accent.primary;',
    'const TEAL = C.accent.secondary;',
    'const PANEL_BG = C.surface.panel;',
    'const INPUT_BG = C.surface.sheet;',
    'const SHEET_BG = C.surface.sheet;',
    'const GLASS_BORDER = C.border.light;',
    'const SCREEN_BG = C.primary.void;',
  ];
}

function migrateVideos() {
  const rel = 'src/scenes/learner/VideosScreen.js';
  let src = read(rel);
  if (src.includes('function createVideosStyles(') && !/STATIC_SOFT_/.test(src)) {
    console.log('SKIP', rel);
    return;
  }

  if (!src.includes("from '../../hooks/useTheme'")) {
    src = src.replace(
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';",
    );
  }
  src = src.replace(
    /import \{[^}]*STATIC_SOFT_[^}]*\} from '\.\.\/\.\.\/theme\/surfaceStyles';/,
    "import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';",
  );
  src = src.replace(
    "const GLASS_BORDER = 'rgba(167,139,250,0.22)';",
    'const GLASS_BORDER = C.border.light;',
  );

  src = wrapConstSheet(src, 'u', 'createUnlockStyles');
  src = wrapConstSheet(src, 's', 'createVideosStyles');
  src = wrapConstSheet(src, 'sk', 'createVideosSkeletonStyles');
  src = replaceStaticSoft(src);

  const sLines = palette('s', 'createVideosStyles');
  const uLines = palette('u', 'createUnlockStyles');
  const skLines = [
    'const sk = useThemedStyles(createVideosSkeletonStyles);',
    'const { theme } = useTheme();',
  ];

  src = injectIntoFn(src, 'SkeletonBone', skLines);
  src = injectIntoFn(src, 'VideosSkeleton', skLines);
  src = injectIntoFn(src, 'ReelProfileRail', sLines);
  src = injectIntoFn(src, 'ReelProgressBar', sLines);
  src = injectIntoFn(src, 'ReelInfoDock', sLines);
  src = injectIntoFn(src, 'UnlockSheet', uLines);
  src = injectIntoFn(src, 'ShortCard', sLines);
  src = injectIntoFn(src, 'VideosScreen', sLines, { exportDefault: true });

  write(rel, src);
}

function migrateReview() {
  const rel = 'src/scenes/shared/ReviewScreen.js';
  let src = read(rel);
  if (src.includes('function createReviewStyles(') && !/STATIC_SOFT_/.test(src) && !src.includes("rgba(22, 20, 50, 0.72)")) {
    console.log('SKIP', rel);
    return;
  }

  if (!src.includes("from '../../hooks/useTheme'")) {
    src = src.replace(
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';",
    );
  }
  src = src.replace(
    "const PANEL_BG = 'rgba(22, 20, 50, 0.72)';",
    'const PANEL_BG = C.surface.panel;',
  );
  src = src.replace(
    "const GLASS_BORDER = 'rgba(167,139,250,0.22)';",
    'const GLASS_BORDER = C.border.light;',
  );

  src = wrapConstSheet(src, 'sec', 'createReviewSecStyles');
  src = wrapConstSheet(src, 'pressFx', 'createReviewPressFxStyles');
  src = wrapConstSheet(src, 'avatarFx', 'createReviewAvatarFxStyles');
  src = wrapConstSheet(src, 'starStyles', 'createReviewStarStyles');
  src = wrapConstSheet(src, 'styles', 'createReviewStyles');
  src = replaceStaticSoft(src);

  const stylesLines = palette('styles', 'createReviewStyles');

  src = injectIntoFn(src, 'SectionHeader', [
    'const sec = useThemedStyles(createReviewSecStyles);',
    'const { theme } = useTheme();',
    'const C = theme.colors;',
    'const S = C.surface;',
    'const PURPLE_LINK = C.buttons.nebulaGradient[0];',
  ]);
  src = injectIntoFn(src, 'PressableScale', [
    'const pressFx = useThemedStyles(createReviewPressFxStyles);',
  ]);
  src = injectIntoFn(src, 'ScreenHeader', stylesLines);
  src = injectIntoFn(src, 'AvatarPulseRing', [
    'const avatarFx = useThemedStyles(createReviewAvatarFxStyles);',
  ]);
  src = injectIntoFn(src, 'SubmittedBadge', stylesLines);
  src = injectIntoFn(src, 'AnimatedQuickTag', stylesLines);
  src = injectIntoFn(src, 'AnimatedInputShell', stylesLines);
  src = injectIntoFn(src, 'StarRatingPicker', [
    'const starStyles = useThemedStyles(createReviewStarStyles);',
    'const { theme } = useTheme();',
    'const C = theme.colors;',
    'const GOLD = C.accent.primary;',
  ]);
  src = injectIntoFn(src, 'ReviewScreen', stylesLines, { exportDefault: true });

  write(rel, src);
}

function migrateMentorProfile() {
  const rel = 'src/scenes/shared/MentorProfileScreen.js';
  let src = read(rel);
  if (src.includes('function createMentorProfileStyles(') && !/STATIC_SOFT_/.test(src)) {
    console.log('SKIP', rel);
    return;
  }

  src = src.replace(
    "import { useTheme } from '../../hooks/useTheme';",
    "import { useTheme, useThemedStyles } from '../../hooks/useTheme';",
  );
  src = src.replace(
    /import \{[^}]*\} from '\.\.\/\.\.\/theme\/surfaceStyles';/,
    "import { softBorder, softFill, softFillStrong, avatarRingColors } from '../../theme/surfaceStyles';",
  );

  src = wrapConstSheet(src, 'pressFx', 'createMentorPressFxStyles');
  src = wrapConstSheet(src, 'avatarFx', 'createMentorAvatarFxStyles');
  src = wrapConstSheet(src, 'statsBar', 'createMentorStatsBarStyles');
  src = wrapConstSheet(src, 'secHdr', 'createMentorSecHdrStyles');
  src = wrapConstSheet(src, 'railCard', 'createMentorRailCardStyles');
  src = wrapConstSheet(src, 'past', 'createMentorPastStyles');
  src = wrapConstSheet(src, 'sheet', 'createMentorSheetStyles');
  src = wrapConstSheet(src, 'styles', 'createMentorProfileStyles');
  src = replaceStaticSoft(src);

  src = injectIntoFn(src, 'PressableScale', [
    'const pressFx = useThemedStyles(createMentorPressFxStyles);',
  ]);
  src = injectIntoFn(src, 'AvatarPulseRing', [
    'const avatarFx = useThemedStyles(createMentorAvatarFxStyles);',
  ]);
  src = injectIntoFn(src, 'AnimatedTagChip', [
    'const styles = useThemedStyles(createMentorProfileStyles);',
  ]);

  // MetricsStatRow already has useTheme — inject statsBar after existing hooks
  {
    const marker = 'function MetricsStatRow(';
    const idx = src.indexOf(marker);
    const body = (() => {
      let i = idx + marker.length;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
        i++;
      }
      while (i < src.length && /\s/.test(src[i])) i++;
      return i + 1; // after {
    })();
    const peek = src.slice(body, body + 350);
    if (!peek.includes('createMentorStatsBarStyles')) {
      // after `const { theme: liveTheme } = useTheme();`
      const live = 'const { theme: liveTheme } = useTheme();';
      const liveAt = src.indexOf(live, body);
      if (liveAt > 0 && liveAt < body + 200) {
        src =
          src.slice(0, liveAt + live.length) +
          '\n  const statsBar = useThemedStyles(createMentorStatsBarStyles);' +
          src.slice(liveAt + live.length);
      } else {
        src =
          src.slice(0, body) +
          '\n  const statsBar = useThemedStyles(createMentorStatsBarStyles);' +
          src.slice(body);
      }
    }
  }

  {
    const live = 'const { theme: liveTheme } = useTheme();';
    const marker = 'function SectionHeaderRow(';
    const idx = src.indexOf(marker);
    let i = idx + marker.length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    const body = i + 1;
    const peek = src.slice(body, body + 400);
    if (!peek.includes('createMentorSecHdrStyles')) {
      const liveAt = src.indexOf(live, body);
      if (liveAt > 0 && liveAt < body + 200) {
        src =
          src.slice(0, liveAt + live.length) +
          '\n  const secHdr = useThemedStyles(createMentorSecHdrStyles);\n  const PURPLE_LINK = liveTheme.colors.buttons.nebulaGradient[0];' +
          src.slice(liveAt + live.length);
      }
    }
  }

  {
    const live = 'const { theme: liveTheme } = useTheme();';
    const marker = 'function PortraitVideoCard(';
    const idx = src.indexOf(marker);
    let i = idx + marker.length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    const body = i + 1;
    const peek = src.slice(body, body + 400);
    if (!peek.includes('createMentorRailCardStyles')) {
      const liveAt = src.indexOf(live, body);
      if (liveAt > 0 && liveAt < body + 250) {
        src =
          src.slice(0, liveAt + live.length) +
          '\n  const railCard = useThemedStyles(createMentorRailCardStyles);' +
          src.slice(liveAt + live.length);
      }
    }
  }

  {
    const marker = 'function PastSessionRow(';
    const idx = src.indexOf(marker);
    let i = idx + marker.length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    while (i < src.length && /\s/.test(src[i])) i++;
    const body = i + 1;
    const peek = src.slice(body, body + 400);
    if (!peek.includes('createMentorPastStyles')) {
      const th = 'const { theme } = useTheme();';
      const thAt = src.indexOf(th, body);
      if (thAt > 0 && thAt < body + 200) {
        src =
          src.slice(0, thAt + th.length) +
          '\n  const past = useThemedStyles(createMentorPastStyles);\n  const C = theme.colors;\n  const PURPLE_LINK = C.buttons.nebulaGradient[0];' +
          src.slice(thAt + th.length);
      }
    }
  }

  {
    const marker = 'export default function MentorProfileScreen(';
    const idx = src.indexOf(marker);
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
    if (!peek.includes('createMentorProfileStyles')) {
      const live = 'const { theme: liveTheme } = useTheme();';
      const liveAt = src.indexOf(live, body);
      if (liveAt > 0 && liveAt < body + 200) {
        src =
          src.slice(0, liveAt + live.length) +
          '\n  const styles = useThemedStyles(createMentorProfileStyles);\n  const sheet = useThemedStyles(createMentorSheetStyles);\n  const T = liveTheme;\n  const C = liveTheme.colors;\n  const PURPLE_LINK = C.buttons.nebulaGradient[0];\n  const GOLD = C.accent.primary;\n  const TEAL = C.accent.secondary;\n  const SCREEN_BG = C.primary.void;' +
          src.slice(liveAt + live.length);
      }
    }
  }

  write(rel, src);
}

migrateVideos();
migrateReview();
migrateMentorProfile();
console.log('done');
