import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIFIED_THEME } from '../unifiedTheme';
import { getFloatingTabBarContentInset } from './CosmicBottomTabBar';

/**
 * SafeScreen - Uses react-native-safe-area-context for better safe area handling
 * Ensures all screens fit safely on any mobile device with notches, bottom bars, tabs, etc.
 *
 * Background comes from the root CosmicBackground in App.js; do not nest another here.
 *
 * iOS stack overlays: SafeScreen includeTopInset={false} + StackScreenHeader (single status-bar inset).
 * Android stack overlays: SafeScreen includeTopInset={true} (default); use STACK_OVERLAY_LAYOUT.
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
  scrollViewRef,
  contentContainerStyle,
}) => {
  const insets = useSafeAreaInsets();

  // getFloatingTabBarContentInset already includes the home-indicator inset.
  const bottomTabHeight = hasBottomTabs ? getFloatingTabBarContentInset(insets) : 0;
  const topPad = padding + (includeTopInset ? insets.top : 0);

  const paddingStyle = {
    backgroundColor,
    paddingTop: topPad,
    paddingBottom: hasBottomTabs ? bottomTabHeight : insets.bottom,
    paddingLeft: padding + insets.left,
    paddingRight: padding + insets.right,
  };

  return (
    <View style={styles.safeArea}>
      {scrollable ? (
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[paddingStyle, contentContainerStyle]}
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
    </View>
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
