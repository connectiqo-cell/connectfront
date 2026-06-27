import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import ScreenProtector, { addScreenshotListener } from 'react-native-screenshot-prevent';

export function useScreenProtection() {
  const [isRecordingDetected, setIsRecordingDetected] = useState(false);

  useEffect(() => {
    ScreenProtector.enableSecureView();

    let intervalId;
    let listener;

    if (Platform.OS === 'ios') {
      // Android FLAG_SECURE already blocks recording at OS level.
      // On iOS we poll UIScreen.isCaptured and surface a blocker overlay.
      intervalId = setInterval(async () => {
        try {
          const recording = await ScreenProtector.isScreenRecording();
          setIsRecordingDetected(prev => prev !== recording ? recording : prev);
        } catch (_) {}
      }, 1000);

      listener = addScreenshotListener(() => {
        console.warn('Screenshot attempted during a protected video call session.');
      });
    }

    return () => {
      ScreenProtector.disableSecureView();
      clearInterval(intervalId);
      listener?.remove?.();
    };
  }, []);

  return { isRecordingDetected };
}
