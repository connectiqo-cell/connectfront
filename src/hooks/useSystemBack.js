import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Android hardware / gesture back for stack overlay screens.
 * Registers on focus so it runs before NavigationContainer's global handler.
 * Pass onBack to intercept (e.g. unsaved-changes prompt); omit for navigation.goBack().
 */
export function useSystemBack(navigation, onBack) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (typeof onBack === 'function') {
          onBack();
          return true;
        }
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return true;
        }
        return false;
      });

      return () => subscription.remove();
    }, [navigation, onBack]),
  );
}

/** screenListeners factory for RootNavigator overlay groups. */
export function createAndroidOverlayBackListeners() {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  return ({ navigation }) => {
    let subscription = null;

    return {
      focus: () => {
        subscription = BackHandler.addEventListener('hardwareBackPress', () => {
          if (navigation.canGoBack()) {
            navigation.goBack();
            return true;
          }
          return false;
        });
      },
      blur: () => {
        subscription?.remove();
        subscription = null;
      },
    };
  };
}
