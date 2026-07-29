import { Platform } from 'react-native';

/**
 * Phone-call / Control Center overlays often set AppState to `inactive`
 * (not `background`). Content video should keep playing in that case.
 */
export function isAppForegroundForMedia(appState) {
  return appState === 'active' || appState === 'inactive';
}

/**
 * Shared audio props for in-app content videos (Welcome, reels, recordings).
 * - playWhenInactive: continue under call UI / system overlays
 * - disableFocus (Android): don't stop when telephony takes audio focus
 * - mixWithOthers: allow mixing with call audio on iOS
 */
export const CONTENT_VIDEO_AUDIO_PROPS = {
  playInBackground: false,
  playWhenInactive: true,
  ignoreSilentSwitch: 'ignore',
  mixWithOthers: 'mix',
  ...(Platform.OS === 'android' ? { disableFocus: true } : {}),
};
