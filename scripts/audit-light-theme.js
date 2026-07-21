/**
 * Audit scene screens for light-theme anti-patterns.
 * Run: node scripts/audit-light-theme.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');

/** Screens that must be theme-aware (hooks or live meeting colors). */
const CRITICAL = [
  'scenes/shared/BookingScreen.js',
  'scenes/shared/VideoCallScreen.js',
  'scenes/settings/WalletScreen.js',
  'scenes/settings/PayoutSetupScreen.js',
  'scenes/settings/TransactionHistoryScreen.js',
  'scenes/meeting/Components/SessionLobbyView.js',
  'scenes/meeting/Components/WaitingToJoinView.js',
  'scenes/meeting/OneToOne/index.js',
  'scenes/meeting/Conference/ConferenceMeetingViewer.js',
  'scenes/auth/InterestsOnboardingScreen.js',
  'scenes/auth/ForgotPasswordScreen.js',
  'scenes/auth/ResetPasswordScreen.js',
  'scenes/home/HomeScreen.js',
  'scenes/learner/HomeScreen.js',
  'scenes/learner/BookingsScreen.js',
  'scenes/learner/BrowseMentorsScreen.js',
  'scenes/learner/CategoryMentorsScreen.js',
  'scenes/learner/VideosScreen.js',
  'scenes/mentor/HomeScreen.js',
  'scenes/mentor/CallsScreen.js',
  'scenes/settings/EditProfileScreen.js',
  'scenes/settings/UnifiedSettingsScreen.js',
  'scenes/settings/ConnectivityScreen.js',
  'scenes/shared/MentorProfileScreen.js',
  'scenes/shared/MentorReviewsScreen.js',
  'scenes/shared/RecordingPlayerScreen.js',
  'scenes/shared/RescheduleRequestScreen.js',
  'scenes/shared/RescheduleResponseScreen.js',
  'scenes/shared/ReviewScreen.js',
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('Screen.js') || entry.name === 'WaitingToJoinView.js' || entry.name === 'SessionLobbyView.js') {
      out.push(full);
    }
  }
  return out;
}

function analyze(file) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(ROOT, '..'), file).replace(/\\/g, '/');
  const hasHook = /useThemedStyles|useTheme\s*\(/.test(src);
  const hasStaticSheet = /const styles = StyleSheet\.create\(/.test(src);
  const hasFactory = /function create\w+Styles\s*\(\s*theme/.test(src);
  const darkFadeHardcoded =
    /rgba\(\s*15\s*,\s*14\s*,\s*42/.test(src) &&
    !/isLight|heroFade|balanceFade|heroFade\b/.test(src);
  const staticSoft = /STATIC_SOFT_/.test(src);
  const frozenModuleColors =
    /const T = UNIFIED_THEME/.test(src) &&
    /const (TEAL|GOLD|PANEL_BG|PURPLE_LINK) = /.test(src) &&
    !hasHook;

  const flags = [];
  if (hasStaticSheet && !hasHook && !hasFactory) flags.push('static-stylesheet');
  if (darkFadeHardcoded) flags.push('hardcoded-dark-fade');
  if (staticSoft) flags.push('static-soft-tokens');
  if (frozenModuleColors) flags.push('frozen-module-colors');

  return { rel, hasHook, hasFactory, flags };
}

const scenes = walk(path.join(ROOT, 'scenes'));
const meetingExtras = [
  path.join(ROOT, 'scenes/meeting/OneToOne/index.js'),
  path.join(ROOT, 'scenes/meeting/Conference/ConferenceMeetingViewer.js'),
].filter(fs.existsSync);

const all = [...new Set([...scenes, ...meetingExtras])];
const results = all.map(analyze);

const flagged = results.filter(r => r.flags.length);
const criticalHits = CRITICAL.map(rel => {
  const hit = results.find(r => r.rel.endsWith(rel) || r.rel.includes(rel.replace(/^src\//, '')));
  const fileRel = `src/${rel}`;
  const analyzed = results.find(r => r.rel.replace(/\\/g, '/') === fileRel || r.rel.endsWith(rel));
  return {
    file: rel,
    ok: analyzed ? analyzed.hasHook || analyzed.hasFactory || analyzed.flags.length === 0 : false,
    flags: analyzed?.flags || ['missing'],
    hasHook: analyzed?.hasHook,
  };
});

const criticalFail = criticalHits.filter(c => !c.ok || c.flags.includes('hardcoded-dark-fade') || c.flags.includes('static-soft-tokens'));

console.log('=== Light theme screen audit ===');
console.log(`Scanned: ${results.length} screens/components`);
console.log(`With useTheme/useThemedStyles: ${results.filter(r => r.hasHook).length}`);
console.log(`Flagged (non-critical noise ok): ${flagged.length}`);
console.log('');
console.log('Critical screens:');
criticalHits.forEach(c => {
  const mark = c.ok && !c.flags.some(f => f === 'hardcoded-dark-fade' || f === 'static-soft-tokens') ? 'OK' : 'FAIL';
  console.log(`  [${mark}] ${c.file}${c.flags.length ? ` — ${c.flags.join(', ')}` : ''}`);
});

if (flagged.length) {
  console.log('\nAll flagged files:');
  flagged.forEach(f => console.log(`  ${f.rel}: ${f.flags.join(', ')}`));
}

if (criticalFail.length) {
  console.error(`\n${criticalFail.length} critical light-theme issue(s).`);
  process.exit(1);
}

console.log('\nCritical screens look theme-aware.');
process.exit(0);
