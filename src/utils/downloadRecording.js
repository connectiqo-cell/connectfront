import { Platform, PermissionsAndroid } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  CameraRoll,
  iosRequestAddOnlyGalleryPermission,
} from '@react-native-camera-roll/camera-roll';
import { normalizeRecordingUrl } from '../api/api';

const GALLERY_ALBUM = 'ConnectIQO';

function recordingFileName(url) {
  const segment = (url || '').split('?')[0].split('/').pop() || '';
  const base = segment.replace(/[^\w.-]/g, '_') || `recording-${Date.now()}`;
  return base.toLowerCase().endsWith('.mp4') ? base : `${base}.mp4`;
}

function isGalleryPermissionGranted(status) {
  return status === 'granted' || status === 'limited';
}

async function ensureGallerySavePermission() {
  if (Platform.OS === 'ios') {
    const status = await iosRequestAddOnlyGalleryPermission();
    return isGalleryPermissionGranted(status);
  }

  if (Platform.OS !== 'android') {
    return true;
  }

  // API 29+ saves via MediaStore, which needs no permission for the app's own files.
  const apiLevel = Platform.Version;
  if (apiLevel >= 29) {
    return true;
  }

  if (apiLevel >= 23) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
}

function localUriForCameraRoll(filePath) {
  if (!filePath) return filePath;
  if (filePath.startsWith('file://')) return filePath;
  return Platform.OS === 'ios' ? filePath : `file://${filePath}`;
}

/**
 * Downloads a session recording and saves it to the device photo gallery.
 * @param {string} rawUrl
 * @returns {Promise<void>}
 */
export async function downloadRecordingToGallery(rawUrl) {
  const url = normalizeRecordingUrl(rawUrl);
  if (!url) {
    throw new Error('Recording URL is unavailable');
  }

  const permitted = await ensureGallerySavePermission();
  if (!permitted) {
    throw new Error('Gallery permission is required to save recordings');
  }

  const cachePath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${recordingFileName(url)}`;

  const response = await ReactNativeBlobUtil.config({
    fileCache: true,
    path: cachePath,
  }).fetch('GET', url);

  const savedPath = response.path();
  if (!savedPath) {
    throw new Error('Could not download recording');
  }

  try {
    await CameraRoll.saveAsset(localUriForCameraRoll(savedPath), {
      type: 'video',
      album: GALLERY_ALBUM,
    });
  } finally {
    try {
      await ReactNativeBlobUtil.fs.unlink(savedPath);
    } catch {
      // ignore cache cleanup errors
    }
  }
}
