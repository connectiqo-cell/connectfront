import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../hooks/useTheme';

function withAlpha(hex, alpha) {
  if (typeof hex !== 'string') return `rgba(109, 74, 255, ${alpha})`;
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Cosmic-themed loader: dual-tone orbit rings + soft pulsing core.
 * Colors follow the active light/dark theme.
 */
export function CosmicLoader({ size = 56 }) {
  const { theme, isDark } = useTheme();
  const accent = theme.colors.accent.primary;
  const secondary = theme.colors.accent.secondary;
  const spin = useRef(new Animated.Value(0)).current;
  const spinReverse = useRef(new Animated.Value(0)).current;
  const corePulse = useRef(new Animated.Value(0.5)).current;
  const coreScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const revLoop = Animated.loop(
      Animated.timing(spinReverse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(corePulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(coreScale, {
            toValue: 1.15,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(corePulse, {
            toValue: 0.35,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(coreScale, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    spinLoop.start();
    revLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      revLoop.stop();
      pulseLoop.stop();
    };
  }, [spin, spinReverse, corePulse, coreScale]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotateRev = spinReverse.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const borderW = Math.max(3, size * 0.1);
  const innerRing = size * 0.72;
  const ringInset = (size - innerRing) / 2;
  const trackAlpha = isDark ? 0.12 : 0.18;
  const highlightAlpha = isDark ? 0.65 : 0.85;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ringOuter,
          {
            width: size,
            height: size,
            transform: [{ rotate }],
          },
        ]}
      >
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: borderW,
              borderColor: withAlpha(accent, trackAlpha),
              borderTopColor: accent,
              borderRightColor: secondary,
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.ringInnerSlot,
          {
            width: innerRing,
            height: innerRing,
            left: ringInset,
            top: ringInset,
            transform: [{ rotate: rotateRev }],
          },
        ]}
      >
        <View
          style={[
            styles.ring,
            {
              width: innerRing,
              height: innerRing,
              borderRadius: innerRing / 2,
              borderWidth: borderW * 0.65,
              borderColor: withAlpha(secondary, trackAlpha),
              borderBottomColor: secondary,
              borderLeftColor: withAlpha(accent, highlightAlpha),
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.core,
          {
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size * 0.11,
            opacity: corePulse,
            transform: [{ scale: coreScale }],
            backgroundColor: secondary,
            shadowColor: accent,
          },
        ]}
      />
    </View>
  );
}

/**
 * @deprecated Use CosmicLoader; kept for any legacy imports.
 */
export const PulsingDots = ({ size = 16 }) => (
  <CosmicLoader size={Math.max(52, Math.round(size * 2.75))} />
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInnerSlot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  core: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
});
