/**
 * Shared app-icon prep from connectiqo_logo.
 * Logo is transparent purple/yellow artwork; we composite onto a solid
 * black square so launcher / App Store icons read correctly.
 */
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '../src/assets/images/connectiqo_logo.png');

/** Opaque fill for launcher + App Store icons (Apple rejects alpha). */
const IOS_ICON_BACKGROUND = '#000000';

/**
 * @param {number} size
 * @param {{ flattenBackground?: string }} [options]
 *   When flattenBackground is set, composites onto that solid color and
 *   strips the alpha channel (required for App Store 1024×1024 icons).
 */
async function renderAppIcon(size, options = {}) {
  const background = options.flattenBackground || IOS_ICON_BACKGROUND;

  const logo = await sharp(SOURCE)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  }).composite([{ input: logo, gravity: 'centre' }]);

  if (options.flattenBackground) {
    pipeline = pipeline.flatten({ background: options.flattenBackground }).removeAlpha();
  }

  return pipeline.png();
}

module.exports = { SOURCE, IOS_ICON_BACKGROUND, renderAppIcon };
