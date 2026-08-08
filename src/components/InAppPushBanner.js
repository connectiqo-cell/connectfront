import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { usePushBanner } from '../contexts/PushBannerContext';
import { useTheme } from '../hooks/useTheme';
import { SCREEN_NAMES } from '../navigators/screenNames';

const LOGO = require('../assets/images/connectiqo_logo.png');

/**
 * WhatsApp / Instagram style in-app heads-up banner.
 * Used when the app is open — Android won't show a system popup in foreground.
 */
export default function InAppPushBanner({ navigationRef }) {
  const { banner, hideBanner } = usePushBanner();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!banner) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    translateY.setValue(-140);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [banner, translateY, opacity]);

  const onPress = () => {
    hideBanner();
    const nav = navigationRef?.current;
    if (!nav?.navigate) return;

    const type = banner?.data?.type || '';
    try {
      if (type === 'meeting_started') {
        const bookingId = banner?.data?.bookingId;
        if (bookingId) {
          nav.navigate(SCREEN_NAMES.VideoCall, {
            bookingId,
            isHost: false,
          });
        } else {
          nav.navigate(SCREEN_NAMES.RootUnifiedTabs, {
            screen: SCREEN_NAMES.LearnerSection,
            params: { screen: SCREEN_NAMES.LearnerBookings },
          });
        }
        return;
      }
      if (type === 'new_booking' || type.startsWith('reschedule')) {
        nav.navigate(SCREEN_NAMES.RootUnifiedTabs, {
          screen: SCREEN_NAMES.MentorSection,
          params: { screen: SCREEN_NAMES.MentorCalls },
        });
        return;
      }
      if (type.startsWith('booking_')) {
        nav.navigate(SCREEN_NAMES.RootUnifiedTabs, {
          screen: SCREEN_NAMES.LearnerSection,
          params: { screen: SCREEN_NAMES.LearnerBookings },
        });
        return;
      }
      nav.navigate(SCREEN_NAMES.Notifications);
    } catch (_) {
      // ignore nav errors
    }
  };

  if (!banner) return null;

  const cardBg = isDark ? 'rgba(28, 28, 36, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const titleColor = theme.colors.text.primary;
  const bodyColor = theme.colors.text.secondary || (isDark ? '#B0B0BC' : '#5C5C66');
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.wrap,
          {
            paddingTop: Math.max(insets.top, 8) + 4,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: border,
              opacity: pressed ? 0.92 : 1,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOpacity: 0.22,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                },
                android: { elevation: 10 },
              }),
            },
          ]}
        >
          <Image source={LOGO} style={styles.avatar} />
          <View style={styles.textCol}>
            <Text style={[styles.appLabel, { color: bodyColor }]} numberOfLines={1}>
              Connectiqo
            </Text>
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
              {banner.title}
            </Text>
            {!!banner.body && (
              <Text style={[styles.body, { color: bodyColor }]} numberOfLines={2}>
                {banner.body}
              </Text>
            )}
          </View>
          <Pressable
            onPress={hideBanner}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Dismiss"
          >
            <MaterialIcons name="close" size={18} color={bodyColor} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  wrap: {
    paddingHorizontal: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 72,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  textCol: {
    flex: 1,
    paddingRight: 4,
  },
  appLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 8,
  },
});
