/**
 * Migrate EditProfileScreen to useThemedStyles so light theme works.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src/scenes/settings/EditProfileScreen.js');
let src = fs.readFileSync(file, 'utf8');

if (!src.includes("from '../../hooks/useTheme'")) {
  src = src.replace(
    "import { UNIFIED_THEME } from '../../unifiedTheme';",
    "import { UNIFIED_THEME } from '../../unifiedTheme';\nimport { useTheme, useThemedStyles } from '../../hooks/useTheme';",
  );
}

/** Find opening `{` of function body after `function Name(...)` */
function findBodyBrace(src, fnStart) {
  const paren = src.indexOf('(', fnStart);
  if (paren < 0) return -1;
  let depth = 0;
  for (let i = paren; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        // skip whitespace to {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === '{') return j;
        return -1;
      }
    }
  }
  return -1;
}

const injectTargets = [
  'function AvatarGlowRing(',
  'function SectionBlock(',
  'function CategoryChip(',
  'function CategoryDropdown(',
  'function Field(',
  'function CompletionBar(',
  'function AnimatedFooter(',
  'function AnimatedSaveButton(',
  'export default function EditProfileScreen(',
];

for (const sig of injectTargets) {
  const idx = src.indexOf(sig);
  if (idx < 0) {
    console.warn('missing', sig);
    continue;
  }
  const brace = findBodyBrace(src, idx);
  if (brace < 0) {
    console.warn('no body brace', sig);
    continue;
  }
  const after = src.slice(brace + 1, brace + 90);
  if (after.includes('useThemedStyles(createEditProfileStyles)')) continue;
  src = src.slice(0, brace + 1) + '\n  const styles = useThemedStyles(createEditProfileStyles);' + src.slice(brace + 1);
  console.log('injected', sig.trim());
}

if (src.includes('const styles = StyleSheet.create({')) {
  src = src.replace(
    'const styles = StyleSheet.create({',
    `function createEditProfileStyles(theme) {
  const T = theme;
  const C = T.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const isLight = T.mode === 'light';
  return StyleSheet.create({`,
  );

  const factoryIdx = src.indexOf('function createEditProfileStyles');
  const closeIdx = src.lastIndexOf('\n});');
  if (factoryIdx >= 0 && closeIdx > factoryIdx) {
    if (!src.slice(closeIdx, closeIdx + 12).includes('});\n}')) {
      src = src.slice(0, closeIdx) + '\n  });\n}' + src.slice(closeIdx + 4);
    }
  }
  console.log('converted stylesheet');
}

// Theme dark hardcoded tokens inside factory
const factoryIdx = src.indexOf('function createEditProfileStyles');
if (factoryIdx >= 0) {
  let head = src.slice(0, factoryIdx);
  let body = src.slice(factoryIdx);
  const reps = [
    ["backgroundColor: 'rgba(15,14,42,0.75)'", "backgroundColor: isLight ? 'rgba(26,22,66,0.72)' : 'rgba(15,14,42,0.75)'"],
    ["backgroundColor: 'rgba(15,14,42,0.96)'", 'backgroundColor: isLight ? S.checkoutBar : \'rgba(15,14,42,0.96)\''],
    ["borderColor: 'rgba(255,255,255,0.35)'", 'borderColor: isLight ? C.border.default : \'rgba(255,255,255,0.35)\''],
    ["borderBottomColor: 'rgba(167,139,250,0.18)'", 'borderBottomColor: C.border.light'],
    ["borderTopColor: 'rgba(167,139,250,0.18)'", 'borderTopColor: C.border.light'],
    ["borderColor: 'rgba(167,139,250,0.18)'", 'borderColor: C.border.light'],
    ["borderColor: 'rgba(167,139,250,0.35)'", 'borderColor: C.border.default'],
  ];
  for (const [from, to] of reps) {
    body = body.split(from).join(to);
  }
  src = head + body;
}

fs.writeFileSync(file, src);
console.log('done');
