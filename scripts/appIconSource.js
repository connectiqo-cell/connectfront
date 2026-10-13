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

/** Fraction cropped from each edge of the trimmed tile to cut its rounded corners. */
const INSET = 0.06;

/**
 * @param {number} size
 * @param {{ flattenBackground?: string }} [options]
 *   When flattenBackground is set, composites onto that solid color and
 *   strips the alpha channel (required for App Store 1024×1024 icons).
 */
async function renderAppIcon(size, options = {}) {
  const background = options.flattenBackground || IOS_ICON_BACKGROUND;

  // Logo is a glossy rounded-square tile with a transparent glow margin: trim the
  // margin, then shave the tile's own rounded corners (INSET) so the purple fills
  // the whole icon and the OS mask supplies the corners — no black frame.
  const { data, info } = await sharp(SOURCE).trim({ threshold: 80 }).toBuffer({ resolveWithObject: true });
  const inset = Math.round(Math.min(info.width, info.height) * INSET);
  const logo = await sharp(data)
    .extract({
      left: inset,
      top: inset,
      width: info.width - inset * 2,
      height: info.height - inset * 2,
    })
    .resize(size, size, { fit: 'cover' })
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
