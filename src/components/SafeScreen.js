import { ScrollView, View, StyleSheet } from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { UNIFIED_THEME } from '../unifiedTheme';

import { getFloatingTabBarContentInset } from './CosmicBottomTabBar';

import CosmicBackground from './CosmicBackground';

import { getScreenContentTopPadding } from '../utils/platformLayout';



/**

 * SafeScreen - Uses react-native-safe-area-context for better safe area handling

 * Ensures all screens fit safely on any mobile device with notches, bottom bars, tabs, etc.

 */

export const SafeScreen = ({

  children,

  scrollable = true,

  backgroundColor = 'transparent',

  padding = UNIFIED_THEME.spacing.lg,

  hasBottomTabs = true, // Add extra space for bottom tab navigator

  /** When false, top inset is omitted (e.g. material top tab bar already clears status bar). */

  includeTopInset = true,

  refreshControl,

}) => {

  const insets = useSafeAreaInsets();



  const bottomTabHeight = hasBottomTabs ? getFloatingTabBarContentInset(insets) : 0;

  const topPad = getScreenContentTopPadding(padding);



  const paddingStyle = {

    backgroundColor,

    paddingTop: topPad,

    paddingBottom: insets.bottom + bottomTabHeight,

    paddingLeft: padding + insets.left,

    paddingRight: padding + insets.right,

  };



  const body = scrollable ? (

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

  );



  const insetBody = includeTopInset ? (

    <SafeAreaView edges={['top']} style={styles.flex1}>

      {body}

    </SafeAreaView>

  ) : (

    body

  );



  return (

    <CosmicBackground style={styles.safeArea}>

      {insetBody}

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


