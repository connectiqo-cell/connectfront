import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { iosGradientTextBlock } from '../utils/platformLayout';
import { scaleUi } from '../utils/iosUiScale';
import { useAvatarPreview } from '../contexts/AvatarPreviewContext';
import { cardFill, isLightMode, softBorder } from '../theme/surfaceStyles';

export function MentorImageCard({ mentor, onPress, style, entranceDelay }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const GOLD = C.accent.primary;
  const { showAvatarPreview } = useAvatarPreview();
  const name = mentor.profiles?.name || 'Unknown';
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = mentor.profiles?.avatar_url;
  const rating = mentor.rating != null && mentor.rating !== '' ? String(mentor.rating) : null;
  const sessions = mentor.total_sessions ?? 0;
  const spec = mentor.specialization || null;

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(entranceDelay != null ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(entranceDelay != null ? 14 : 0)).current;

  useEffect(() => {
    if (entranceDelay == null) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        delay: entranceDelay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        delay: entranceDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceDelay, opacity, translateY]);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const wrapperStyle = [
    styles.defaultSize,
    style,
    {
      opacity,
      transform:
        Platform.OS === 'ios' ? [{ translateY }] : [{ translateY }, { scale }],
    },
  ];

  return (
    <Animated.View style={wrapperStyle}>
      <Pressable
        style={[styles.card, styles.cardFill]}
        onPress={() => onPress(mentor)}
        onLongPress={() => {
          if (avatarUrl) showAvatarPreview({ uri: avatarUrl, name });
        }}
        delayLongPress={250}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${spec || 'mentor'}`}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.img} resizeMode="cover" />
        ) : (
          <View style={styles.imgPlaceholder}>
            <Text style={styles.initial}>{initial}</Text>
          </View>
        )}

        {rating ? (
          <View style={styles.ratingBadge}>
            <MaterialIcons name="star" size={10} color={GOLD} />
            <Text style={styles.ratingBadgeTxt}>{rating}</Text>
          </View>
        ) : null}

        <View style={styles.strip} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <View style={styles.stripBgIos} />
          ) : (
            <LinearGradient
              colors={['transparent', 'rgba(3,2,12,0.65)', 'rgba(3,2,12,0.97)']}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={[styles.stripContent, iosGradientTextBlock]}>
            <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
              {name}
            </Text>
            {spec ? (
              <Text style={styles.spec} numberOfLines={1}>
                {spec}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <MaterialIcons name="history-edu" size={10} color="rgba(240,240,252,0.7)" />
              <Text style={styles.sessions}>{sessions} sessions</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const light = isLightMode(theme);

  return StyleSheet.create({
    defaultSize: {
      width: Platform.OS === 'ios' ? scaleUi(128) : 120,
      height: Platform.OS === 'ios' ? scaleUi(180) : 172,
    },
    cardFill: {
      width: '100%',
      height: '100%',
    },
    card: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: cardFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
      ...Platform.select({
        ios: light
          ? {
              shadowColor: 'rgba(26, 22, 66, 0.12)',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
            }
          : {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
            },
        android: { elevation: light ? 3 : 4 },
      }),
    },
    img: {
      ...StyleSheet.absoluteFillObject,
    },
    imgPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: S.accentViolet,
      justifyContent: 'center',
      alignItems: 'center',
    },
    initial: {
      fontSize: 52,
      fontWeight: '700',
      color: PURPLE_LINK,
      opacity: 0.45,
    },
    ratingBadge: {
      position: 'absolute',
      top: T.spacing.xs,
      right: T.spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: S.accentGold,
      borderRadius: T.borderRadius.chip,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: light ? C.border.light : 'rgba(240,216,117,0.25)',
    },
    ratingBadgeTxt: {
      fontSize: 10,
      color: GOLD,
      fontWeight: '700',
    },
    strip: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: T.spacing.sm,
      paddingTop: Platform.OS === 'ios' ? T.spacing.xl : T.spacing.xxl,
      paddingBottom: Platform.OS === 'ios' ? T.spacing.sm + 2 : T.spacing.sm,
      overflow: 'hidden',
    },
    stripBgIos: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(3,2,12,0.94)',
    },
    stripContent: {
      width: '100%',
      position: 'relative',
      zIndex: 1,
    },
    // Photo overlay stays dark — keep light text in both themes.
    name: {
      color: '#f0f0fc',
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 16,
      marginBottom: 2,
      ...(Platform.OS === 'ios'
        ? {
            backgroundColor: 'transparent',
            width: '100%',
          }
        : {}),
    },
    spec: {
      fontSize: 10,
      color: GOLD,
      fontWeight: '700',
      lineHeight: 14,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    sessions: {
      fontSize: 10,
      color: 'rgba(240,240,252,0.7)',
      fontWeight: '600',
    },
  });
}
