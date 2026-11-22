import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CosmicBackground from './CosmicBackground';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { cardFill, softBorder, softFill } from '../theme/surfaceStyles';
import { checkForceUpdate } from '../utils/forceUpdate';

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

/**
 * Blocks the whole app when app_config.min_<platform>_version is above this build.
 * Anything short of a reachable backend saying "too old" renders children as usual.
 */
export default function ForceUpdateGate({ children }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const C = theme.colors;
  const [gate, setGate] = React.useState(null);
  const [opening, setOpening] = React.useState(false);
  const [openFailed, setOpenFailed] = React.useState(false);

  React.useEffect(() => {
    checkForceUpdate().then(r => { if (r.required) setGate(r); });
  }, []);

  const openStore = React.useCallback(async () => {
    if (!gate?.storeUrl) return;
    setOpening(true);
    setOpenFailed(false);
    try {
      await Linking.openURL(gate.storeUrl);
    } catch {
      // No store app, or the link was rejected — show the url so the update is
      // still reachable instead of leaving a dead button behind.
      setOpenFailed(true);
    } finally {
      setOpening(false);
    }
  }, [gate]);

  if (!gate) return children;

  return (
    <CosmicBackground>
      <View
        style={[
          styles.wrap,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="system-update" size={34} color={C.accent.warning} />
          </View>

          <Text style={styles.title}>Update required</Text>
          <Text style={styles.body}>{gate.message}</Text>

          {gate.minBuild ? (
            <View style={styles.buildRow}>
              <View style={styles.buildCell}>
                <Text style={styles.buildLabel}>Installed</Text>
                <Text style={styles.buildValue}>Build {gate.currentBuild}</Text>
              </View>
              <MaterialIcons name="arrow-forward" size={16} color={C.text.muted} />
              <View style={styles.buildCell}>
                <Text style={styles.buildLabel}>Required</Text>
                <Text style={[styles.buildValue, styles.buildValueTarget]}>
                  Build {gate.minBuild}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={openStore}
            disabled={opening}
            accessibilityRole="button"
            accessibilityLabel={`Update Connectiqo on the ${STORE_NAME}`}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <LinearGradient
              colors={C.buttons.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonFill}
            >
              {opening ? (
                <ActivityIndicator size="small" color={C.buttons.primaryText} />
              ) : (
                <MaterialIcons name="open-in-new" size={18} color={C.buttons.primaryText} />
              )}
              <Text style={styles.buttonText}>
                {opening ? 'Opening…' : `Update on ${STORE_NAME}`}
              </Text>
            </LinearGradient>
          </Pressable>

          {openFailed ? (
            <Text style={styles.fallback} selectable>
              Could not open the {STORE_NAME}. Visit {gate.storeUrl}
            </Text>
          ) : (
            <Text style={styles.footnote}>
              This version can no longer connect securely.
            </Text>
          )}
        </View>
      </View>
    </CosmicBackground>
  );
}

function makeStyles(theme) {
  const T = theme;
  const C = theme.colors;
  return StyleSheet.create({
    wrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: T.spacing.lg,
    },
    card: {
      borderRadius: T.borderRadius.xl,
      borderWidth: 1,
      borderColor: softBorder(T),
      backgroundColor: cardFill(T),
      paddingVertical: T.spacing.xl,
      paddingHorizontal: T.spacing.lg,
      alignItems: 'center',
      ...T.shadows.medium,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface.accentWarning,
      borderWidth: 1,
      borderColor: C.buttons.warningBorder,
      marginBottom: T.spacing.md,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: C.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: C.text.secondary,
      textAlign: 'center',
    },
    buildRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: T.spacing.md,
      alignSelf: 'stretch',
      marginTop: T.spacing.lg,
      paddingVertical: T.spacing.md,
      borderRadius: T.borderRadius.md,
      backgroundColor: softFill(T),
    },
    buildCell: {
      alignItems: 'center',
      minWidth: 84,
    },
    buildLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: C.text.muted,
      marginBottom: 3,
    },
    buildValue: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text.secondary,
    },
    buildValueTarget: {
      color: C.accent.primary,
      fontWeight: '700',
    },
    button: {
      alignSelf: 'stretch',
      marginTop: T.spacing.lg,
      borderRadius: T.borderRadius.round,
      overflow: 'hidden',
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    buttonFill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: T.spacing.lg,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: C.buttons.primaryText,
    },
    footnote: {
      fontSize: 12,
      lineHeight: 18,
      color: C.text.muted,
      textAlign: 'center',
      marginTop: T.spacing.md,
    },
    fallback: {
      fontSize: 12,
      lineHeight: 18,
      color: C.accent.error,
      textAlign: 'center',
      marginTop: T.spacing.md,
    },
  });
}
