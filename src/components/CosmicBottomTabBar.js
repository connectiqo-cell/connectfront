import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import { scaleUi } from '../utils/iosUiScale';

const C = UNIFIED_THEME.colors;
const S = UNIFIED_THEME.spacing;
const T = UNIFIED_THEME;
const TB = C.tabBar;
const FAB_SIZE = TB.uploadFabSize ?? 52;
const FAB_LIFT = TB.uploadFabLift ?? 22;
const FAB_RING_INSET = 2;
const FAB_INNER = FAB_SIZE - FAB_RING_INSET * 2;
const FAB_SPIN_COLORS = [
  C.accent.primary,
  C.accent.secondary,
  'rgba(167, 139, 250, 0.95)',
  '#ec4899',
  C.accent.primary,
];

/** Fixed row geometry — all tabs share the same slots */
const INDICATOR_H = scaleUi(6);
const ICON_FRAME = scaleUi(28);
const ICON_SIZE = scaleUi(24);
const ICON_SLOT_H = ICON_FRAME;
const LABEL_H = scaleUi(14);
const TAB_ROW_H = INDICATOR_H + ICON_SLOT_H + LABEL_H + scaleUi(8);
const TAB_BAR_PADDING_TOP = S.sm;

/** Total height of the floating bottom tab bar (matches barWrap layout). */
export function getFloatingTabBarHeight(insets) {
  const bottomPad = Math.max(insets.bottom, 8);
  return TAB_BAR_PADDING_TOP + TAB_ROW_H + bottomPad;
}

/** Inset for screen content that should sit just above tab icons (excludes bar top padding). */
export function getFloatingTabBarContentInset(insets) {
  const bottomPad = Math.max(insets.bottom, 8);
  return TAB_ROW_H + bottomPad;
}

function resolveLabel(route, options, focused) {
  const raw =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
        ? options.title
        : route.name;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'function') {
    return raw({ focused, color: '', position: 'below-icon' });
  }
  return route.name;
}

function BarTopShimmer() {
  const { width } = useWindowDimensions();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.45, width * 0.45],
  });

  return (
    <View style={styles.topEdgeShimmerWrap} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateX }] }}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(240, 216, 117, 0.55)',
            'rgba(94, 234, 212, 0.45)',
            'transparent',
          ]}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.topEdgeShimmer, { width: width * 0.55 }]}
        />
      </Animated.View>
    </View>
  );
}

function TabIndicator({ active }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const scaleX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <View style={styles.indicatorRow}>
      <Animated.View
        style={{
          opacity: progress,
          transform: [{ scaleX }],
        }}
      >
        <LinearGradient
          colors={TB.activeIndicatorGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.activeIndicator}
        />
      </Animated.View>
    </View>
  );
}

function UploadFabVisual() {
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    spinLoop.start();
    breatheLoop.start();
    return () => {
      spinLoop.stop();
      breatheLoop.stop();
    };
  }, [spin, breathe]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const fabScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const spinGradSize = FAB_SIZE * 1.55;
  const spinOffset = (FAB_SIZE - spinGradSize) / 2;

  return (
    <Animated.View style={[styles.fabOuterRing, { transform: [{ scale: fabScale }] }]}>
      <View style={styles.fabRingClip}>
        <Animated.View
          style={[
            styles.fabSpinGradWrap,
            {
              width: spinGradSize,
              height: spinGradSize,
              left: spinOffset,
              top: spinOffset,
              transform: [{ rotate }],
            },
          ]}
        >
          <LinearGradient
            colors={FAB_SPIN_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <LinearGradient
          colors={C.buttons.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabCircle}
        >
          <MaterialIcons name="file-upload" size={scaleUi(22)} color={C.text.onAccent} />
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

function TabColumn({
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
  label,
  color,
  icon,
  isUpload,
}) {
  const press = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(press, {
      toValue: 0.92,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(press, {
      toValue: 1,
      friction: 5,
      tension: 160,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabColumn, isUpload && styles.tabColumnUpload]}
      activeOpacity={1}
    >
      <TabIndicator active={isFocused && !isUpload} />
      <Animated.View
        style={[
          styles.iconSlot,
          isUpload && styles.iconSlotUpload,
          { transform: [{ scale: press }] },
        ]}
      >
        {icon}
      </Animated.View>
      {typeof label === 'string' ? (
        <Text
          style={[styles.label, { color }, isFocused && styles.labelFocused]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : (
        <View style={styles.labelSlot}>{label}</View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Bottom tabs: cosmic sky + glass bar; center upload FAB floats above the strip.
 */
export function CosmicBottomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  const activeColor = C.accent.primary;
  const inactiveColor = C.text.muted;

  const makeHandlers = (route, index) => {
    const isFocused = state.index === index;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };
    return { isFocused, onPress, onLongPress };
  };

  return (
    <View style={styles.tabRoot} pointerEvents="box-none">
      <LinearGradient
        colors={[C.surface.sheet, C.surface.panel, C.surface.sheet]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[styles.barWrap, { paddingBottom: bottomPad }]}
        pointerEvents="box-none"
      >
        <View style={styles.barTint} pointerEvents="none">
          <LinearGradient
            colors={TB.glassGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <LinearGradient
          colors={TB.flatBarEdge}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topEdge}
          pointerEvents="none"
        />
        <BarTopShimmer />

        <View style={styles.barRow}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const { isFocused, onPress, onLongPress } = makeHandlers(
              route,
              index,
            );
            const color = isFocused ? activeColor : inactiveColor;
            const label = resolveLabel(route, options, isFocused);
            const isUpload = !!options.tabBarSpecial;

            const Icon = options.tabBarIcon;
            const icon = isUpload ? (
              <View style={styles.fabFloatWrap} pointerEvents="none">
                <UploadFabVisual />
              </View>
            ) : Icon ? (
              <View style={styles.iconFrame}>
                {Icon({
                  focused: isFocused,
                  color,
                  size: ICON_SIZE,
                })}
              </View>
            ) : null;

            return (
              <TabColumn
                key={route.key}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={
                  options.tabBarAccessibilityLabel ??
                  (typeof label === 'string' ? label : route.name)
                }
                testID={options.tabBarTestID}
                label={label}
                color={color}
                icon={icon}
                isUpload={isUpload}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const FAB_FLOAT_TOP =
  (ICON_SLOT_H - FAB_SIZE) / 2 - FAB_LIFT;

const styles = StyleSheet.create({
  tabRoot: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: C.surface.panel,
  },
  barWrap: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    backgroundColor: TB.flatBarBase,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border.light,
    paddingTop: S.sm,
    ...Platform.select({
      ios: {
        shadowColor: T.shadows.large.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: T.shadows.large.shadowOpacity * 0.6,
        shadowRadius: T.shadows.large.shadowRadius,
      },
      android: { elevation: T.shadows.large.elevation },
    }),
  },
  barTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.94,
  },
  topEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    opacity: 0.95,
  },
  topEdgeShimmerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    overflow: 'hidden',
    alignItems: 'center',
  },
  topEdgeShimmer: {
    height: 2,
    borderRadius: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: TAB_ROW_H,
    overflow: 'visible',
  },
  tabColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  tabColumnUpload: {
    overflow: 'visible',
    zIndex: 10,
  },
  indicatorRow: {
    height: INDICATOR_H,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: scaleUi(24),
    height: scaleUi(3),
    borderRadius: 2,
  },
  iconSlot: {
    height: ICON_SLOT_H,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconFrame: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotUpload: {
    overflow: 'visible',
  },
  label: {
    ...UNIFIED_THEME.typography.labelSm,
    height: LABEL_H,
    lineHeight: LABEL_H,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.2,
    width: '100%',
  },
  labelFocused: {
    fontWeight: '800',
    textShadowColor: TB.labelShadow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  labelSlot: {
    height: LABEL_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabFloatWrap: {
    position: 'absolute',
    top: FAB_FLOAT_TOP,
    alignSelf: 'center',
    width: FAB_SIZE + 6,
    height: FAB_SIZE + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabOuterRing: {
    width: FAB_SIZE + 6,
    height: FAB_SIZE + 6,
    borderRadius: T.borderRadius.lg,
    padding: 2,
    backgroundColor: TB.flatBarBase,
    borderWidth: 1,
    borderColor: TB.glassBorder,
    ...Platform.select({
      ios: {
        shadowColor: C.accent.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      android: { elevation: 14 },
    }),
  },
  fabRingClip: {
    flex: 1,
    borderRadius: T.borderRadius.md + 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSpinGradWrap: {
    position: 'absolute',
  },
  fabCircle: {
    width: FAB_INNER,
    height: FAB_INNER,
    borderRadius: T.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
