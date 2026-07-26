import React, { useMemo, useRef } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import { PLATFORM_LAYOUT } from '../utils/platformLayout';

function buildGradientVariants(buttons) {
  return {
    primary: {
      colors: buttons.primaryGradient,
      text: buttons.primaryText,
      border: buttons.primaryBorder,
    },
    success: {
      colors: buttons.successGradient,
      text: buttons.successText,
      border: buttons.successBorder,
    },
    nebula: {
      colors: buttons.nebulaGradient,
      text: buttons.nebulaText,
      border: buttons.nebulaBorder,
    },
    premium: {
      colors: buttons.premiumGradient,
      text: buttons.premiumText,
      border: buttons.premiumBorder,
    },
    info: {
      colors: buttons.infoGradient,
      text: buttons.infoText,
      border: buttons.infoBorder,
    },
  };
}

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
  const { theme } = useTheme();
  const T = theme;
  const B = theme.colors.buttons;
  const C = theme.colors.component;
  const gradientVariants = useMemo(() => buildGradientVariants(B), [B]);

  const resolvedVariant = variant === 'ghost' ? 'outline' : variant;
  const isDisabled = disabled || loading;
  const compact = size === 'compact';
  const gradientConfig = gradientVariants[resolvedVariant];
  // Compact actions need visibly rounded corners; pill uses full capsule radius.
  const cornerRadius = pill
    ? T.borderRadius.round
    : compact
      ? T.borderRadius.lg
      : T.borderRadius.md;

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
        <ActivityIndicator size="small" color={textColor} style={[styles.loader, { marginRight: T.spacing.sm }]} />
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
    compact
      ? [styles.shellCompact, { borderRadius: cornerRadius, marginVertical: 0 }]
      : [styles.shell, { borderRadius: cornerRadius, marginVertical: T.spacing.md }],
    isDisabled && styles.shellDisabled,
    { overflow: 'hidden' },
    style,
    // Keep pill / computed radius last so overflow clipping matches the visible corners.
    { borderRadius: cornerRadius },
  ];

  if (isDisabled) {
    return (
      <View style={[shell, styles.disabledBox, { borderColor: B.disabledBorder, backgroundColor: C.disabled, paddingHorizontal: T.spacing.lg }]}>
        {content}
      </View>
    );
  }

  if (gradientConfig) {
    const gradientFill = compact ? styles.gradientCompact : styles.gradient;
    const gradientNode =
      Platform.OS === 'ios' ? (
        <View style={[gradientFill, styles.iosGradientStack, { borderRadius: cornerRadius, overflow: 'hidden' }]}>
          <LinearGradient
            colors={gradientConfig.colors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={compact ? [styles.iosGradientForegroundCompact, { paddingHorizontal: T.spacing.md }] : [styles.iosGradientForeground, { paddingHorizontal: T.spacing.lg }]}>
            {content}
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={gradientConfig.colors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[gradientFill, compact ? { paddingHorizontal: T.spacing.md } : { paddingHorizontal: T.spacing.lg }, { borderRadius: cornerRadius, overflow: 'hidden' }]}
        >
          {content}
        </LinearGradient>
      );

    return (
      <PressableShell
        pressScale={pressScale}
        onPress={onPress}
        disabled={isDisabled}
        innerRadius={cornerRadius}
        style={[
          shell,
          { borderColor: gradientConfig.border },
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
      innerRadius={cornerRadius}
      style={[
        shell,
        flat,
        Platform.OS !== 'ios' && (compact ? [styles.flatCompact, { paddingHorizontal: T.spacing.md }] : [styles.flat, { paddingHorizontal: T.spacing.lg }]),
        Platform.OS === 'ios' && styles.iosFlatShell,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <View style={compact ? [styles.iosFlatForegroundCompact, { paddingHorizontal: T.spacing.md }] : [styles.iosFlatForeground, { paddingHorizontal: T.spacing.lg }]}>
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  shellCompact: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 0,
    flexShrink: 1,
    justifyContent: 'center',
  },
  shellDisabled: {
    opacity: 0.55,
  },
  disabledBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: Platform.select({
    ios: {
      width: '100%',
      flex: 1,
      minHeight: PLATFORM_LAYOUT.buttonMinHeight - 2,
      paddingVertical: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    default: {
      width: '100%',
      flexGrow: 1,
      minHeight: 48,
      paddingVertical: 14,
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    default: {
      width: '100%',
      minHeight: 38,
      paddingVertical: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosGradientForegroundCompact: {
    zIndex: 2,
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight - 2,
    paddingVertical: 11,
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
    paddingVertical: 14,
  },
  flatCompact: {
    justifyContent: 'center',
    alignItems: 'center',
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
  loader: {},
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    ...(Platform.OS === 'ios' ? { letterSpacing: 0.2, flexShrink: 1, minWidth: 0 } : {}),
  },
  textCompact: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
    flexShrink: 1,
    minWidth: 0,
    ...(Platform.OS === 'ios' ? { letterSpacing: 0.15 } : {}),
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
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iosFlatForegroundCompact: {
    width: '100%',
    minHeight: PLATFORM_LAYOUT.buttonCompactMinHeight - 2,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
