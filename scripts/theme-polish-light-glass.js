/**
 * One-shot: replace dark-era white glass fills inside createThemedStyles factories
 * with softFill / softBorder helpers so light mode stays visible on lavender.
 *
 * Run: node scripts/theme-polish-light-glass.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

const FILES = [
  'scenes/shared/BookingScreen.js',
  'scenes/shared/MentorProfileScreen.js',
  'scenes/shared/MentorReviewsScreen.js',
  'scenes/learner/BookingsScreen.js',
  'scenes/learner/CategoryMentorsScreen.js',
  'scenes/learner/BrowseMentorsScreen.js',
  'scenes/learner/VideosScreen.js',
  'scenes/settings/WalletScreen.js',
  'scenes/settings/PayoutSetupScreen.js',
  'scenes/settings/TransactionHistoryScreen.js',
  'scenes/auth/WelcomeScreen.js',
  'components/MentorDetailSheet.js',
];

const IMPORT_LINE =
  "import { softBorder, softFill, softFillStrong, cardFill } from '../theme/surfaceStyles';";
const IMPORT_LINE_SCENES =
  "import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';";

function ensureImport(src, fileRel) {
  if (src.includes('surfaceStyles')) return src;
  const importLine = fileRel.startsWith('components/')
    ? IMPORT_LINE
    : IMPORT_LINE_SCENES;
  if (src.includes("from '../../hooks/useTheme'") || src.includes("from '../hooks/useTheme'")) {
    return src.replace(
      /(import \{[^}]*useTheme[^}]*\} from ['"][^'"]+['"];)/,
      `$1\n${importLine}`,
    );
  }
  // Fallback: after unifiedTheme import
  return src.replace(
    /(import \{[^}]*UNIFIED_THEME[^}]*\} from ['"][^'"]+['"];)/,
    `$1\n${importLine}`,
  );
}

function polish(src) {
  let out = src;

  // Only rewrite when createThemedStyles(theme) exists — safe for factory styles.
  if (!out.includes('createThemedStyles') && !out.includes('function create')) {
    // Still polish if useThemedStyles factory is present via other names
  }

  const replacements = [
    [
      /backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.0[4-8]\)'/g,
      'backgroundColor: softFill(theme)',
    ],
    [
      /backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.0[4-8]\)'/g,
      'backgroundColor: softFill(theme)',
    ],
    [
      /backgroundColor:\s*'rgba\(255,255,255,0\.0[4-8]\)'/g,
      'backgroundColor: softFill(theme)',
    ],
    [
      /backgroundColor:\s*'rgba\(255,255,255,0\.1[0-4]?\)'/g,
      'backgroundColor: softFillStrong(theme)',
    ],
    [
      /backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.1[0-4]?\)'/g,
      'backgroundColor: softFillStrong(theme)',
    ],
    [
      /backgroundColor:\s*'rgba\(255,255,255,0\.07\)'/g,
      'backgroundColor: cardFill(theme)',
    ],
    [
      /borderColor:\s*'rgba\(255,255,255,0\.1[0-4]?\)'/g,
      'borderColor: softBorder(theme)',
    ],
    [
      /borderColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.1[0-4]?\)'/g,
      'borderColor: softBorder(theme)',
    ],
    [
      /borderTopColor:\s*'rgba\(255,255,255,0\.1[0-4]?\)'/g,
      'borderTopColor: softBorder(theme)',
    ],
    [
      /borderBottomColor:\s*'rgba\(255,255,255,0\.1[0-4]?\)'/g,
      'borderBottomColor: softBorder(theme)',
    ],
    [
      /borderColor:\s*'rgba\(167,139,250,0\.22\)'/g,
      'borderColor: theme.colors.border.light',
    ],
    [
      /borderColor:\s*'rgba\(167,139,250,0\.35\)'/g,
      'borderColor: theme.colors.border.default',
    ],
  ];

  for (const [re, rep] of replacements) {
    out = out.replace(re, rep);
  }

  return out;
}

let touched = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log('skip missing', rel);
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  const before = src;
  src = polish(src);
  if (src !== before) {
    src = ensureImport(src, rel);
    fs.writeFileSync(full, src);
    touched += 1;
    console.log('polished', rel);
  } else {
    console.log('no glass matches', rel);
  }
}
console.log('done,', touched, 'files');
