import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAvatarPreviewOptional } from '../contexts/AvatarPreviewContext';
import { useTheme } from '../hooks/useTheme';
import { avatarWell, ringBorder } from '../theme/surfaceStyles';

/**
 * Gradient ring with a circular inner clip.
 * Gradient is absolute-fill (not padding) so iOS centers photos/logos correctly.
 */
export function CircularGradientFrame({
  size,
  ringWidth = 3,
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  innerBg,
  borderColor,
  style,
  children,
}) {
  const { theme } = useTheme();
  const resolvedInnerBg = innerBg ?? avatarWell(theme);
  const resolvedBorder = borderColor ?? ringBorder(theme);
  const radius = size / 2;
  const innerSize = size - ringWidth * 2;
  const innerRadius = innerSize / 2;

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: resolvedBorder,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View
        style={[
          styles.inner,
          {
            top: ringWidth,
            left: ringWidth,
            width: innerSize,
            height: innerSize,
            borderRadius: innerRadius,
            backgroundColor: resolvedInnerBg,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Profile / avatar photo inside a gradient ring. Tap to preview when uri or previewName is set. */
export function CircularProfileImage({
  size,
  ringWidth = 2,
  uri,
  colors,
  start,
  end,
  innerBg,
  borderColor,
  style,
  fallback,
  imageStyle,
  imageProps,
  onPress,
  previewName,
  pressable,
}) {
  const innerSize = size - ringWidth * 2;
  const avatarPreview = useAvatarPreviewOptional();

  const content = (
    <CircularGradientFrame
      size={size}
      ringWidth={ringWidth}
      colors={colors}
      start={start}
      end={end}
      innerBg={innerBg}
      borderColor={borderColor}
      style={style}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[{ width: innerSize, height: innerSize }, imageStyle]}
          resizeMode="cover"
          {...imageProps}
        />
      ) : (
        fallback
      )}
    </CircularGradientFrame>
  );

  const shouldPress = pressable !== false && Boolean(onPress || previewName || uri);
  const handlePress = onPress ?? (shouldPress && avatarPreview
    ? () => avatarPreview.showAvatarPreview({ uri, name: previewName || '' })
    : undefined);

  if (!handlePress) return content;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={previewName ? `View ${previewName}'s profile photo` : 'View profile photo'}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  inner: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
