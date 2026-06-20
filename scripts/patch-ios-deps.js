/**
 * Patches iOS native dependencies after npm install.
 * - react-native-webrtc: align frame cryptor enum with WebRTC-SDK Obj-C headers
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

function patchWebRTCFrameCryptor(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('[patch-ios-deps] WebRTCModule+RTCFrameCryptor.m not found, skipping');
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // WebRTC-SDK Obj-C headers expose FrameEncryptionState* (not RTCFrameCryptorState*).
  content = content.replace(/RTCFrameCryptorState/g, 'FrameEncryptionState');
  content = content.replace(/FrameCryptionState/g, 'FrameEncryptionState');
  // Keep JS event name stable (do not rename kEventFrameCryptionStateChanged).
  content = content.replace(/kEventFrameEncryptionStateChanged/g, 'kEventFrameCryptionStateChanged');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-ios-deps] Patched WebRTCModule+RTCFrameCryptor.m (FrameEncryptionState)');
  }
}

patchWebRTCFrameCryptor(WEBRTC_CRYPTOR);
