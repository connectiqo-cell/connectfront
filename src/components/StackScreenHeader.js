import { View, StyleSheet } from 'react-native';

/**
 * Header shell for stack/modal screens (Settings sub-screens, Booking, etc.).
 * Use with SafeScreen includeTopInset={false} — iOS modal presentation already
 * clears the status bar, so do not add insets.top here (causes double spacing).
 */
export default function StackScreenHeader({ children, style }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
