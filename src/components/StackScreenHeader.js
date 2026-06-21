import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIFIED_THEME as T } from '../unifiedTheme';

/**
 * App bar wrapper for stack overlay screens (Settings, Booking, etc.).
 * On iOS, use with SafeScreen includeTopInset={false} and insetTop={true} (see STACK_OVERLAY_LAYOUT).
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
