import { InteractionManager, Platform } from 'react-native';
import VideosdkRPK from '../../VideosdkRPK';

export function runAfterOverlayDismiss(action) {
  if (Platform.OS === 'ios') {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(action, 350);
    });
    return;
  }
  action();
}

/**
 * Start/stop screen sharing with the correct flow per platform.
 * Android: toggleScreenShare via MediaProjection.
 * iOS: ReplayKit broadcast picker to start, disableScreenShare to stop.
 */
export function pressScreenShare({
  localScreenShareOn,
  presenterId,
  toggleScreenShare,
  disableScreenShare,
  afterDismiss = runAfterOverlayDismiss,
}) {
  afterDismiss(() => {
    if (presenterId != null && !localScreenShareOn) {
      return;
    }

    if (Platform.OS === 'android') {
      toggleScreenShare({ enableAudio: false });
      return;
    }

    if (localScreenShareOn) {
      disableScreenShare();
    } else {
      VideosdkRPK.startBroadcast();
    }
  });
}
