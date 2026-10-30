import React, { useMemo, useRef } from "react";

import "react-native-gesture-handler";

import {
  NavigationContainer,
  DefaultTheme,
} from "@react-navigation/native";

import CosmicBackground from "./src/components/CosmicBackground";
import InAppPushBanner from "./src/components/InAppPushBanner";
import { LogBox, View, StyleSheet, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import ForceUpdateGate from "./src/components/ForceUpdateGate";
import { AuthProvider } from "./src/contexts/AuthContext";
import { AvatarPreviewProvider } from "./src/contexts/AvatarPreviewContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import {
  PushBannerProvider,
  usePushBanner,
} from "./src/contexts/PushBannerContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { useTheme } from "./src/hooks/useTheme";
import { RootNavigator } from "./src/navigators/RootNavigator";
import { SCREEN_NAMES } from "./src/navigators/screenNames";
import { linking } from "./src/navigators/linkingConfig";
import notifee, { EventType } from "@notifee/react-native";
import { loadRemoteConfig } from "./src/utils/remoteConfig";
import {
  flushPushNavigation,
  openFromPush,
  setPushNavigationRef,
} from "./src/utils/pushNavigation";
import {
  displayFromRemoteMessage,
  ensureNotificationChannel,
} from "./src/utils/displayPushNotification";

LogBox.ignoreLogs([
  "Warning: Non-serializable values detected",
  "Animated: `useNativeDriver`"
]);

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    position: "relative",
  },
  navShell: {
    flex: 1,
  },
});

function AppNavigation({ navigationRef }) {
  const { theme, isDark } = useTheme();
  const { showBanner } = usePushBanner();

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        background: theme.colors.primary.void,
        card: theme.colors.primary.void,
        border: theme.colors.border.light,
        text: theme.colors.text.primary,
        primary: theme.colors.accent.primary,
      },
    }),
    [theme, isDark],
  );

  React.useEffect(() => {
    loadRemoteConfig();
    ensureNotificationChannel();

    setPushNavigationRef(navigationRef);

    // Tray notification shown by Notifee (app was open when the push arrived) → tapped.
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      const isTap =
        type === EventType.PRESS ||
        (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'view');
      if (isTap) openFromPush(detail.notification?.data);
    });
    // App was KILLED and opened by tapping a Notifee notification.
    notifee.getInitialNotification()
      .then(initial => { if (initial) openFromPush(initial.notification?.data); })
      .catch(() => {});

    let unsubscribeForeground;
    let unsubscribeOpened;
    try {
      const {
        getMessaging,
        onMessage,
        onNotificationOpenedApp,
        getInitialNotification,
      } = require('@react-native-firebase/messaging');
      const messaging = getMessaging();
      // App in BACKGROUND, user taps the system (FCM) notification.
      unsubscribeOpened = onNotificationOpenedApp(messaging, remoteMessage => {
        openFromPush(remoteMessage?.data);
      });
      // App was KILLED and opened by tapping the system (FCM) notification.
      getInitialNotification(messaging)
        .then(remoteMessage => { if (remoteMessage) openFromPush(remoteMessage.data); })
        .catch(() => {});
      // App OPEN: show WhatsApp-style in-app banner + tray entry via Notifee.
      unsubscribeForeground = onMessage(messaging, async remoteMessage => {
        try {
          const data = remoteMessage?.data || {};

          // Already reading this chat — the thread's realtime feed shows it; no banner/tray.
          const route = navigationRef.current?.getCurrentRoute?.();
          if (
            data.type === 'new_message' &&
            route?.name === SCREEN_NAMES.MessageThread &&
            route?.params?.conversationId === data.conversationId
          ) {
            return;
          }

          const title =
            data.title ||
            remoteMessage?.notification?.title ||
            'Connectiqo';
          const body =
            data.body ||
            remoteMessage?.notification?.body ||
            '';

          showBanner({
            title: data.senderName || title,
            body,
            data,
          });
          await displayFromRemoteMessage(remoteMessage);
        } catch (err) {
          console.warn('Foreground notification display failed:', err?.message || err);
        }
      });
    } catch (err) {
      console.warn('FCM onMessage setup failed:', err?.message || err);
    }

    return () => { unsubscribeForeground?.(); unsubscribeOpened?.(); unsubscribeNotifee(); };
  }, [showBanner]);

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.primary.void}
      />
      <View style={styles.appRoot}>
        <CosmicBackground style={styles.navShell}>
          <View style={styles.navShell}>
            <NavigationContainer
              ref={navigationRef}
              theme={navigationTheme}
              linking={linking}
              // A tapped push waits here until the signed-in screens exist (splash/auth done).
              onReady={flushPushNavigation}
              onStateChange={flushPushNavigation}
            >
              <RootNavigator />
            </NavigationContainer>
          </View>
        </CosmicBackground>
        <InAppPushBanner navigationRef={navigationRef} />
      </View>
    </>
  );
}

export default function App() {
  const navigationRef = React.useRef();

  return (
    <ErrorBoundary
      onReset={() => {
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: SCREEN_NAMES.Welcome }],
        });
      }}
    >
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AvatarPreviewProvider>
              <NotificationProvider>
                <PushBannerProvider>
                  <ForceUpdateGate>
                    <AppNavigation navigationRef={navigationRef} />
                  </ForceUpdateGate>
                </PushBannerProvider>
              </NotificationProvider>
            </AvatarPreviewProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
