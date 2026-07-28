import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Turns the local camera off when the app leaves the foreground during a call,
 * and restores it when the user returns if it was on before.
 */
export function useBackgroundWebcamRestore({
  enabled = true,
  localWebcamOn,
  toggleWebcam,
  changeWebcam,
  frontCameraIdRef,
  onBackgroundLeave,
  backgroundLeaveMs = 3 * 60 * 1000,
}) {
  const localWebcamOnRef = useRef(localWebcamOn);
  const webcamWasOnRef = useRef(false);
  const pausedForBackgroundRef = useRef(false);

  useEffect(() => {
    localWebcamOnRef.current = localWebcamOn;
  }, [localWebcamOn]);

  useEffect(() => {
    if (!enabled || typeof toggleWebcam !== 'function') return undefined;

    const appStateRef = { current: AppState.currentState };
    let bgTimer = null;

    const clearBgTimer = () => {
      if (bgTimer) {
        clearTimeout(bgTimer);
        bgTimer = null;
      }
    };

    const restoreWebcam = async () => {
      if (!pausedForBackgroundRef.current || !webcamWasOnRef.current) {
        pausedForBackgroundRef.current = false;
        return;
      }

      pausedForBackgroundRef.current = false;

      if (Platform.OS === 'ios') {
        try {
          const { ensureIosCallAudioSession } = require('../utils/iosCallAudioSession');
          await ensureIosCallAudioSession();
        } catch (_) {}
      }

      const delay = Platform.OS === 'ios' ? 500 : 300;
      setTimeout(() => {
        if (!webcamWasOnRef.current) return;

        if (localWebcamOnRef.current) {
          // SDK still thinks camera is on (common on iOS) — cycle off then on.
          toggleWebcam();
          setTimeout(() => {
            if (!localWebcamOnRef.current) toggleWebcam();
          }, 250);
        } else {
          toggleWebcam();
        }

        if (changeWebcam && frontCameraIdRef?.current) {
          setTimeout(
            () => changeWebcam(frontCameraIdRef.current),
            Platform.OS === 'ios' ? 1000 : 400,
          );
        }
      }, delay);
    };

    const subscription = AppState.addEventListener('change', nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      const goingToBackground =
        prev === 'active' && /inactive|background/.test(nextState);
      const returningToForeground =
        nextState === 'active' && /inactive|background/.test(prev);

      if (goingToBackground) {
        webcamWasOnRef.current = localWebcamOnRef.current;
        if (localWebcamOnRef.current) {
          pausedForBackgroundRef.current = true;
          toggleWebcam();
        }

        if (typeof onBackgroundLeave === 'function' && backgroundLeaveMs > 0) {
          clearBgTimer();
          bgTimer = setTimeout(onBackgroundLeave, backgroundLeaveMs);
        }
      }

      if (returningToForeground) {
        clearBgTimer();
        restoreWebcam();
      }
    });

    return () => {
      clearBgTimer();
      subscription.remove();
    };
  }, [
    enabled,
    toggleWebcam,
    changeWebcam,
    frontCameraIdRef,
    onBackgroundLeave,
    backgroundLeaveMs,
  ]);
}
