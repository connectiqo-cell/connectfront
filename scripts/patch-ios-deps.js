/**
 * Patches native dependencies after npm install.
 * - react-native-webrtc: undo incorrect enum renames (WebRTC-SDK 125 uses FrameCryptionState)
 * - react-native-pip-android: use default PiP aspect from setDefaultPipDimensions (portrait call PiP)
 */
const fs = require('fs');
const path = require('path');

const WEBRTC_CRYPTOR = path.join(
  __dirname,
  '..',
  'node_modules',
  '@videosdk.live',
  'react-native-webrtc',
  'ios',
  'RCTWebRTC',
  'WebRTCModule+RTCFrameCryptor.m',
);

const ANDROID_PIP_MODULE = path.join(
  __dirname,
  '..',
  'node_modules',
  '@videosdk.live',
  'react-native-pip-android',
  'android',
  'src',
  'main',
  'java',
  'live',
  'videosdk',
  'pipmode',
  'AndroidPipModule.kt',
);

function patchWebRTCFrameCryptor(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('[patch-ios-deps] WebRTCModule+RTCFrameCryptor.m not found, skipping');
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // WebRTC-SDK 125.x Obj-C headers expose FrameCryptionState* (not RTCFrameCryptorState* / FrameEncryptionState*).
  content = content.replace(/RTCFrameCryptorState/g, 'FrameCryptionState');
  content = content.replace(/FrameEncryptionState/g, 'FrameCryptionState');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-ios-deps] Restored WebRTCModule+RTCFrameCryptor.m to FrameCryptionState');
  }
}

function patchAndroidPipModule(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('[patch-ios-deps] AndroidPipModule.kt not found, skipping');
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Use JS-configured default dimensions instead of hardcoded 300x214 landscape.
  content = content.replace(
    /moduleInstance\?\.enterPipMode\(300,\s*214\)/,
    'moduleInstance?.enterPipMode(defaultPipWidth, defaultPipHeight)',
  );
  content = content.replace(
    /private var defaultPipWidth: Int = 300/,
    'private var defaultPipWidth: Int = 9',
  );
  content = content.replace(
    /private var defaultPipHeight: Int = 214/,
    'private var defaultPipHeight: Int = 16',
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-ios-deps] Patched AndroidPipModule.kt for portrait call PiP');
  }
}

patchWebRTCFrameCryptor(WEBRTC_CRYPTOR);
patchAndroidPipModule(ANDROID_PIP_MODULE);
