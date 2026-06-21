import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIFIED_THEME as T } from '../unifiedTheme';

/**
 * App bar wrapper for stack overlay screens (Settings, Booking, etc.).
 * Use with SafeScreen includeTopInset={false} so the status-bar inset is applied once here.
 * Set insetTop={false} when SafeScreen already applies includeTopInset (e.g. bottom-tab screens).
 */
export default function StackScreenHeader({ children, style, insetTop = true }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        insetTop && { paddingTop: insets.top + T.spacing.xs },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
