/**
 * Shared app-icon prep: dark_logo has large empty margins, so we zoom-crop
 * the artwork before resizing so it fills the launcher icon.
 */
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, '../src/assets/images/dark_logo.png');

/** How much to zoom into the artwork (1 = no zoom). */
const ICON_ZOOM = 1.88;

/** Opaque fill for iOS marketing icons (Apple rejects alpha / transparency). */
const IOS_ICON_BACKGROUND = '#000008';

/**
 * @param {number} size
 * @param {{ flattenBackground?: string }} [options]
 *   When flattenBackground is set, composites onto that solid color and
 *   strips the alpha channel (required for App Store 1024×1024 icons).
 */
async function renderAppIcon(size, options = {}) {
  const meta = await sharp(SOURCE).metadata();
  const srcW = meta.width || 1024;
  const srcH = meta.height || 1024;
  const crop = Math.round(Math.min(srcW, srcH) / ICON_ZOOM);
  const left = Math.round((srcW - crop) / 2);
  const top = Math.round((srcH - crop) / 2);

  let pipeline = sharp(SOURCE)
    .extract({ left, top, width: crop, height: crop })
    .resize(size, size, { fit: 'fill' });

  if (options.flattenBackground) {
    pipeline = pipeline
      .flatten({ background: options.flattenBackground })
      .removeAlpha();
  }

  return pipeline.png();
}

module.exports = { SOURCE, ICON_ZOOM, IOS_ICON_BACKGROUND, renderAppIcon };
