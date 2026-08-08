import { View, Text, Image, StyleSheet } from 'react-native';
import CosmicBackground from './CosmicBackground';
import { CosmicLoader } from './LoadingSpinner';
import { useTheme } from '../hooks/useTheme';
import { getBrandLogo } from '../utils/brandLogo';

export function SplashScreen() {
  const { theme, isDark } = useTheme();
  const T = theme;

  return (
    <CosmicBackground style={styles.bg}>
      <View style={styles.center}>
        <Image
          source={getBrandLogo(isDark)}
          style={[
            styles.logo,
            { marginBottom: T.spacing.lg },
          ]}
          resizeMode="contain"
        />
        <Text
          style={[
            styles.name,
            {
              color: T.colors.text.primary,
              marginBottom: T.spacing.xxxl,
              textShadowColor: isDark
                ? 'rgba(167, 139, 250, 0.45)'
                : 'rgba(109, 74, 255, 0.2)',
            },
          ]}
        >
          Connectiqo
        </Text>
        <View style={[styles.spinnerWrap, { marginTop: T.spacing.sm }]}>
          <CosmicLoader size={48} />
        </View>
      </View>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  spinnerWrap: {},
});
