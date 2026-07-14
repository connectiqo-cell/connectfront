import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Pressable,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import { PLATFORM_LAYOUT } from '../utils/platformLayout';

const T = UNIFIED_THEME;
const B = T.colors.buttons;
const C = T.colors.component;

/** Gradient-backed variants */
const GRADIENT_VARIANTS = {
  primary: {
    colors: B.primaryGradient,
    text: B.primaryText,
    border: B.primaryBorder,
  },
  success: {
    colors: B.successGradient,
    text: B.successText,
    border: B.successBorder,
  },
  nebula: {
    colors: B.nebulaGradient,
    text: B.nebulaText,
    border: B.nebulaBorder,
  },
  premium: {
    colors: B.premiumGradient,
    text: B.premiumText,
    border: B.premiumBorder,
  },
  info: {
    colors: B.infoGradient,
    text: B.infoText,
    border: B.infoBorder,
  },
};

/**
 * @param {'primary'|'secondary'|'outline'|'ghost'|'success'|'danger'|'nebula'|'premium'|'info'|'warning'|'goldOutline'} variant
 */
function usePressScale(enabled) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (!enabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    if (!enabled) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return { scale, onPressIn, onPressOut };
}

function PressableShell({ pressScale, onPress, style, children, disabled, innerRadius }) {
  const { scale, onPressIn, onPressOut } = usePressScale(pressScale && !disabled);

  if (!pressScale || disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={[style, styles.touchableShell]}
        disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // Pressable outside native-driven scale — required for reliable taps on iOS.
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, styles.pressScaleWrap, styles.pressableFill, innerRadius && { borderRadius: innerRadius, overflow: 'hidden' }]}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale }] }, styles.pressScaleInner]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function CosmicButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'default',
  icon,
  iconColor,
  style,
  textStyle,
  pressScale = false,
  pill = false,
  numberOfLines = 1,
}) {
  const resolvedVariant = variant === 'ghost' ? 'outline' : variant;
  const isDisabled = disabled || loading;
  const compact = size === 'compact';
  const gradientConfig = GRADIENT_VARIANTS[resolvedVariant];
  const pillRadius = pill ? T.borderRadius.round : undefined;

  const textColor = (() => {
    if (isDisabled) return B.disabledText;
    if (gradientConfig) return gradientConfig.text;
    switch (resolvedVariant) {
      case 'secondary':
        return B.secondaryText;
      case 'outline':
        return B.outlineText;
      case 'goldOutline':
        return B.goldOutlineText;
      case 'danger':
        return B.dangerText;
      case 'warning':
        return B.warningText;
      default:
        return B.primaryText;
    }
  })();

  const content = (
    <View style={[styles.row, Platform.OS === 'ios' && styles.rowIos]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} style={styles.loader} />
      ) : icon ? (
        <MaterialIcons
          name={icon}
          size={compact ? 18 : 20}
          color={iconColor ?? textColor}
          style={styles.icon}
        />
      ) : null}
      <Text
        style={[
          compact ? styles.textCompact : styles.text,
          { color: textColor },
          Platform.OS === 'ios' && (gradientConfig ? styles.textOnGradient : styles.textOnFlat),
          textStyle,
        ]}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </View>
  );

  const shell = [
    compact ? styles.shellCompact : styles.shell,
    isDisabled && styles.shellDisabled,
    style,
  ];

  if (isDisabled) {
    return (
      <View style={[shell, styles.disabledBox, { borderColor: B.disabledBorder }, pillRadius && { borderRadius: pillRadius }]}>
        {content}
      </View>
    );
  }

  if (gradientConfig) {
    const gradientFill = compact ? styles.gradientCompact : styles.gradient;
    const gradientNode =
      Platform.OS === 'ios' ? (
        <View style={[gradientFill, styles.iosGradientStack]}>
          <LinearGradient
            colors={gradientConfig.colors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={compact ? styles.iosGradientForegroundCompact : styles.iosGradientForeground}>
            {content}
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={gradientConfig.colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={gradientFill}
        >
          {content}
        </LinearGradient>
      );

    return (
      <PressableShell
        pressScale={pressScale}
        onPress={onPress}
        disabled={isDisabled}
        innerRadius={pillRadius}
        style={[
          shell,
          { borderColor: gradientConfig.border },
          pressScale && styles.shellPressScale,
          pillRadius && { borderRadius: pillRadius },
        ]}
      >
        {gradientNode}
      </PressableShell>
    );
  }

  const flat = (() => {
    switch (resolvedVariant) {
      case 'secondary':
        return {
          backgroundColor: B.secondaryBg,
          borderColor: B.secondaryBorder,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: B.outlineBorder,
        };
      case 'goldOutline':
        return {
          backgroundColor: B.goldOutlinePressedBg,
          borderColor: B.goldOutlineBorder,
        };
      case 'danger':
        return {
          backgroundColor: B.dangerBg,
          borderColor: B.dangerBorder,
        };
      case 'warning':
        return {
          backgroundColor: B.warningBg,
          borderColor: B.warningBorder,
        };
      default:
        return {
          backgroundColor: C.button,
          borderColor: B.secondaryBorder,
        };
    }
  })();

  return (
    <PressableShell
      pressScale={pressScale}
      onPress={onPress}
      disabled={isDisabled}
      innerRadius={pillRadius}
      style={[
        shell,
        flat,
        Platform.OS !== 'ios' && (compact ? styles.flatCompact : styles.flat),
        Platform.OS === 'ios' && styles.iosFlatShell,
        pressScale && styles.shellPressScale,
        pillRadius && { borderRadius: pillRadius },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <View style={compact ? styles.iosFlatForegroundCompact : styles.iosFlatForeground}>
          {content}
        </View>
      ) : (
        content
      )}
    </PressableShell>
  );
}

const styles = StyleSheet.create({
  touchableShell: {
    alignSelf: 'stretch',
    ...Platform.select({ ios: { width: '100%' }, default: {} }),
  },
  pressScaleWrap: {
    alignSelf: 'stretch',
  },
  pressScaleInner: {
    width: '100%',
    alignSelf: 'stretch',
  },
  shellPressScale: {
    overflow: 'visible',
  },
  pressableFill: Platform.select({
    ios: {
      width: '100%',
      flex: 1,
      minHeight: PLATFORM_LAYOUT.buttonMinHeight,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    default: {
      width: '100%',
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
  }),
  shell: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: PLATFORM_LAYOUT.buttonMinHeight,
    borderRadius: T.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: T.spacing.md,
  },
  shellCompact: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight,
    borderRadius: T.borderRadius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 0,
    ...Platform.select({
      ios: { minWidth: 0, flexShrink: 1 },
      default: {},
    }),
  },
  shellDisabled: {
    opacity: 0.55,
  },
  disabledBox: {
    backgroundColor: C.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
  },
  gradient: Platform.select({
    ios: {
      width: '100%',
      flex: 1,
      minHeight: PLATFORM_LAYOUT.buttonMinHeight - 2,
      paddingVertical: 15,
      paddingHorizontal: T.spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    default: {
      width: '100%',
      flexGrow: 1,
      minHeight: 48,
      paddingVertical: 14,
      paddingHorizontal: T.spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }),
  gradientCompact: Platform.select({
    ios: {
      width: '100%',
      flex: 1,
      minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight - 2,
      paddingVertical: 11,
      paddingHorizontal: T.spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    default: {
      width: '100%',
      minHeight: 38,
      paddingVertical: 10,
      paddingHorizontal: T.spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }),
  iosGradientStack: {
    position: 'relative',
    overflow: 'hidden',
  },
  iosGradientForeground: {
    zIndex: 2,
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonMinHeight - 2,
    paddingVertical: 15,
    paddingHorizontal: T.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosGradientForegroundCompact: {
    zIndex: 2,
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight - 2,
    paddingVertical: 11,
    paddingHorizontal: T.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosFlatShell: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  flat: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingVertical: 14,
  },
  flatCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: T.spacing.md,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    ...Platform.select({ ios: { width: '100%' }, default: {} }),
  },
  rowIos: {
    zIndex: 1,
    alignSelf: 'stretch',
  },
  loader: {
    marginRight: T.spacing.sm,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: T.typography.labelLg.fontSize,
    fontWeight: '700',
    lineHeight: T.typography.labelLg.lineHeight,
    textAlign: 'center',
    ...(Platform.OS === 'ios' ? { letterSpacing: 0.2, flexShrink: 1, minWidth: 0 } : {}),
  },
  textCompact: {
    fontSize: T.typography.labelMd.fontSize,
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    lineHeight: T.typography.labelMd.lineHeight,
    textAlign: 'center',
    flexShrink: 1,
    ...(Platform.OS === 'ios' ? { minWidth: 0, letterSpacing: 0.15 } : {}),
  },
  textOnGradient: {
    backgroundColor: 'transparent',
    ...(Platform.OS === 'ios' ? { opacity: 1 } : {}),
  },
  textOnFlat: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  iosFlatForeground: {
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonMinHeight - 2,
    paddingVertical: 14,
    paddingHorizontal: T.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iosFlatForegroundCompact: {
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight - 2,
    paddingVertical: 10,
    paddingHorizontal: T.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
