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
 * Buffering tuned for a short-form feed, not long-form video.
 *
 * ExoPlayer defaults to bufferForPlaybackMs: 2500 — it withholds playback until
 * 2.5 seconds are buffered. That is sensible for a film and terrible for a feed,
 * where it shows as a visible pause on every swipe. 500ms starts almost instantly;
 * the clips are short enough that a deep buffer buys nothing.
 */
export const FEED_BUFFER_CONFIG = {
  minBufferMs: 2500,
  maxBufferMs: 15000,
  bufferForPlaybackMs: 500,
  bufferForPlaybackAfterRebufferMs: 1500,
};

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
