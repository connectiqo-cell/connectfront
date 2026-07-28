/**
 * Generates Android launcher icons from dark_logo (zoomed for a fuller mark).
 * Run: node scripts/generate-android-icons.js
 */
const fs = require('fs');
const path = require('path');
const { SOURCE, renderAppIcon } = require('./appIconSource');

const RES_DIR = path.join(__dirname, '../android/app/src/main/res');

const DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Source logo not found:', SOURCE);
    process.exit(1);
  }

  for (const { folder, size } of DENSITIES) {
    const dir = path.join(RES_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    const square = path.join(dir, 'ic_launcher.png');
    const round = path.join(dir, 'ic_launcher_round.png');
    await (await renderAppIcon(size)).toFile(square);
    await (await renderAppIcon(size)).toFile(round);
    console.log('Wrote', folder, `(${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
