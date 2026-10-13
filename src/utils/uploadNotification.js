import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

const CHANNEL_ID = 'video_uploads';
const BRAND_COLOR = '#6D4AFF';

let channelReady = false;
let serviceRegistered = false;
let serviceRunning = false;

/**
 * Register the foreground-service runner once, at module load.
 *
 * Android kills a backgrounded app's network work; a foreground service is the
 * only supported way to keep an upload going. The runner never resolves on its
 * own — `stopUploadService()` ends it when the queue drains.
 *
 * Android only. iOS has no equivalent: continuing work after backgrounding there
 * needs a background URLSession, which a JS/XHR upload cannot use.
 */
export function registerUploadService() {
  if (serviceRegistered || Platform.OS !== 'android') return;
  serviceRegistered = true;
  notifee.registerForegroundService(() => new Promise(() => {}));
}

export async function stopUploadService() {
  if (!serviceRunning || Platform.OS !== 'android') return;
  serviceRunning = false;
  try {
    await notifee.stopForegroundService();
  } catch (e) {
    console.warn('[uploadNotification] stopForegroundService failed:', e?.message || e);
  }
}

async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Video uploads',
    // LOW: a progress bar that buzzes on every percent would be unusable.
    importance: AndroidImportance.LOW,
    vibration: false,
  });
  channelReady = true;
}

/**
 * Live progress in the notification shade while a video uploads.
 *
 * Android only. iOS has no ongoing/progress notification — notifications there are
 * discrete alerts, so iOS users get the completion notice instead of a moving bar.
 */
export async function showUploadProgress(id, title, pct, phase) {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannel();
    serviceRunning = true;
    await notifee.displayNotification({
      id,
      title: phase === 'compressing' ? 'Preparing video' : 'Uploading video',
      body: title,
      android: {
        channelId: CHANNEL_ID,
        color: BRAND_COLOR,
        smallIcon: 'ic_notification',
        onlyAlertOnce: true,
        ongoing: true,
        autoCancel: false,
        // Promotes the process to a foreground service so the upload survives
        // the app being backgrounded.
        asForegroundService: true,
        pressAction: { id: 'default' },
        progress: { max: 100, current: Math.max(0, Math.min(100, pct || 0)) },
      },
    });
  } catch (e) {
    // A missing notification permission must never break the upload itself.
    console.warn('[uploadNotification] progress failed:', e?.message || e);
  }
}

export async function showUploadDone(id, title, { failed = false } = {}) {
  try {
    await ensureChannel();
    await notifee.displayNotification({
      id,
      title: failed ? 'Upload failed' : 'Video uploaded',
      body: failed ? `${title} — open the app to retry` : title,
      android: {
        channelId: CHANNEL_ID,
        color: BRAND_COLOR,
        smallIcon: 'ic_notification',
        ongoing: false,
        autoCancel: true,
        pressAction: { id: 'default' },
      },
    });
  } catch (e) {
    console.warn('[uploadNotification] done failed:', e?.message || e);
  }
}

export async function clearUploadNotification(id) {
  try {
    await notifee.cancelNotification(id);
  } catch {
    // nothing to cancel
  }
}
