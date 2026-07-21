/**
 * Quick fix: replace hardcoded dark panel constants with theme surface tokens
 * so headings/names stay readable in light theme.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/scenes/settings/WalletScreen.js',
  'src/scenes/settings/EditProfileScreen.js',
  'src/scenes/settings/TransactionHistoryScreen.js',
  'src/scenes/settings/PayoutSetupScreen.js',
  'src/scenes/settings/ConnectivityScreen.js',
  'src/scenes/shared/BookingScreen.js',
  'src/scenes/shared/MentorReviewsScreen.js',
  'src/scenes/shared/ReviewScreen.js',
  'src/scenes/learner/VideosScreen.js',
];

for (const rel of files) {
  const file = path.join(__dirname, '..', rel);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  src = src.replace(/const PANEL_BG = '#161432';/g, 'const PANEL_BG = C.surface.panel;');
  src = src.replace(/const INPUT_BG = '#0f0e2a';/g, 'const INPUT_BG = C.surface.sheet;');
  src = src.replace(/const SHEET_BG = '#0f0e2a';/g, 'const SHEET_BG = C.surface.sheet;');
  src = src.replace(/backgroundColor:\s*'#161432'/g, 'backgroundColor: C.surface.panel');
  src = src.replace(/backgroundColor:\s*'#0f0e2a'/g, 'backgroundColor: C.surface.sheet');

  // Titles / names: prefer primary text (dark indigo in light)
  src = src.replace(
    /(headerTitle:\s*\{[^}]*?color:\s*)GOLD(,)/g,
    '$1C.text.primary$2',
  );
  src = src.replace(
    /(headerTitle:\s*\{[^}]*?color:\s*)TEAL(,)/g,
    '$1C.text.primary$2',
  );
  src = src.replace(
    /(headerTitle:\s*\{[^}]*?color:\s*)PURPLE_LINK(,)/g,
    '$1C.text.primary$2',
  );
  src = src.replace(
    /(screenTitle:\s*\{[^}]*?color:\s*)GOLD(,)/g,
    '$1C.text.primary$2',
  );
  src = src.replace(
    /(sectionTitle:\s*\{[^}]*?color:\s*)GOLD(,)/g,
    '$1C.text.primary$2',
  );

  if (src !== before) {
    fs.writeFileSync(file, src);
    console.log('OK', rel);
  } else {
    console.log('skip', rel);
  }
}
