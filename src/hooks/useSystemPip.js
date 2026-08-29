import { useEffect } from 'react';
import { Platform } from 'react-native';

let PipHandler = null;
let usePipModeListenerImpl = () => false;

if (Platform.OS === 'android') {
  try {
    const pipAndroid = require('@videosdk.live/react-native-pip-android');
    PipHandler = pipAndroid.default;
    if (typeof pipAndroid.usePipModeListener === 'function') {
      usePipModeListenerImpl = pipAndroid.usePipModeListener;
    }
  } catch (_) {
    PipHandler = null;
  }
}

/**
 * Enables WhatsApp-style Android system Picture-in-Picture while a call is active.
 * Home / Recents enter PiP automatically when `active` is true.
 * No-op on iOS (system PiP needs a separate native bridge).
 */
export function useSystemPip(active = false) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !active || !PipHandler?.setMeetingScreenState) {
      return undefined;
    }

    // Portrait-ish aspect similar to WhatsApp call PiP
    try {
      PipHandler.setDefaultPipDimensions?.(9, 16);
    } catch (_) {}

    try {
      PipHandler.setMeetingScreenState(true);
    } catch (_) {}

    return () => {
      try {
        PipHandler.setMeetingScreenState(false);
      } catch (_) {}
    };
  }, [active]);
}

/** Enter Android system PiP manually (minimize call). */
export function enterSystemPip(width = 9, height = 16) {
  if (Platform.OS !== 'android' || !PipHandler?.enterPipMode) {
    return;
  }
  try {
    PipHandler.enterPipMode(width, height);
  } catch (_) {}
}

/** True when the activity is currently in Android system PiP. Always false on iOS. */
export function useIsInSystemPip() {
  return !!usePipModeListenerImpl();
}
