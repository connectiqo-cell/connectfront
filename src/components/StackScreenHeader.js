import { View, StyleSheet } from 'react-native';

/**
 * Header shell for stack/modal screens (Settings sub-screens, Booking, etc.).
 * Use with SafeScreen includeTopInset={false} for stack overlay screens.
 */
export default function StackScreenHeader({ children, style }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
});
