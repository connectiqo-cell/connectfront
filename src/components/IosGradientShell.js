import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const INNER_LAYOUT_KEYS = new Set([
  'flexDirection',
  'alignItems',
  'justifyContent',
  'flexWrap',
  'gap',
  'rowGap',
  'columnGap',
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'minHeight',
]);

function splitGradientStyles(style) {
  const flat = StyleSheet.flatten(style) || {};
  const inner = {};
  const outer = {};

  Object.entries(flat).forEach(([key, value]) => {
    if (value == null) return;
    if (INNER_LAYOUT_KEYS.has(key)) {
      inner[key] = value;
    } else {
      outer[key] = value;
    }
  });

  if (Platform.OS === 'ios' && inner.flexDirection == null) {
    inner.flexDirection = 'row';
    inner.alignItems = inner.alignItems ?? 'center';
    inner.justifyContent = inner.justifyContent ?? 'center';
  }

  return { outer, inner };
}

/**
 * iOS: gradient background + foreground row/column for labels (renders reliably).
 * Android: standard LinearGradient wrapper (unchanged).
 */
export default function IosGradientShell({ colors, start, end, style, innerStyle, children }) {
  if (Platform.OS !== 'ios') {
    return (
      <LinearGradient colors={colors} start={start} end={end} style={style}>
        {children}
      </LinearGradient>
    );
  }

  const { outer, inner } = splitGradientStyles(style);

  return (
    <View style={[outer, styles.iosRoot]}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[styles.iosInner, inner, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  iosRoot: {
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  iosInner: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
});
