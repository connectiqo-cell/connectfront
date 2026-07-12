import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { UNIFIED_THEME } from '../unifiedTheme';

const C = UNIFIED_THEME.colors;

const AVATAR_SIZE = 512;
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 400;

const sharedCropStyle = {
  mediaType: 'photo',
  includeBase64: true,
  cropperChooseText: 'Use photo',
  cropperCancelText: 'Cancel',
  cropperToolbarColor: C.primary.void,
  cropperToolbarWidgetColor: C.text.primary,
  cropperActiveWidgetColor: C.accent.primary,
  cropperStatusBarLight: false,
  cropperNavigationBarLight: false,
  forceJpg: Platform.OS === 'ios',
};

function toPickedImage(image) {
  if (!image?.data) return null;
  return {
    base64: image.data,
    mimeType: image.mime || 'image/jpeg',
    fileName: image.filename || 'image.jpg',
  };
}

function isPickerCancelled(err) {
  return err?.code === 'E_PICKER_CANCELLED';
}

/**
 * Opens the gallery, then shows a circular native crop UI for profile avatars.
 *
 * @returns {Promise<{ base64: string, mimeType: string, fileName: string } | null>}
 */
export async function pickProfileAvatar() {
  try {
    const image = await ImagePicker.openPicker({
      ...sharedCropStyle,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      cropping: true,
      cropperCircleOverlay: true,
      compressImageQuality: 0.82,
      compressImageMaxWidth: AVATAR_SIZE,
      compressImageMaxHeight: AVATAR_SIZE,
      cropperToolbarTitle: 'Crop profile photo',
    });

    return toPickedImage(image);
  } catch (err) {
    if (isPickerCancelled(err)) return null;
    throw err;
  }
}

/**
 * Opens the gallery, then shows a wide rectangular native crop UI for profile covers.
 *
 * @returns {Promise<{ base64: string, mimeType: string, fileName: string } | null>}
 */
export async function pickProfileCover() {
  try {
    const image = await ImagePicker.openPicker({
      ...sharedCropStyle,
      width: COVER_WIDTH,
      height: COVER_HEIGHT,
      cropping: true,
      cropperCircleOverlay: false,
      compressImageQuality: 0.85,
      compressImageMaxWidth: COVER_WIDTH,
      compressImageMaxHeight: COVER_HEIGHT,
      cropperToolbarTitle: 'Crop cover photo',
    });

    const picked = toPickedImage(image);
    if (!picked) return null;
    return { ...picked, fileName: image.filename || 'cover.jpg' };
  } catch (err) {
    if (isPickerCancelled(err)) return null;
    throw err;
  }
}
