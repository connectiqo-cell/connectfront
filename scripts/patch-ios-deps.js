/**
 * Patches iOS native dependencies after npm install.
 * - react-native-webrtc: undo incorrect enum renames (WebRTC-SDK 125 uses FrameCryptionState)
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

  // WebRTC-SDK 125.x Obj-C headers expose FrameCryptionState* (not RTCFrameCryptorState* / FrameEncryptionState*).
  content = content.replace(/RTCFrameCryptorState/g, 'FrameCryptionState');
  content = content.replace(/FrameEncryptionState/g, 'FrameCryptionState');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-ios-deps] Restored WebRTCModule+RTCFrameCryptor.m to FrameCryptionState');
  }
}

patchWebRTCFrameCryptor(WEBRTC_CRYPTOR);
