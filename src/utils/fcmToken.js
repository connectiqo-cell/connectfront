import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '../lib/supabase';

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

    // iOS: must register for remote messages before getToken().
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
    }

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

    const token = await getToken(messaging);
    if (!token || !userId) {
      console.warn('FCM getToken returned empty — check GoogleService-Info.plist / google-services.json');
      return;
    }

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
    console.warn('FCM token registration failed:', err);
  }
}
