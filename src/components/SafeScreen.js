import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIFIED_THEME } from '../unifiedTheme';
import { getFloatingTabBarContentInset } from './CosmicBottomTabBar';
import CosmicBackground from './CosmicBackground';

/**
 * SafeScreen - Uses react-native-safe-area-context for better safe area handling
 * Ensures all screens fit safely on any mobile device with notches, bottom bars, tabs, etc.
 *
 * Stack/modal screens: set includeTopInset={false} — iOS modal presentation already
 * clears the status bar. Optional StackScreenHeader wraps the app bar (layout only).
 */
export const SafeScreen = ({
  children,
  scrollable = true,
  backgroundColor = 'transparent',
  padding = UNIFIED_THEME.spacing.lg,
  hasBottomTabs = true,
  /** When false, top inset is omitted (material top tabs or iOS stack modal handles it). */
  includeTopInset = true,
  refreshControl,
}) => {
  const insets = useSafeAreaInsets();

  const bottomTabHeight = hasBottomTabs ? getFloatingTabBarContentInset(insets) : 0;
  const topPad = padding + (includeTopInset ? insets.top : 0);

  const paddingStyle = {
    backgroundColor,
    paddingTop: topPad,
    paddingBottom: insets.bottom + bottomTabHeight,
    paddingLeft: padding + insets.left,
    paddingRight: padding + insets.right,
  };

  return (
    <CosmicBackground style={styles.safeArea}>
      {scrollable ? (
        <ScrollView
          style={styles.flex1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={paddingStyle}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, paddingStyle]}>
          {children}
        </View>
      )}
    </CosmicBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    position: 'relative',
  },
});
