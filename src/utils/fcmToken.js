import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '../lib/supabase';

async function waitForApnsToken(messaging, getAPNSToken, attempts = 12, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const apns = await getAPNSToken(messaging);
      if (apns) return apns;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function registerFcmToken(userId) {
  try {
    const {
      getMessaging,
      requestPermission,
      AuthorizationStatus,
      getToken,
      onTokenRefresh,
      registerDeviceForRemoteMessages,
      isDeviceRegisteredForRemoteMessages,
      getAPNSToken,
    } = require('@react-native-firebase/messaging');

    // Android 13+: system notification permission (required for tray popups).
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      } catch (_) {}
    }

    try {
      const notifee = require('@notifee/react-native').default;
      await notifee.requestPermission({
        alert: true,
        badge: true,
        sound: true,
        announcement: true,
        criticalAlert: false,
        provisional: false,
      });
    } catch (_) {}

    const messaging = getMessaging();

    // Ask for notification permission BEFORE registering with APNs / fetching FCM token.
    const authStatus = await requestPermission(messaging, {
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    });
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('FCM permission not granted — push popups will not work');
      return;
    }

    // iOS: must have an APNs device token before getToken() or FCM returns empty / throws.
    if (Platform.OS === 'ios') {
      try {
        const registered =
          typeof isDeviceRegisteredForRemoteMessages === 'function'
            ? !!isDeviceRegisteredForRemoteMessages(messaging)
            : false;
        if (!registered && typeof registerDeviceForRemoteMessages === 'function') {
          await registerDeviceForRemoteMessages(messaging);
        }
      } catch (regErr) {
        console.warn('iOS registerDeviceForRemoteMessages failed:', regErr?.message || regErr);
      }

      const apns = await waitForApnsToken(messaging, getAPNSToken);
      if (!apns) {
        console.warn(
          'iOS APNs token missing — FCM push will not work. Use a physical device, enable Push Notifications capability, and upload an APNs Auth Key (.p8) in Firebase Console → Project Settings → Cloud Messaging.',
        );
        return;
      }
    }

    const token = await getToken(messaging);
    if (!token || !userId) {
      console.warn('FCM getToken returned empty — check GoogleService-Info.plist / google-services.json');
      return;
    }

    console.log('FCM token registered for', Platform.OS, token.slice(0, 12) + '…');

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', userId);

    if (error) {
      console.warn('Failed to save fcm_token:', error.message);
      return;
    }

    onTokenRefresh(messaging, async newToken => {
      await supabase
        .from('profiles')
        .update({ fcm_token: newToken })
        .eq('id', userId);
    });
  } catch (err) {
    console.warn('FCM token registration failed:', err?.message || err);
  }
}
