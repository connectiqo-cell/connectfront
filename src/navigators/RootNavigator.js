import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
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
import LearnerVideosScreen from '../scenes/learner/VideosScreen';
import PayoutSetupScreen from '../scenes/settings/PayoutSetupScreen';
import ConnectivityScreen from '../scenes/settings/ConnectivityScreen';
import NotificationsScreen from '../scenes/settings/NotificationsScreen';
import RescheduleRequestScreen from '../scenes/shared/RescheduleRequestScreen';
import RescheduleResponseScreen from '../scenes/shared/RescheduleResponseScreen';
const RootStack = createStackNavigator();

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
          <RootStack.Group
            screenOptions={{
              presentation: 'modal',
              animationEnabled: false,
            }}
          >
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
              name={SCREEN_NAMES.Booking}
              component={BookingScreen}
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
              name={SCREEN_NAMES.MentorVideoFeed}
              component={LearnerVideosScreen}
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
          <RootStack.Screen
            name={SCREEN_NAMES.VideoCall}
            component={VideoCallScreen}
            options={{ animationEnabled: false }}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.RecordingPlayer}
            component={RecordingPlayerScreen}
            options={{ animationEnabled: false }}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.Review}
            component={ReviewScreen}
            options={{ animationEnabled: false }}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.MentorReviews}
            component={MentorReviewsScreen}
            options={{ animationEnabled: false }}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.RescheduleRequest}
            component={RescheduleRequestScreen}
            options={{ animationEnabled: false }}
          />
          <RootStack.Screen
            name={SCREEN_NAMES.RescheduleResponse}
            component={RescheduleResponseScreen}
            options={{ animationEnabled: false }}
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
