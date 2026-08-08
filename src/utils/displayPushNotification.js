import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidStyle,
  AndroidVisibility,
} from '@notifee/react-native';

const CHANNEL_ID = 'session_heads_up';
/** Connectiqo brand accent — tints the small status-bar icon (WhatsApp/Spotify style). */
const BRAND_COLOR = '#6D4AFF';
const APP_NAME = 'Connectiqo';
const LARGE_ICON = require('../assets/images/connectiqo_logo.png');

let channelReady = false;

export async function ensureNotificationChannel() {
  if (channelReady) return;
  // New channel id — Android ignores importance changes on an existing channel.
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Session alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [180, 120, 180],
    lights: true,
    lightColor: BRAND_COLOR,
  });
  // Keep legacy channel for older scheduled reminders.
  await notifee.createChannel({
    id: 'session_reminders',
    name: 'Sessions & updates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
  channelReady = true;
}

function cleanTitle(raw) {
  if (!raw) return APP_NAME;
  return String(raw)
    .replace(/^[\s\uFE0F\u200D\u2600-\u27BF\uFE00-\uFE0F\uD83C-\uDBFF\uDC00-\uDFFF]+/g, '')
    .trim() || APP_NAME;
}

/**
 * Show a heads-up notification.
 * Android does NOT auto-popup while the app is open — this must run from FCM onMessage.
 */
export async function displayPushNotification({
  title,
  body,
  data = {},
  id,
}) {
  await ensureNotificationChannel();

  const sender = cleanTitle(data.senderName || title);
  const message = body || '';
  const notificationId =
    id || data.bookingId || `push_${Date.now()}`;

  const payloadData = Object.fromEntries(
    Object.entries({
      ...data,
      title: title || APP_NAME,
      body: message,
    }).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );

  const baseAndroid = {
    channelId: CHANNEL_ID,
    smallIcon: 'ic_notification',
    largeIcon: LARGE_ICON,
    circularLargeIcon: true,
    color: BRAND_COLOR,
    colorized: true,
    importance: AndroidImportance.HIGH,
    category: AndroidCategory.MESSAGE,
    visibility: AndroidVisibility.PUBLIC,
    showTimestamp: true,
    timestamp: Date.now(),
    pressAction: {
      id: 'default',
      launchActivity: 'default',
    },
    actions: [
      {
        title: 'View',
        pressAction: { id: 'view', launchActivity: 'default' },
      },
      {
        title: 'Dismiss',
        pressAction: { id: 'dismiss' },
      },
    ],
  };

  try {
    await notifee.displayNotification({
      id: notificationId,
      title: sender,
      body: message,
      data: payloadData,
      android: {
        ...baseAndroid,
        style: {
          type: AndroidStyle.BIGTEXT,
          text: message,
        },
      },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          badge: true,
          sound: true,
          banner: true,
          list: true,
        },
      },
    });
  } catch (err) {
    console.warn('Rich notification failed, falling back to simple:', err?.message || err);
    await notifee.displayNotification({
      id: notificationId,
      title: sender,
      body: message,
      data: payloadData,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  }
}

/** Map an FCM remoteMessage into our Notifee UI (used when app is open). */
export async function displayFromRemoteMessage(remoteMessage) {
  const data = remoteMessage?.data || {};
  const title =
    data.title ||
    remoteMessage?.notification?.title ||
    APP_NAME;
  const body =
    data.body ||
    remoteMessage?.notification?.body ||
    '';

  if (!title && !body) {
    console.warn('FCM message had no title/body — nothing to display');
    return;
  }

  await displayPushNotification({
    title,
    body,
    data,
    id: data.bookingId || data.type || undefined,
  });
}
