import { View, Text, StyleSheet } from 'react-native';
import { CosmicLoader } from './LoadingSpinner';
import { useTheme } from '../hooks/useTheme';

/**
 * In-screen overlay (not a Modal) so preloaded tab screens cannot block the whole app.
 */
export const LoadingOverlay = ({
  visible = false,
  message = 'Loading...',
  backdropOpacity,
}) => {
  const { theme, isDark } = useTheme();
  const opacity = backdropOpacity ?? (isDark ? 0.75 : 0.55);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View
        style={[
          styles.backdrop,
          {
            opacity,
            backgroundColor: theme.colors.primary.void,
          },
        ]}
        pointerEvents="none"
      />
      <View style={styles.center} pointerEvents="none">
        <CosmicLoader size={56} />
        {message ? (
          <Text
            style={[
              styles.message,
              {
                ...theme.typography.bodyMd,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing.md,
              },
            ]}
          >
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
