/**
 * Migrate Notifications, Recorded Lectures, and Mentor Videos to light/dark theme.
 */
const fs = require('fs');
const path = require('path');

function nlOf(src) {
  return src.includes('\r\n') ? '\r\n' : '\n';
}

function ensureImport(src, nl) {
  if (src.includes("from '../../hooks/useTheme'")) return src;
  return src.replace(
    "import { UNIFIED_THEME } from '../../unifiedTheme';",
    [
      "import { UNIFIED_THEME } from '../../unifiedTheme';",
      "import { useTheme, useThemedStyles } from '../../hooks/useTheme';",
    ].join(nl),
  );
}

function wrapStyles(src, factoryName, nl, extraLocals = []) {
  if (src.includes(`function ${factoryName}`)) return src;

  const styleOpen = 'const styles = StyleSheet.create({';
  const styleIdx = src.lastIndexOf(styleOpen);
  if (styleIdx < 0) throw new Error('StyleSheet.create missing');

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
    ...extraLocals.map((l) => `  ${l}`),
    '  return StyleSheet.create({',
  ].join(nl);

  const head = `function ${factoryName}(theme) {${nl}${locals}`;
  src = src.slice(0, styleIdx) + head + src.slice(styleIdx + styleOpen.length);

  const lastClose = src.lastIndexOf('});');
  src = `${src.slice(0, lastClose)}});${nl}}${nl}${src.slice(lastClose + 3)}`;
  return src;
}

function inject(src, fnSig, lines, nl) {
  if (src.includes(fnSig) && src.indexOf('useThemedStyles', src.indexOf(fnSig)) > -1) {
    const after = src.slice(src.indexOf(fnSig), src.indexOf(fnSig) + fnSig.length + 120);
    if (after.includes('useThemedStyles')) return src;
  }
  const idx = src.indexOf(fnSig);
  if (idx < 0) throw new Error('missing fn: ' + fnSig.slice(0, 80));
  const insertAt = idx + fnSig.length;
  const block = nl + lines.map((l) => (l ? `  ${l}` : '')).join(nl);
  return src.slice(0, insertAt) + block + src.slice(insertAt);
}

function replaceHardcoded(src) {
  return src
    .replace(/const PANEL_BG = '#161432';\r?\n?/g, '')
    .replace(/const INPUT_BG = '#0f0e2a';\r?\n?/g, '')
    .replace(/const SHEET_BG = '#0f0e2a';\r?\n?/g, '')
    .replace(/const GLASS_BORDER = 'rgba\(167,139,250,0\.22\)';\r?\n?/g, '')
    .replace(/backgroundColor:\s*'#161432'/g, 'backgroundColor: PANEL_BG')
    .replace(/backgroundColor:\s*'#0f0e2a'/g, 'backgroundColor: SHEET_BG')
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.0[4-9]\)'/g, 'backgroundColor: S.chip')
    .replace(/backgroundColor:\s*'rgba\(255,255,255,0\.1[0-4]\)'/g, 'backgroundColor: S.chipStrong')
    .replace(/borderColor:\s*'rgba\(255,255,255,0\.1[0-9]?\)'/g, 'borderColor: GLASS_BORDER')
    .replace(/borderColor:\s*'rgba\(167,139,250,0\.22\)'/g, 'borderColor: GLASS_BORDER')
    .replace(/borderBottomColor:\s*'rgba\(167,139,250,0\.1[89]\)'/g, 'borderBottomColor: GLASS_BORDER')
    .replace(/borderBottomColor:\s*'rgba\(255,255,255,0\.1[0-9]?\)'/g, 'borderBottomColor: GLASS_BORDER')
    .replace(/borderTopColor:\s*'rgba\(255,255,255,0\.0[89]\)'/g, 'borderTopColor: GLASS_BORDER')
    .replace(/muted:\s*'rgba\(255,255,255,0\.06\)'/g, "muted: S.chip");
}

function migrateNotifications() {
  const file = path.join(__dirname, '../src/scenes/settings/NotificationsScreen.js');
  let src = fs.readFileSync(file, 'utf8');
  const nl = nlOf(src);
  src = ensureImport(src, nl);
  src = replaceHardcoded(src);

  // Keep module aliases for helpers that still read them until injected —
  // but point them at live UNIFIED_THEME (synced) AND inject hooks in components.
  if (!src.includes('function createNotificationsStyles')) {
    src = wrapStyles(src, 'createNotificationsStyles', nl);
  }

  const paletteLines = [
    'const styles = useThemedStyles(createNotificationsStyles);',
    'const { theme } = useTheme();',
    'const C = theme.colors;',
    'const S = C.surface;',
    'const B = C.buttons;',
    'const PURPLE_LINK = B.nebulaGradient[0];',
    'const GOLD = C.accent.primary;',
    'const TEAL = C.accent.secondary;',
    'const PANEL_BG = C.surface.panel;',
    'const GLASS_BORDER = C.border.light;',
  ];

  const injects = [
    ['function FilterChip({ label, active, onPress }) {', paletteLines],
    ['function NotificationRow({ item, isRead, onPress, index, animateKey }) {', paletteLines],
    ['function SectionHeader({ title }) {', paletteLines],
    ['function EmptyState() {', paletteLines],
    ['export default function NotificationsScreen({ navigation }) {', paletteLines],
  ];

  for (const [sig, lines] of injects) {
    src = inject(src, sig, lines, nl);
  }

  // Fix ACCENT_BG to use theme surfaces when FilterChip/NotificationRow use module ACCENT_BG
  // Module-level ACCENT_BG still references S from module UNIFIED_THEME - update muted already done.
  // Rebuild module ACCENT_COLORS to stay but PANEL_BG constant removed - helpers that used
  // module PANEL_BG now get it from injection.

  // Remove stale module-level T/C aliases usage conflicts - keep them for ACCENT_COLORS at module level
  // but ACCENT_BG muted was fixed. Module PANEL_BG removed so FilterChip outputRange PANEL_BG
  // needs the injected local - good.

  fs.writeFileSync(file, src);
  console.log('OK NotificationsScreen');
}

function migrateRecordedLectures() {
  const file = path.join(__dirname, '../src/scenes/settings/RecordedLecturesScreen.js');
  let src = fs.readFileSync(file, 'utf8');
  const nl = nlOf(src);
  src = ensureImport(src, nl);
  src = replaceHardcoded(src);

  if (!src.includes('function createRecordedStyles')) {
    src = wrapStyles(src, 'createRecordedStyles', nl);
  }

  const paletteLines = [
    'const styles = useThemedStyles(createRecordedStyles);',
    'const { theme } = useTheme();',
    'const C = theme.colors;',
    'const S = C.surface;',
    'const PURPLE_LINK = C.buttons.nebulaGradient[0];',
    'const TEAL = C.accent.secondary;',
    'const PANEL_BG = C.surface.panel;',
    'const GLASS_BORDER = C.border.light;',
  ];

  const injects = [
    ['function SectionHeader({ title, subtitle, replayToken = 0 }) {', paletteLines],
    [
      `function RecordingRow({${nl}  item,${nl}  index,${nl}  isLast,${nl}  replayToken,${nl}  onPressRecording,${nl}  onPressDownload,${nl}}) {`,
      paletteLines,
    ],
    ['function EmptyState() {', paletteLines],
    ['export default function RecordedLecturesScreen({ navigation }) {', paletteLines],
  ];

  for (const [sig, lines] of injects) {
    src = inject(src, sig, lines, nl);
  }

  fs.writeFileSync(file, src);
  console.log('OK RecordedLecturesScreen');
}

function migrateMentorVideos() {
  const file = path.join(__dirname, '../src/scenes/mentor/MentorVideosScreen.js');
  let src = fs.readFileSync(file, 'utf8');
  const nl = nlOf(src);
  src = ensureImport(src, nl);
  src = replaceHardcoded(src);

  if (!src.includes('function createMentorVideosStyles')) {
    src = wrapStyles(src, 'createMentorVideosStyles', nl);
  }

  const paletteLines = [
    'const styles = useThemedStyles(createMentorVideosStyles);',
    'const { theme } = useTheme();',
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
  ];

  const injects = [
    ['function UnlockPriceCard({', paletteLines],
    ['function VideoPlayerModal({ video, onClose }) {', paletteLines],
    ['function VideoCard({ video, index = 0, replayToken = 0, onToggleFree, onDelete, onPlay, onEdit }) {', paletteLines],
    ['function EditModal({ video, onClose, onSaved }) {', paletteLines],
    ['function UploadModal({ visible, onClose, onUploaded }) {', paletteLines],
    ['export default function MentorVideosScreen({ embeddedInTab = false }) {', paletteLines],
  ];

  for (const [sig, lines] of injects) {
    src = inject(src, sig, lines, nl);
  }

  fs.writeFileSync(file, src);
  console.log('OK MentorVideosScreen');
}

migrateNotifications();
migrateRecordedLectures();
migrateMentorVideos();
console.log('done');
