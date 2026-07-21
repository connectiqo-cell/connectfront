const fs = require('fs');
const file = 'C:/Flutter/Freelancing/Project/connectfront/src/scenes/home/HomeScreen.js';
let src = fs.readFileSync(file, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';

const helpersNeedingStyles = [
  'SectionHeaderRow',
  'IntroPlayButton',
  'HowItWorksCard',
  'SessionOverlayCard',
  'HomeSkeleton',
  'HeroSlide',
  'HeroDot',
  'HeroPagination',
  'HeroSlider',
  'RotatingBorderIconButton',
];

for (const name of helpersNeedingStyles) {
  const re = new RegExp(`(function ${name}\\([^)]*\\) \\{)\\n`);
  if (!re.test(src)) {
    console.error('missing fn', name);
    process.exit(1);
  }
  // Skip if already injected right after signature
  const already = new RegExp(`function ${name}\\([^)]*\\) \\{\\n  const styles = useThemedStyles`);
  if (already.test(src)) {
    console.log('skip', name);
    continue;
  }
  src = src.replace(
    re,
    `$1${nl}  const styles = useThemedStyles(createThemedStyles);${nl}`,
  );
  console.log('inject styles', name);
}

// SectionHeaderRow needs PURPLE_LINK from theme
src = src.replace(
  `function SectionHeaderRow({ title, onSeeAll, icon }) {
  const styles = useThemedStyles(createThemedStyles);
`,
  `function SectionHeaderRow({ title, onSeeAll, icon }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const PURPLE_LINK = theme.colors.buttons.nebulaGradient[0];
`,
);

// IntroPlayButton needs colors
src = src.replace(
  `function IntroPlayButton({ playGlowOpacity, playGlowScale }) {
  const styles = useThemedStyles(createThemedStyles);
`,
  `function IntroPlayButton({ playGlowOpacity, playGlowScale }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
`,
);

// HowItWorksCard needs PURPLE_LINK
src = src.replace(
  `function HowItWorksCard({ video, onPress }) {
  const styles = useThemedStyles(createThemedStyles);
`,
  `function HowItWorksCard({ video, onPress }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const PURPLE_LINK = theme.colors.buttons.nebulaGradient[0];
`,
);

// HeroSlide needs C
src = src.replace(
  `function HeroSlide({ slide, slideWidth, isRemote }) {
  const styles = useThemedStyles(createThemedStyles);
`,
  `function HeroSlide({ slide, slideWidth, isRemote }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
`,
);

// RotatingBorderIconButton needs theme colors for gradient
src = src.replace(
  `function RotatingBorderIconButton({ onPress, accessibilityLabel, children }) {
  const styles = useThemedStyles(createThemedStyles);
`,
  `function RotatingBorderIconButton({ onPress, accessibilityLabel, children }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const GOLD = C.accent.primary;
  const BORDER_SPIN_COLORS = [
    B.premiumGradient[0],
    GOLD,
    C.accent.secondary,
    '#f9a8d4',
    B.premiumGradient[0],
  ];
`,
);

fs.writeFileSync(file, src);
console.log('OK helpers');
