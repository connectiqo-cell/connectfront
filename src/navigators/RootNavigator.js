import React, { useContext } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../contexts/AuthContext';
import { SplashScreen } from '../components/SplashScreen';
import { UNIFIED_THEME } from '../unifiedTheme';
import { SCREEN_NAMES } from './screenNames';
import { AuthNavigator } from './AuthNavigator';
import { UnifiedTabNavigator } from './UnifiedTabNavigator';
import SharedMentorProfileScreen from '../scenes/shared/MentorProfileScreen';
import BookingScreen from '../scenes/shared/BookingScreen';
import VideoCallScreen from '../scenes/shared/VideoCallScreen';
import RecordingPlayerScreen from '../scenes/shared/RecordingPlayerScreen';
import MentorAvailabilityScreen from '../scenes/mentor/AvailabilityScreen';
import EditProfileScreen from '../scenes/settings/EditProfileScreen';
import RecordedLecturesScreen from '../scenes/settings/RecordedLecturesScreen';
import TransactionHistoryScreen from '../scenes/settings/TransactionHistoryScreen';
import WalletScreen from '../scenes/settings/WalletScreen';
import ReviewScreen from '../scenes/shared/ReviewScreen';
import MentorReviewsScreen from '../scenes/shared/MentorReviewsScreen';
import CategoryMentorsScreen from '../scenes/learner/CategoryMentorsScreen';
import MentorVideosScreen from '../scenes/mentor/MentorVideosScreen';
import PayoutSetupScreen from '../scenes/settings/PayoutSetupScreen';
import ConnectivityScreen from '../scenes/settings/ConnectivityScreen';
import NotificationsScreen from '../scenes/settings/NotificationsScreen';
import RescheduleRequestScreen from '../scenes/shared/RescheduleRequestScreen';
import RescheduleResponseScreen from '../scenes/shared/RescheduleResponseScreen';
const RootStack = createStackNavigator();

/** Full-screen push — iOS: card + no swipe dismiss; Android: modal (unchanged). */
const LOCKED_SCREEN_OPTIONS = Platform.select({
  ios: {
    presentation: 'card',
    animationEnabled: false,
    gestureEnabled: false,
  },
  default: {
    presentation: 'modal',
    animationEnabled: false,
  },
});

/** Settings / profile overlays — iOS only: card so pull-down does not close the screen. */
const OVERLAY_SCREEN_OPTIONS = Platform.select({
  ios: {
    presentation: 'card',
    animationEnabled: false,
    gestureEnabled: false,
  },
  default: {
    presentation: 'modal',
    animationEnabled: false,
  },
});

export const RootNavigator = () => {
  const { session, loading, pendingPasswordReset } = useContext(AuthContext);
  const showAuth = !session || pendingPasswordReset;

  return (
    <View style={styles.root}>
    <RootStack.Navigator
      key={showAuth ? 'root-guest' : 'root-authed'}
      initialRouteName={showAuth ? 'Auth' : SCREEN_NAMES.RootUnifiedTabs}
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
        cardStyle: { backgroundColor: UNIFIED_THEME.colors.primary.void },
      }}
    >
      {showAuth ? (
        <RootStack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ animationEnabled: false }}
        />
      ) : (
        <>
          <RootStack.Screen
            name={SCREEN_NAMES.RootUnifiedTabs}
            component={UnifiedTabNavigator}
            options={{ animationEnabled: false }}
          />
          <RootStack.Group screenOptions={OVERLAY_SCREEN_OPTIONS}>
            <RootStack.Screen
              name={SCREEN_NAMES.EditProfile}
              component={EditProfileScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.RecordedLectures}
              component={RecordedLecturesScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.TransactionHistory}
              component={TransactionHistoryScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.Wallet}
              component={WalletScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.MentorProfile}
              component={SharedMentorProfileScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.MentorAvailability}
              component={MentorAvailabilityScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.CategoryMentors}
              component={CategoryMentorsScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.MentorVideos}
              component={MentorVideosScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.PayoutSetup}
              component={PayoutSetupScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.Connectivity}
              component={ConnectivityScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.Notifications}
              component={NotificationsScreen}
            />
          </RootStack.Group>
          <RootStack.Group screenOptions={LOCKED_SCREEN_OPTIONS}>
            <RootStack.Screen
              name={SCREEN_NAMES.Booking}
              component={BookingScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.VideoCall}
              component={VideoCallScreen}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.RecordingPlayer}
              component={RecordingPlayerScreen}
            />
          </RootStack.Group>
          <RootStack.Screen
            name={SCREEN_NAMES.Review}
            component={ReviewScreen}
            options={OVERLAY_SCREEN_OPTIONS}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.MentorReviews}
            component={MentorReviewsScreen}
            options={OVERLAY_SCREEN_OPTIONS}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.RescheduleRequest}
            component={RescheduleRequestScreen}
            options={OVERLAY_SCREEN_OPTIONS}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.RescheduleResponse}
            component={RescheduleResponseScreen}
            options={OVERLAY_SCREEN_OPTIONS}
          />
        </>
      )}
    </RootStack.Navigator>
    {loading ? (
      <View style={styles.splashOverlay} pointerEvents="none">
        <SplashScreen />
      </View>
    ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
