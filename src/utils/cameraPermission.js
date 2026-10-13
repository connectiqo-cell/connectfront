import { Linking, PermissionsAndroid, Platform } from 'react-native';

/** Request camera access before mounting a scanner preview. */
export async function ensureCameraPermission() {
  if (Platform.OS === 'android') {
    const current = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (current) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera permission',
        message: 'Connectiqo needs the camera to scan creator profile QR codes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  try {
    const { default: InCallManager } = require('@videosdk.live/react-native-incallmanager');
    const status = await InCallManager.requestCameraPermission();
    return status === 'granted' || status === true || status === 'authorized';
  } catch {
    // Info.plist already declares camera use; let the scanner try.
    return true;
  }
}

export function openAppCameraSettings() {
  Linking.openSettings().catch(() => undefined);
}
