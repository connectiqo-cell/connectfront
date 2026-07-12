import React from "react";

import "react-native-gesture-handler";

import {

  NavigationContainer,

  DefaultTheme,

} from "@react-navigation/native";

import { UNIFIED_THEME } from "./src/unifiedTheme";

import CosmicBackground from "./src/components/CosmicBackground";

import { LogBox, View, StyleSheet } from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "./src/components/ErrorBoundary";

import { AuthProvider } from "./src/contexts/AuthContext";
import { AvatarPreviewProvider } from "./src/contexts/AvatarPreviewContext";

import { NotificationProvider } from "./src/contexts/NotificationContext";

import { RootNavigator } from "./src/navigators/RootNavigator";

import { SCREEN_NAMES } from "./src/navigators/screenNames";

import { linking } from "./src/navigators/linkingConfig";

import { loadRemoteConfig } from "./src/utils/remoteConfig";

import notifee, { AndroidImportance } from "@notifee/react-native";



LogBox.ignoreLogs([

  "Warning: Non-serializable values detected",

  "Animated: `useNativeDriver`"

]);



const VOID_BG = UNIFIED_THEME.colors.primary.void;



const navigationTheme = {

  ...DefaultTheme,

  colors: {

    ...DefaultTheme.colors,

    background: VOID_BG,

    card: VOID_BG,

    border: UNIFIED_THEME.colors.border.light,

  },

};



const styles = StyleSheet.create({

  appRoot: {

    flex: 1,

    position: "relative",

  },

  navShell: {

    flex: 1,

  },

});



export default function App() {

  const navigationRef = React.useRef();



  React.useEffect(() => {

    loadRemoteConfig();



    // Create notification channel on startup (Android requires this)

    notifee.createChannel({

      id: 'session_reminders',

      name: 'Session Reminders',

      importance: AndroidImportance.HIGH,

      sound: 'default',

    });



    // Show FCM notifications when app is in foreground

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

        <AuthProvider>

          <AvatarPreviewProvider>

          <NotificationProvider>

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

          </NotificationProvider>

          </AvatarPreviewProvider>

        </AuthProvider>

      </SafeAreaProvider>

    </ErrorBoundary>

  );

}

