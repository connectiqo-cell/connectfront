import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

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
  innerBg = '#0f0e2a',
  borderColor = 'rgba(255,255,255,0.35)',
  style,
  children,
}) {
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
          borderColor,
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
            backgroundColor: innerBg,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Profile / avatar photo inside a gradient ring. */
export function CircularProfileImage({
  size,
  ringWidth = 2,
  uri,
  colors,
  start,
  end,
  innerBg = '#0f0e2a',
  borderColor,
  style,
  fallback,
  imageStyle,
  imageProps,
}) {
  const innerSize = size - ringWidth * 2;

  return (
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
