import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

let eventEmitter = null;
let routeListener = null;
let iosCallSessionActive = false;

function getInCallManager() {
  // Lazy load — only invoked on iOS (Android uses VideoSDK's default flow).
  return require('@videosdk.live/react-native-incallmanager').default;
}

/**
 * VideoSDK calls InCallManager.start() only after onMeetingJoined, but WebRTC
 * configures AVAudioSession during join while the category is still Ambient
 * (e.g. after react-native-video). Starting early avoids OSStatus -50 errors.
 */
export async function ensureIosCallAudioSession() {
  if (Platform.OS !== 'ios') {
    return true;
  }

  attachIosCallAudioListeners();

  const InCallManager = getInCallManager();

  // Session already started — skip repeated native permission prompts.
  if (iosCallSessionActive) {
    try {
      InCallManager.setForceSpeakerphoneOn(true);
    } catch (_) {}
    return true;
  }

  const mic = await InCallManager.requestRecordPermission();
  if (mic !== 'granted') {
    return false;
  }

  const camera = await InCallManager.requestCameraPermission();
  if (camera !== 'granted') {
    return false;
  }

  InCallManager.start({ media: 'video' });
  iosCallSessionActive = true;
  InCallManager.setForceSpeakerphoneOn(true);

  return true;
}

function attachIosCallAudioListeners() {
  if (routeListener) {
    return;
  }

  const { InCallManager: nativeModule } = NativeModules;
  if (!nativeModule) {
    return;
  }

  eventEmitter = new NativeEventEmitter(nativeModule);
  routeListener = () => {};
  eventEmitter.addListener('onAudioDeviceChanged', routeListener);
}

function detachIosCallAudioListeners() {
  if (eventEmitter && routeListener) {
    eventEmitter.removeListener('onAudioDeviceChanged', routeListener);
  }
  eventEmitter = null;
  routeListener = null;
}

/**
 * Clear our session tracking without calling InCallManager.stop().
 * VideoSDK MeetingProvider already calls terminate() → stop() on leave/unmount;
 * a second native stop on iOS can crash the app.
 */
export function markIosCallAudioSessionEnded() {
  if (Platform.OS !== 'ios' || !iosCallSessionActive) {
    return;
  }
  iosCallSessionActive = false;
  detachIosCallAudioListeners();
}

/** Full release — use only when the meeting never joined (lobby bail-out). */
export function releaseIosCallAudioSession() {
  if (Platform.OS !== 'ios' || !iosCallSessionActive) {
    return;
  }

  iosCallSessionActive = false;

  try {
    getInCallManager().stop();
  } catch (_) {
    // MeetingProvider may already have stopped the session.
  }

  detachIosCallAudioListeners();
}

/** Last-resort stop when leaving a call — safe to call even if VideoSDK already stopped. */
export function forceStopIosCallAudioSession() {
  if (Platform.OS !== 'ios') {
    return;
  }

  iosCallSessionActive = false;
  detachIosCallAudioListeners();

  try {
    getInCallManager().stop();
  } catch (_) {
    // Native module may already be stopped.
  }
}
