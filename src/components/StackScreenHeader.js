import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Status-bar inset for stack/modal screens (Settings sub-screens, etc.).
 * Pair with SafeScreen includeTopInset={false} so iOS does not double-count safe area.
 */
export default function StackScreenHeader({ children, style }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
