import { createContext, useContext, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../hooks/useTheme';

const CosmicBackgroundDepthContext = createContext(false);

/** Keep star Views low: each is a layout node under every screen. */
const STAR_COUNT = 24;

function buildStarField(count, starColor, opacityMin, opacityMax) {
  let seed = 62831;
  const next = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 0xffffffff;
  };
  const stars = [];
  for (let i = 0; i < count; i++) {
    const roll = next();
    const size = roll > 0.88 ? 2.5 : roll > 0.55 ? 1.5 : 1;
    stars.push({
      key: i,
      left: `${next() * 100}%`,
      top: `${next() * 100}%`,
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: opacityMin + next() * (opacityMax - opacityMin),
      color: starColor,
    });
  }
  return stars;
}

/**
 * Full-screen cosmic background: galaxy gradient, nebula haze, star field.
 * Adapts to dark / light theme via ThemeContext.
 * Nested instances skip redrawing stars/gradients (avoids double cost under SafeScreen).
 */
export default function CosmicBackground({ children, style }) {
  const nested = useContext(CosmicBackgroundDepthContext);
  const { theme, mode } = useTheme();
  const { primary, cosmic } = theme.colors;

  const stars = useMemo(
    () =>
      nested
        ? null
        : buildStarField(
            STAR_COUNT,
            cosmic.starColor,
            cosmic.starOpacityMin,
            cosmic.starOpacityMax,
          ),
    [nested, mode, cosmic.starColor, cosmic.starOpacityMin, cosmic.starOpacityMax],
  );

  if (nested) {
    return <View style={[styles.root, style]}>{children}</View>;
  }

  return (
    <CosmicBackgroundDepthContext.Provider value={true}>
      <View style={[styles.root, { backgroundColor: primary.void }, style]}>
        <LinearGradient
          colors={primary.gradient}
          locations={cosmic.mainGradientLocations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={cosmic.nebulaHaze}
          locations={cosmic.nebulaLocations}
          start={{ x: 0.15, y: 1 }}
          end={{ x: 0.85, y: 0 }}
          style={[StyleSheet.absoluteFill, { opacity: cosmic.hazeOpacity }]}
          pointerEvents="none"
        />
        <View style={styles.starLayer} pointerEvents="none">
          {stars.map((s) => (
            <View
              key={s.key}
              style={[
                styles.star,
                {
                  left: s.left,
                  top: s.top,
                  width: s.width,
                  height: s.height,
                  borderRadius: s.borderRadius,
                  opacity: s.opacity,
                  backgroundColor: s.color,
                },
              ]}
            />
          ))}
        </View>
        {children}
      </View>
    </CosmicBackgroundDepthContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
  },
});
