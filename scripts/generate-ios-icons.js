/**
 * Generates iOS AppIcon PNGs from dark_logo (zoomed for a fuller mark).
 * Run: node scripts/generate-ios-icons.js
 */
const fs = require('fs');
const path = require('path');
const { SOURCE, IOS_ICON_BACKGROUND, renderAppIcon } = require('./appIconSource');

const OUT_DIR = path.join(__dirname, '../ios/MyApp/Images.xcassets/AppIcon.appiconset');

const ICONS = [
  { name: 'Icon-App-20x20@2x.png', size: 40 },
  { name: 'Icon-App-20x20@3x.png', size: 60 },
  { name: 'Icon-App-29x29@2x.png', size: 58 },
  { name: 'Icon-App-29x29@3x.png', size: 87 },
  { name: 'Icon-App-40x40@2x.png', size: 80 },
  { name: 'Icon-App-40x40@3x.png', size: 120 },
  { name: 'Icon-App-60x60@2x.png', size: 120 },
  { name: 'Icon-App-60x60@3x.png', size: 180 },
  { name: 'Icon-App-1024x1024@1x.png', size: 1024 },
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Source logo not found:', SOURCE);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    const outPath = path.join(OUT_DIR, icon.name);
    // App Store rejects ios-marketing icons with transparency / alpha.
    await (
      await renderAppIcon(icon.size, { flattenBackground: IOS_ICON_BACKGROUND })
    ).toFile(outPath);
    console.log('Wrote', icon.name);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
