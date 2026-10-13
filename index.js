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
import { openFromPush } from "./src/utils/pushNavigation";
import { registerUploadService } from "./src/utils/uploadNotification";

StatusBar.setBackgroundColor(colors.primary[900]);

// Required by notifee — must be registered before AppRegistry
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'dismiss') {
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
    return;
  }
  // Tapped while the app was in the background: remember where to go; the app
  // navigates as soon as it is back in front (see pushNavigation.js).
  if (
    type === EventType.PRESS ||
    (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'view')
  ) {
    openFromPush(detail.notification?.data);
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

// Must run before the app mounts: notifee resolves the foreground-service runner
// at startup, and a video upload needs it to survive backgrounding.
registerUploadService();

AppRegistry.registerComponent(appName, () => App);
