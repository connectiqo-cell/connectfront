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

function PressableShell({ pressScale, onPress, style, children, disabled, innerRadius, compact }) {
  const { scale, onPressIn, onPressOut } = usePressScale(pressScale && !disabled);
  const radiusStyle = innerRadius
    ? { borderRadius: innerRadius, overflow: 'hidden' }
    : null;
  const fillStyle = compact ? styles.pressableFillCompact : styles.pressableFill;

  if (!pressScale || disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={[style, styles.touchableShell, radiusStyle]}
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
      style={[style, styles.pressScaleWrap, fillStyle, radiusStyle]}
      disabled={disabled}
    >
      <Animated.View style={[{ transform: [{ scale }] }, styles.pressScaleInner, radiusStyle]}>
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
  // Capsule radius = half the button height so edges stay round at any width.
  const buttonHeight = compact
    ? PLATFORM_LAYOUT.buttonCompactMinHeight
    : PLATFORM_LAYOUT.buttonMinHeight;
  const cornerRadius = pill ? Math.ceil(buttonHeight / 2) : compact ? 14 : 16;

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
        <ActivityIndicator size="small" color={textColor} style={styles.icon} />
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
    {
      height: buttonHeight,
      minHeight: buttonHeight,
      borderRadius: cornerRadius,
      marginVertical: compact ? 0 : T.spacing.md,
      overflow: 'hidden',
    },
    isDisabled && styles.shellDisabled,
    style,
    { borderRadius: cornerRadius, overflow: 'hidden', height: buttonHeight, minHeight: buttonHeight },
  ];

  if (isDisabled) {
    return (
      <View
        style={[
          shell,
          styles.disabledBox,
          {
            borderColor: B.disabledBorder,
            backgroundColor: C.disabled,
            paddingHorizontal: compact ? T.spacing.md : T.spacing.lg,
          },
        ]}
      >
        {content}
      </View>
    );
  }

  if (gradientConfig) {
    const gradientFill = [
      compact ? styles.gradientCompact : styles.gradient,
      {
        height: buttonHeight - 2,
        minHeight: buttonHeight - 2,
        borderRadius: cornerRadius,
        overflow: 'hidden',
        paddingHorizontal: compact ? T.spacing.md : T.spacing.lg,
      },
    ];
    const gradientNode =
      Platform.OS === 'ios' ? (
        <View style={[gradientFill, styles.iosGradientStack]}>
          <LinearGradient
            colors={gradientConfig.colors}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: cornerRadius }]}
            pointerEvents="none"
          />
          <View style={styles.iosGradientForegroundShared}>{content}</View>
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
        innerRadius={cornerRadius}
        compact={compact}
        style={[shell, { borderColor: gradientConfig.border }]}
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
      compact={compact}
      style={[
        shell,
        flat,
        {
          paddingHorizontal: compact ? T.spacing.md : T.spacing.lg,
          justifyContent: 'center',
        },
      ]}
    >
      {content}
    </PressableShell>
  );
}

const styles = StyleSheet.create({
  touchableShell: {
    alignSelf: 'stretch',
  },
  pressScaleWrap: {
    alignSelf: 'stretch',
  },
  pressScaleInner: {
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressableFill: {
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'center',
  },
  pressableFillCompact: {
    alignSelf: 'stretch',
    width: '100%',
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  shellCompact: {
    width: '100%',
    alignSelf: 'stretch',
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
  gradient: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientCompact: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosGradientStack: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosGradientForegroundShared: {
    zIndex: 2,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  rowIos: {
    zIndex: 1,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0.2,
    flexShrink: 1,
    minWidth: 0,
  },
  textCompact: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
    letterSpacing: 0.15,
    flexShrink: 1,
    minWidth: 0,
  },
  textOnGradient: {
    backgroundColor: 'transparent',
  },
  textOnFlat: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
});
