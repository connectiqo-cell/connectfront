/**
 * @format
 */

import { AppRegistry, StatusBar } from "react-native";
import App from "./App";
import { name as appName } from "./app.json";
import { register } from "@videosdk.live/react-native-sdk";
import notifee, { EventType } from "@notifee/react-native";
import colors from "./src/styles/colors";
import { displayFromRemoteMessage } from "./src/utils/displayPushNotification";

StatusBar.setBackgroundColor(colors.primary[900]);

// Required by notifee — must be registered before AppRegistry
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'dismiss') {
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }
});

// Handle FCM messages when app is in background / killed.
// If FCM already includes a `notification` payload, Android/iOS show the system
// popup themselves — only use Notifee for data-only messages.
try {
  const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async remoteMessage => {
    if (remoteMessage?.notification?.title || remoteMessage?.notification?.body) {
      return;
    }
    await displayFromRemoteMessage(remoteMessage);
  });
} catch (_) {}

// Register the service
register();

AppRegistry.registerComponent(appName, () => App);
