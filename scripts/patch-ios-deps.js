/**
 * Patches iOS native dependencies after npm install.
 * - react-native-webrtc: FrameCryptionState -> RTCFrameCryptorState (WebRTC-SDK / Xcode 26+)
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

  // WebRTC-SDK m125+ uses RTCFrameCryptorState; older react-native-webrtc still references FrameCryptionState.
  content = content.replace(/FrameEncryptionState/g, 'RTCFrameCryptorState');
  content = content.replace(/FrameCryptionState/g, 'RTCFrameCryptorState');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[patch-ios-deps] Patched WebRTCModule+RTCFrameCryptor.m');
  }
}

patchWebRTCFrameCryptor(WEBRTC_CRYPTOR);
