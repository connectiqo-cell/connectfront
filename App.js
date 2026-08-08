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
import { loadRemoteConfig } from "./src/utils/remoteConfig";
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

    let unsubscribeForeground;
    try {
      const { getMessaging, onMessage } = require('@react-native-firebase/messaging');
      const messaging = getMessaging();
      // App OPEN: show WhatsApp-style in-app banner + tray entry via Notifee.
      unsubscribeForeground = onMessage(messaging, async remoteMessage => {
        try {
          const data = remoteMessage?.data || {};
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

    return () => { unsubscribeForeground?.(); };
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
                  <AppNavigation navigationRef={navigationRef} />
                </PushBannerProvider>
              </NotificationProvider>
            </AvatarPreviewProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
