import React, { useMemo, useRef } from "react";

import "react-native-gesture-handler";

import {
  NavigationContainer,
  DefaultTheme,
} from "@react-navigation/native";

import CosmicBackground from "./src/components/CosmicBackground";
import { LogBox, View, StyleSheet, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { AuthProvider } from "./src/contexts/AuthContext";
import { AvatarPreviewProvider } from "./src/contexts/AvatarPreviewContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { useTheme } from "./src/hooks/useTheme";
import { RootNavigator } from "./src/navigators/RootNavigator";
import { SCREEN_NAMES } from "./src/navigators/screenNames";
import { linking } from "./src/navigators/linkingConfig";
import { loadRemoteConfig } from "./src/utils/remoteConfig";
import notifee, { AndroidImportance } from "@notifee/react-native";

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
      </View>
    </>
  );
}

export default function App() {
  const navigationRef = React.useRef();

  React.useEffect(() => {
    loadRemoteConfig();

    notifee.createChannel({
      id: 'session_reminders',
      name: 'Session Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    let unsubscribeForeground;
    try {
      const { getMessaging, onMessage } = require('@react-native-firebase/messaging');
      const messaging = getMessaging();
      unsubscribeForeground = onMessage(messaging, async remoteMessage => {
        await notifee.displayNotification({
          title: remoteMessage.notification?.title || 'Connectiqo',
          body:  remoteMessage.notification?.body  || '',
          android: {
            channelId:   'session_reminders',
            smallIcon:   'ic_notification',
            pressAction: { id: 'default' },
          },
        });
      });
    } catch (_) {}

    return () => { unsubscribeForeground?.(); };
  }, []);

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
                <AppNavigation navigationRef={navigationRef} />
              </NotificationProvider>
            </AvatarPreviewProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
