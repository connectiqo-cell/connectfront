import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CosmicBackground from '../../components/CosmicBackground';
import CosmicButton from '../../components/CosmicButton';
import { CircularGradientFrame } from '../../components/CircularGradientFrame';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { PLATFORM_LAYOUT } from '../../utils/platformLayout';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const LOGO_FRAME_SIZE = 96;
const LOGO_IMAGE_SIZE = 58;

const ENTRANCE = {
  duration: 520,
  easing: Easing.out(Easing.cubic),
};

function runFadeSlide(opacity, translateY, delay = 0) {
  return Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      delay,
      duration: ENTRANCE.duration,
      easing: ENTRANCE.easing,
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      delay,
      duration: ENTRANCE.duration,
      easing: ENTRANCE.easing,
      useNativeDriver: true,
    }),
  ]);
}

export default function WelcomeScreen({ navigation }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;

  const logoO = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(28)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;

  const titleO = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(20)).current;

  const nameO = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(22)).current;
  const nameScale = useRef(new Animated.Value(0.92)).current;

  const subO = useRef(new Animated.Value(0)).current;
  const subY = useRef(new Animated.Value(18)).current;

  const btnO = useRef(new Animated.Value(0)).current;
  const btnY = useRef(new Animated.Value(24)).current;

  const statsO = useRef(new Animated.Value(0)).current;
  const statsY = useRef(new Animated.Value(20)).current;

  const linkO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(85, [
      runFadeSlide(logoO, logoY, 0),
      runFadeSlide(titleO, titleY, 0),
      Animated.parallel([
        Animated.timing(nameO, {
          toValue: 1,
          duration: ENTRANCE.duration,
          easing: ENTRANCE.easing,
          useNativeDriver: true,
        }),
        Animated.timing(nameY, {
          toValue: 0,
          duration: ENTRANCE.duration,
          easing: ENTRANCE.easing,
          useNativeDriver: true,
        }),
        Animated.spring(nameScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      runFadeSlide(subO, subY, 0),
      runFadeSlide(btnO, btnY, 0),
      runFadeSlide(statsO, statsY, 0),
      Animated.timing(linkO, {
        toValue: 1,
        duration: 420,
        easing: ENTRANCE.easing,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.06,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const spinLoop = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();
    spinLoop.start();
    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [logoPulse, ringSpin]);

  const ringRotate = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const ringRotateSlow = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.logoOrbitWrap,
              { opacity: logoO, transform: [{ translateY: logoY }] },
            ]}
          >
            <Animated.View
              style={[
                styles.orbitRing,
                styles.orbitRingOuter,
                { transform: [{ rotate: ringRotate }] },
              ]}
            />
            <Animated.View
              style={[
                styles.orbitRing,
                styles.orbitRingInner,
                { transform: [{ rotate: ringRotateSlow }] },
              ]}
            />
            <Animated.View
              style={[styles.logoContainer, { transform: [{ scale: logoPulse }] }]}
            >
              <CircularGradientFrame
                size={LOGO_FRAME_SIZE}
                ringWidth={3}
                colors={B.premiumGradient}
                innerBg={C.primary.void}
                style={theme.shadows.medium}
              >
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </CircularGradientFrame>
            </Animated.View>
          </Animated.View>

          <Animated.Text
            style={[
              styles.eyebrow,
              { opacity: titleO, transform: [{ translateY: titleY }] },
            ]}
          >
            1-on-1 Live Mentorship
          </Animated.Text>

          <Animated.Text
            style={[
              styles.title,
              { opacity: titleO, transform: [{ translateY: titleY }] },
            ]}
          >
            Connect with your
          </Animated.Text>

          <Animated.View
            style={[
              styles.appNameContainer,
              {
                opacity: nameO,
                transform: [{ translateY: nameY }, { scale: nameScale }],
              },
            ]}
          >
            <Text style={styles.appName}>Connectiqo</Text>
            <View style={styles.nameUnderline} />
          </Animated.View>

          <Animated.Text
            style={[
              styles.subtitle,
              { opacity: subO, transform: [{ translateY: subY }] },
            ]}
          >
            Learn from experts — or share your expertise with the world.
          </Animated.Text>

          <View style={styles.chipsRow}>
            <Animated.View
              style={[styles.chip, styles.chipAccent, { opacity: subO, transform: [{ translateY: subY }] }]}
            >
              <MaterialIcons name="bolt" size={14} color={GOLD} />
              <Text style={styles.chipText}>Live sessions</Text>
            </Animated.View>
            <Animated.View
              style={[styles.chip, { opacity: subO, transform: [{ translateY: subY }] }]}
            >
              <MaterialIcons name="verified" size={14} color={TEAL} />
              <Text style={styles.chipText}>Trusted mentors</Text>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.buttonWrap,
              {
                opacity: btnO,
                transform: [{ translateY: btnY }],
              },
            ]}
          >
            <CosmicButton
              label="Get started"
              variant="nebula"
              icon="arrow-forward"
              onPress={() => navigation.navigate(SCREEN_NAMES.Signup)}
              pressScale
              pill
              style={styles.welcomeButton}
            />
          </Animated.View>

          <Animated.View style={{ opacity: linkO, width: '100%' }}>
            <TouchableOpacity
              onPress={() => navigation.navigate(SCREEN_NAMES.Login)}
              activeOpacity={0.7}
              style={styles.signInRow}
            >
              <Text style={styles.signInMuted}>Already have an account? </Text>
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={[
              styles.statsContainer,
              { opacity: statsO, transform: [{ translateY: statsY }] },
            ]}
          >
            <View style={styles.statItem}>
              <MaterialIcons name="verified-user" size={20} color={GOLD} style={styles.statIcon} />
              <Text style={styles.statText}>Expert Mentors</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statItem}>
              <MaterialIcons name="videocam" size={20} color={PURPLE_LINK} style={styles.statIcon} />
              <Text style={styles.statText}>Live 1-on-1</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statItem}>
              <MaterialIcons name="lock" size={20} color={TEAL} style={styles.statIcon} />
              <Text style={styles.statText}>Secure Payments</Text>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const isLight = T.mode === 'light';

  return StyleSheet.create({
    background: {
      flex: 1,
    },
    overlay: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.xl,
    },
    logoOrbitWrap: {
      width: 140,
      height: 140,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: T.spacing.xl,
    },
    orbitRing: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: isLight ? 'rgba(109, 74, 255, 0.28)' : 'rgba(167, 139, 250, 0.35)',
      borderRadius: 999,
      borderStyle: 'dashed',
    },
    orbitRingOuter: {
      width: 132,
      height: 132,
    },
    orbitRingInner: {
      width: 108,
      height: 108,
      borderColor: isLight ? 'rgba(109, 74, 255, 0.18)' : 'rgba(94, 234, 212, 0.25)',
    },
    logoContainer: {
      width: LOGO_FRAME_SIZE,
      height: LOGO_FRAME_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoImage: {
      width: LOGO_IMAGE_SIZE,
      height: LOGO_IMAGE_SIZE,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      color: PURPLE_LINK,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: T.spacing.sm,
      textAlign: 'center',
    },
    title: {
      fontSize: 16,
      color: C.text.secondary,
      textAlign: 'center',
      marginBottom: T.spacing.xs,
      fontWeight: '600',
    },
    appNameContainer: {
      marginBottom: T.spacing.lg,
      alignItems: 'center',
    },
    appName: {
      fontSize: 42,
      fontWeight: '800',
      color: C.text.primary,
      textAlign: 'center',
      letterSpacing: -0.5,
      lineHeight: 50,
    },
    nameUnderline: {
      marginTop: T.spacing.sm,
      height: 3,
      width: 56,
      borderRadius: 2,
      backgroundColor: GOLD,
      opacity: 0.9,
    },
    subtitle: {
      fontSize: 15,
      color: C.text.secondary,
      textAlign: 'center',
      marginBottom: T.spacing.md,
      lineHeight: 24,
      paddingHorizontal: T.spacing.sm,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: T.spacing.xs,
      marginBottom: T.spacing.xl,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: T.spacing.sm,
      borderRadius: T.borderRadius.chip,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    chipAccent: {
      backgroundColor: S.accentGold,
      borderColor: isLight ? 'rgba(109,74,255,0.22)' : 'rgba(240,216,117,0.25)',
    },
    chipText: {
      fontSize: 10,
      color: C.text.primary,
      fontWeight: '700',
    },
    buttonWrap: {
      width: '100%',
      marginBottom: T.spacing.md,
    },
    welcomeButton: {
      marginVertical: 0,
      height: PLATFORM_LAYOUT.buttonMinHeight,
      borderRadius: Math.ceil(PLATFORM_LAYOUT.buttonMinHeight / 2),
      overflow: 'hidden',
    },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: T.spacing.xl,
      paddingVertical: T.spacing.sm,
    },
    signInMuted: {
      fontSize: 14,
      color: C.text.muted,
    },
    signInLink: {
      fontSize: 14,
      color: PURPLE_LINK,
      fontWeight: '700',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'stretch',
      width: '100%',
      paddingHorizontal: 4,
      paddingVertical: 11,
      backgroundColor: softFill(theme),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statIcon: {
      marginBottom: 4,
    },
    statText: {
      fontSize: 10,
      color: C.text.secondary,
      textAlign: 'center',
      fontWeight: '700',
    },
    divider: {
      width: 1,
      backgroundColor: softFillStrong(theme),
      marginVertical: 6,
      alignSelf: 'stretch',
    },
  });
}
