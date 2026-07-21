import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthContext } from '../contexts/AuthContext';
import { SplashScreen } from '../components/SplashScreen';
import { useTheme } from '../hooks/useTheme';
import { SCREEN_NAMES } from './screenNames';
import { createAndroidOverlayBackListeners } from '../hooks/useSystemBack';
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
import InterestsOnboardingScreen from '../scenes/auth/InterestsOnboardingScreen';
import { profileApi } from '../api/profileApi';
import { fetchActiveCategoryNames } from '../api/contentApi';
import { MENTOR_CATEGORIES } from '../constants/mentorCategories';
import { needsCategoryInterestOnboarding } from '../utils/mentorCategories';

const RootStack = createStackNavigator();

const androidOverlayBackListeners = createAndroidOverlayBackListeners();

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
    gestureEnabled: false,
  },
});

/** Settings / profile overlays — card presentation; swipe/back enabled on iOS. */
const OVERLAY_SCREEN_OPTIONS = Platform.select({
  ios: {
    presentation: 'card',
    animationEnabled: false,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  },
  default: {
    presentation: 'card',
    animationEnabled: false,
    gestureEnabled: false,
  },
});

export const RootNavigator = () => {
  const { session, loading, pendingPasswordReset } = useContext(AuthContext);
  const { theme } = useTheme();
  const showAuth = !session || pendingPasswordReset;
  /** null = still checking; true = must pick interests; false = ready for tabs */
  const [needsInterests, setNeedsInterests] = useState(null);

  const checkInterestsOnboarding = useCallback(async () => {
    if (!session?.user?.id || pendingPasswordReset) {
      setNeedsInterests(null);
      return;
    }
    try {
      const [learner, categoryNames] = await Promise.all([
        profileApi.getLearnerProfile(session.user.id).catch(() => null),
        fetchActiveCategoryNames(),
      ]);
      const known = categoryNames?.length ? categoryNames : MENTOR_CATEGORIES;
      setNeedsInterests(needsCategoryInterestOnboarding(learner?.interests, known));
    } catch {
      // Fail open so a profile blip doesn't block the app.
      setNeedsInterests(false);
    }
  }, [session?.user?.id, pendingPasswordReset]);

  useEffect(() => {
    if (showAuth) {
      setNeedsInterests(null);
      return;
    }
    setNeedsInterests(null);
    checkInterestsOnboarding();
  }, [showAuth, checkInterestsOnboarding]);

  // Never mount Welcome (or tabs) under splash — nested CosmicBackground is
  // transparent, so Welcome content used to show through the splash overlay.
  if (loading || (!showAuth && needsInterests === null)) {
    return (
      <View style={styles.root}>
        <SplashScreen />
      </View>
    );
  }

  const authedKey = needsInterests ? 'root-interests' : 'root-authed';

  return (
    <View style={styles.root}>
      <RootStack.Navigator
        key={showAuth ? 'root-guest' : authedKey}
        initialRouteName={
          showAuth
            ? 'Auth'
            : needsInterests
              ? SCREEN_NAMES.InterestsOnboarding
              : SCREEN_NAMES.RootUnifiedTabs
        }
        screenOptions={{
          headerShown: false,
          animationEnabled: false,
          cardStyle: { backgroundColor: theme.colors.primary.void },
        }}
      >
        {showAuth ? (
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animationEnabled: false }}
          />
        ) : needsInterests ? (
          <RootStack.Screen name={SCREEN_NAMES.InterestsOnboarding}>
            {() => (
              <InterestsOnboardingScreen onComplete={() => setNeedsInterests(false)} />
            )}
          </RootStack.Screen>
        ) : (
          <>
            <RootStack.Screen
              name={SCREEN_NAMES.RootUnifiedTabs}
              component={UnifiedTabNavigator}
              options={{ animationEnabled: false }}
            />
            <RootStack.Group
              screenOptions={OVERLAY_SCREEN_OPTIONS}
              screenListeners={androidOverlayBackListeners}
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
                listeners={androidOverlayBackListeners}
              />
              <RootStack.Screen
                name={SCREEN_NAMES.VideoCall}
                component={VideoCallScreen}
              />
              <RootStack.Screen
                name={SCREEN_NAMES.RecordingPlayer}
                component={RecordingPlayerScreen}
                listeners={androidOverlayBackListeners}
              />
            </RootStack.Group>
            <RootStack.Screen
              name={SCREEN_NAMES.Review}
              component={ReviewScreen}
              options={OVERLAY_SCREEN_OPTIONS}
              listeners={androidOverlayBackListeners}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.MentorReviews}
              component={MentorReviewsScreen}
              options={OVERLAY_SCREEN_OPTIONS}
              listeners={androidOverlayBackListeners}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.RescheduleRequest}
              component={RescheduleRequestScreen}
              options={OVERLAY_SCREEN_OPTIONS}
              listeners={androidOverlayBackListeners}
            />
            <RootStack.Screen
              name={SCREEN_NAMES.RescheduleResponse}
              component={RescheduleResponseScreen}
              options={OVERLAY_SCREEN_OPTIONS}
              listeners={androidOverlayBackListeners}
            />
          </>
        )}
      </RootStack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
