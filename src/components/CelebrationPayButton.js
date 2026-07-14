import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  ActivityIndicator,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import IosGradientShell from './IosGradientShell';

const T = UNIFIED_THEME;
const B = T.colors.buttons;
const GOLD = T.colors.accent.primary;
const TEAL = T.colors.accent.secondary;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 12;
const RIPPLE_COUNT = 2;
const FX_CYCLE_MS = 6500;
const FX_COLORS = [B.primaryGradient[0], B.successGradient[0], B.nebulaGradient[0], '#f472b6', GOLD, TEAL];

function buildParticles(screenReach) {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    rotate: new Animated.Value(0),
    color: FX_COLORS[i % FX_COLORS.length],
    size: 4 + (i % 4) * 2,
    angle: (i / PARTICLE_COUNT) * Math.PI * 2 + (i % 3) * 0.2,
    distance: screenReach * (0.4 + (i % 5) * 0.1),
  }));
}

function buildRipples() {
  return Array.from({ length: RIPPLE_COUNT }, (_, i) => ({
    id: i,
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    delay: i * 500,
  }));
}

function stopAnimatedValue(value) {
  value.stopAnimation();
}

/** Full-screen celebration layer — render at screen root, pointerEvents none. */
export function CelebrationScreenFx({ active, origin, loop = true, theme = 'success' }) {
  const screenReach = Math.max(SCREEN_W, SCREEN_H) * 0.72;
  const maxRipple = Math.max(SCREEN_W, SCREEN_H) * 1.35;

  const particles = useRef(buildParticles(screenReach)).current;
  const ripples = useRef(buildRipples()).current;
  const screenWash = useRef(new Animated.Value(0)).current;
  const runningAnims = useRef([]);
  const cycleTimer = useRef(null);
  const isMounted = useRef(true);

  const fxOrigin = origin || { x: SCREEN_W / 2, y: SCREEN_H - 120 };
  const isCosmic = theme === 'cosmic';
  const washColor = isCosmic ? GOLD : T.colors.accent.success;
  const rippleBorder = isCosmic ? 'rgba(240, 216, 117, 0.5)' : 'rgba(52, 211, 153, 0.45)';
  const rippleFill = isCosmic ? 'rgba(94, 234, 212, 0.08)' : 'rgba(52, 211, 153, 0.06)';

  const clearRunningAnims = useCallback(() => {
    runningAnims.current.forEach(anim => {
      try {
        anim.stop();
      } catch (_) {
        /* already stopped */
      }
    });
    runningAnims.current = [];
  }, []);

  const resetFxValues = useCallback(() => {
    particles.forEach(p => {
      stopAnimatedValue(p.x);
      stopAnimatedValue(p.y);
      stopAnimatedValue(p.opacity);
      stopAnimatedValue(p.scale);
      stopAnimatedValue(p.rotate);
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
      p.rotate.setValue(0);
    });
    ripples.forEach(r => {
      stopAnimatedValue(r.scale);
      stopAnimatedValue(r.opacity);
      r.scale.setValue(0);
      r.opacity.setValue(0);
    });
    stopAnimatedValue(screenWash);
    screenWash.setValue(0);
  }, [particles, ripples, screenWash]);

  const stopAllFx = useCallback(() => {
    if (cycleTimer.current) {
      clearTimeout(cycleTimer.current);
      cycleTimer.current = null;
    }
    clearRunningAnims();
    resetFxValues();
  }, [clearRunningAnims, resetFxValues]);

  const trackAnim = useCallback(anim => {
    runningAnims.current.push(anim);
    return anim;
  }, []);

  const runConfettiBurst = useCallback(() => {
    particles.forEach(p => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(0);
      p.scale.setValue(0);
      p.rotate.setValue(0);

      const anim = trackAnim(
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 0.85, duration: 150, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(p.x, {
            toValue: Math.cos(p.angle) * p.distance,
            duration: 850,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: Math.sin(p.angle) * p.distance,
            duration: 850,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(p.rotate, { toValue: 1, duration: 850, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(350),
            Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      );
      anim.start();
    });
  }, [particles, trackAnim]);

  const runRippleWave = useCallback(() => {
    ripples.forEach(r => {
      r.scale.setValue(0);
      r.opacity.setValue(0);

      const anim = trackAnim(
        Animated.sequence([
          Animated.delay(r.delay),
          Animated.parallel([
            Animated.timing(r.opacity, { toValue: 0.3, duration: 200, useNativeDriver: true }),
            Animated.timing(r.scale, {
              toValue: 1,
              duration: 2000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(700),
              Animated.timing(r.opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
            ]),
          ]),
        ]),
      );
      anim.start();
    });
  }, [ripples, trackAnim]);

  const runScreenWash = useCallback(() => {
    screenWash.setValue(0);
    const anim = trackAnim(
      Animated.sequence([
        Animated.timing(screenWash, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(screenWash, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
  }, [screenWash, trackAnim]);

  const runFxCycle = useCallback(() => {
    if (!isMounted.current) return;
    clearRunningAnims();
    resetFxValues();
    runScreenWash();
    runRippleWave();
    runConfettiBurst();

    if (loop) {
      cycleTimer.current = setTimeout(() => {
        if (isMounted.current) runFxCycle();
      }, FX_CYCLE_MS);
    }
  }, [
    clearRunningAnims,
    resetFxValues,
    runScreenWash,
    runRippleWave,
    runConfettiBurst,
    loop,
  ]);

  useEffect(() => {
    isMounted.current = true;

    if (active) {
      runFxCycle();
    } else {
      stopAllFx();
    }

    return () => {
      isMounted.current = false;
      stopAllFx();
    };
  }, [active, runFxCycle, stopAllFx]);

  if (!active) return null;

  const washOpacity = screenWash.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, isCosmic ? 0.18 : 0.12, 0],
  });

  return (
    <View style={styles.fxScreen} pointerEvents="none">
      <Animated.View
        style={[styles.screenWash, { opacity: washOpacity, backgroundColor: washColor }]}
        pointerEvents="none"
      />

      {ripples.map(r => (
        <Animated.View
          key={`ripple-${r.id}`}
          pointerEvents="none"
          style={[
            styles.ripple,
            {
              left: fxOrigin.x - maxRipple / 2,
              top: fxOrigin.y - maxRipple / 2,
              width: maxRipple,
              height: maxRipple,
              borderRadius: maxRipple / 2,
              borderColor: rippleBorder,
              backgroundColor: rippleFill,
              opacity: r.opacity,
              transform: [{ scale: r.scale }],
            },
          ]}
        />
      ))}

      <View style={[styles.particleLayer, { left: fxOrigin.x, top: fxOrigin.y }]} pointerEvents="none">
        {particles.map(p => {
          const spin = p.rotate.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${120 + p.id * 20}deg`],
          });
          return (
            <Animated.View
              key={p.id}
              style={[
                styles.particle,
                {
                  width: p.size,
                  height: p.size,
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  opacity: p.opacity,
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { scale: p.scale },
                    { rotate: spin },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * Booking CTA — button shimmer/glow; pair with CelebrationScreenFx for full-screen spread.
 */
export default function CelebrationPayButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  ready = false,
  size = 'default',
  style,
  onOriginMeasure,
}) {
  const isCheckout = size === 'checkout';
  const buttonRef = useRef(null);

  const scale = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const iconWiggle = useRef(new Animated.Value(0)).current;
  const loopAnims = useRef([]);
  const wasReady = useRef(false);

  const isActive = ready && !disabled && !loading;

  const measureButtonOrigin = useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, w, h) => {
      onOriginMeasure?.({ x: x + w / 2, y: y + h / 2 });
    });
  }, [onOriginMeasure]);

  const stopButtonLoops = useCallback(() => {
    loopAnims.current.forEach(anim => {
      try {
        anim.stop();
      } catch (_) {
        /* noop */
      }
    });
    loopAnims.current = [];
    stopAnimatedValue(shimmer);
    stopAnimatedValue(glowOpacity);
    stopAnimatedValue(glowScale);
    stopAnimatedValue(breathe);
    stopAnimatedValue(iconWiggle);
    stopAnimatedValue(scale);
  }, [shimmer, glowOpacity, glowScale, breathe, iconWiggle, scale]);

  useEffect(() => {
    if (isActive && !wasReady.current) {
      wasReady.current = true;
      measureButtonOrigin();
      const pop = Animated.sequence([
        Animated.spring(scale, { toValue: 1.06, friction: 3, tension: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      ]);
      pop.start();
    }
    if (!isActive) {
      wasReady.current = false;
      stopButtonLoops();
      shimmer.setValue(0);
      glowOpacity.setValue(0.2);
      glowScale.setValue(1);
      iconWiggle.setValue(0);
      breathe.setValue(1);
      scale.setValue(1);
    }
  }, [isActive, scale, shimmer, glowOpacity, glowScale, iconWiggle, breathe, measureButtonOrigin, stopButtonLoops]);

  useEffect(() => {
    if (!isActive) return undefined;

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const glowLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.75, duration: 900, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.025, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconWiggle, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(iconWiggle, { toValue: -1, duration: 350, useNativeDriver: true }),
        Animated.timing(iconWiggle, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(800),
      ]),
    );

    loopAnims.current = [shimmerLoop, glowLoop, breatheLoop, wiggleLoop];
    shimmerLoop.start();
    glowLoop.start();
    breatheLoop.start();
    wiggleLoop.start();

    measureButtonOrigin();
    const originInterval = setInterval(measureButtonOrigin, 2000);

    return () => {
      stopButtonLoops();
      clearInterval(originInterval);
    };
  }, [isActive, shimmer, glowOpacity, glowScale, breathe, iconWiggle, measureButtonOrigin, stopButtonLoops]);

  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 320],
  });

  const iconRotate = iconWiggle.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const combinedScale = Animated.multiply(scale, breathe);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, friction: 6, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  return (
    <View
      ref={buttonRef}
      onLayout={measureButtonOrigin}
      style={[styles.wrap, isCheckout && styles.wrapCheckout, style]}
      collapsable={false}
    >
      <View style={[styles.buttonStage, isCheckout && styles.buttonStageCheckout]}>
        {isActive ? (
          <Animated.View
            style={[
              styles.glow,
              isCheckout && styles.glowCheckout,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
            pointerEvents="none"
          />
        ) : null}

        {/* Pressable outside native-driven scale so iOS checkout taps register. */}
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          style={[
            styles.shell,
            isCheckout && styles.shellCheckout,
            isActive && styles.shellReady,
            (disabled || loading) && !isActive && styles.shellDisabled,
          ]}
        >
          <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
            <IosGradientShell
              colors={
                isActive
                  ? B.successGradient
                  : disabled || loading
                    ? ['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.04)']
                    : ['rgba(167, 139, 250, 0.22)', 'rgba(124, 58, 237, 0.16)']
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.gradient, isCheckout && styles.gradientCheckout]}
              innerStyle={Platform.OS === 'ios' ? styles.iosGradientRowWrap : undefined}
            >
              {isActive ? (
                <Animated.View
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }] }]}
                  pointerEvents="none"
                />
              ) : null}

              <View style={[styles.row, Platform.OS === 'ios' && styles.rowIos]}>
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={isActive ? B.successText : T.colors.accent.primary}
                    style={styles.loader}
                  />
                ) : (
                  <Animated.View style={{ transform: [{ rotate: isActive ? iconRotate : '0deg' }] }}>
                    <MaterialIcons
                      name={isActive ? 'celebration' : disabled ? 'lock-outline' : 'event-available'}
                      size={isCheckout ? 22 : 20}
                      color={
                        isActive
                          ? B.successText
                          : disabled
                            ? T.colors.text.muted
                            : T.colors.accent.primary
                      }
                    />
                  </Animated.View>
                )}
                <Text
                  style={[
                    styles.label,
                    isCheckout && styles.labelCheckout,
                    Platform.OS === 'ios' && isCheckout && styles.labelCheckoutIos,
                    {
                      color: isActive
                        ? B.successText
                        : disabled
                          ? T.colors.text.muted
                          : T.colors.text.primary,
                    },
                  ]}
                  numberOfLines={Platform.OS === 'ios' ? 2 : 1}
                  ellipsizeMode="tail"
                >
                  {label}
                </Text>
              </View>
            </IosGradientShell>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fxScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    overflow: 'hidden',
  },
  screenWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: T.colors.accent.success,
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
  },
  particleLayer: {
    position: 'absolute',
    width: 0,
    height: 0,
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },

  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    marginVertical: 0,
    zIndex: 20,
  },
  wrapCheckout: {
    width: '100%',
    alignSelf: 'stretch',
  },
  buttonStage: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderRadius: 14,
  },
  buttonStageCheckout: {
    minHeight: 54,
    borderRadius: 16,
  },
  glow: {
    position: 'absolute',
    left: '50%',
    marginLeft: '-54%',
    width: '108%',
    height: 56,
    borderRadius: 16,
    backgroundColor: T.colors.accent.success,
  },
  glowCheckout: {
    height: 60,
    borderRadius: 18,
  },
  shell: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: B.secondaryBorder,
  },
  shellCheckout: {
    minHeight: 54,
    borderRadius: 16,
  },
  shellReady: {
    borderColor: B.successBorder,
    ...T.shadows.medium,
  },
  shellDisabled: {
    borderColor: T.colors.border.light,
    opacity: 0.72,
  },
  gradient: Platform.select({
    ios: {
      width: '100%',
      minHeight: 48,
      paddingHorizontal: T.spacing.md,
      overflow: 'hidden',
    },
    default: {
      minHeight: 46,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: T.spacing.md,
      overflow: 'hidden',
    },
  }),
  gradientCheckout: Platform.select({
    ios: {
      width: '100%',
      minHeight: 54,
      paddingHorizontal: T.spacing.lg,
      overflow: 'hidden',
    },
    default: {
      minHeight: 52,
      paddingHorizontal: T.spacing.lg,
    },
  }),
  shimmerStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ skewX: '-18deg' }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 2,
  },
  rowIos: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  iosGradientRowWrap: {
    width: '100%',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  loader: { marginRight: 0 },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  labelCheckout: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  labelCheckoutIos: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
    lineHeight: 20,
    backgroundColor: 'transparent',
    opacity: 1,
    fontWeight: '800',
  },
});
