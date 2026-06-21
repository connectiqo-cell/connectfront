import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

/**
 * iOS: gradient background + foreground content layer (labels render reliably).
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

  return (
    <View style={[style, styles.iosRoot]}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[styles.iosInner, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  iosRoot: {
    position: 'relative',
    overflow: 'hidden',
  },
  iosInner: {
    zIndex: 1,
    backgroundColor: 'transparent',
    width: '100%',
    alignSelf: 'stretch',
  },
});
