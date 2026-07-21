import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../../../hooks/useTheme';

/**
 * Brief connecting state while the VideoSDK room is being joined.
 */
export default function WaitingToJoinView({ otherUser, isMentor }) {
  const styles = useThemedStyles(createWaitingStyles);
  const { theme } = useTheme();
  const TEAL = theme.colors.accent.secondary;
  const otherName = otherUser?.name || (isMentor ? 'your learner' : 'your mentor');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.colors.surface.heroGradient}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.iconRing}>
          <MaterialIcons name="videocam" size={32} color={TEAL} />
        </View>
        <Text style={styles.title}>Connecting to session</Text>
        <Text style={styles.subtitle}>Setting up your room with {otherName}…</Text>
        <ActivityIndicator size="large" color={TEAL} style={styles.spinner} />
      </View>
    </View>
  );
}

function createWaitingStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const TEAL = C.accent.secondary;
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.primary.void,
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: T.spacing.xl,
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${TEAL}1F`,
      borderWidth: 1,
      borderColor: `${TEAL}59`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: T.spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: C.text.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: C.text.muted,
      textAlign: 'center',
      marginTop: T.spacing.sm,
      lineHeight: 20,
    },
    spinner: {
      marginTop: T.spacing.xl,
    },
  });
}
