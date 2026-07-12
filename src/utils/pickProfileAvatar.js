import { Alert, Platform } from 'react-native';
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

function promptPhotoSource({ title, message }) {
  return new Promise(resolve => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Take Photo', onPress: () => resolve('camera') },
        { text: 'Choose from Library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

async function resolvePhotoSource(source, prompt) {
  if (source === 'camera' || source === 'library') return source;
  return promptPhotoSource(prompt);
}

async function openProfileImage(source, options) {
  const picker = source === 'camera' ? ImagePicker.openCamera : ImagePicker.openPicker;
  return picker(options);
}

/**
 * Opens the camera or gallery, then shows a circular native crop UI for profile avatars.
 *
 * @param {{ source?: 'camera' | 'library' }} [options]
 * @returns {Promise<{ base64: string, mimeType: string, fileName: string } | null>}
 */
export async function pickProfileAvatar({ source } = {}) {
  const resolvedSource = await resolvePhotoSource(source, {
    title: 'Profile photo',
    message: 'Take a new photo or choose one from your library',
  });
  if (!resolvedSource) return null;

  try {
    const image = await openProfileImage(resolvedSource, {
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
 * Opens the camera or gallery, then shows a wide rectangular native crop UI for profile covers.
 *
 * @param {{ source?: 'camera' | 'library' }} [options]
 * @returns {Promise<{ base64: string, mimeType: string, fileName: string } | null>}
 */
export async function pickProfileCover({ source } = {}) {
  const resolvedSource = await resolvePhotoSource(source, {
    title: 'Cover photo',
    message: 'Take a new photo or choose one from your library',
  });
  if (!resolvedSource) return null;

  try {
    const image = await openProfileImage(resolvedSource, {
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
