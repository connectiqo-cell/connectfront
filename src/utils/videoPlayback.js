import { Platform } from 'react-native';

/**
 * Phone-call / Control Center overlays often set AppState to `inactive`
 * (not `background`). Content video should keep playing in that case.
 *
 * Android reports `unknown` (or null) before the first AppState event, so
 * anything other than `background` counts as foreground — otherwise playback
 * stays gated off until the app is backgrounded once.
 */
export function isAppForegroundForMedia(appState) {
  return appState !== 'background';
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
