import React from 'react'; // eslint-disable-line
import { Platform } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SCREEN_NAMES } from './screenNames';
import { CosmicTopTabBar } from '../components/CapsuleTabBar';
import MentorDashboardScreen from '../scenes/mentor/HomeScreen';
import MentorCallsScreen from '../scenes/mentor/CallsScreen';
import MentorEarningsScreen from '../scenes/mentor/EarningsScreen';
import MentorAvailabilityScreen from '../scenes/mentor/AvailabilityScreen';

const TopTab = createMaterialTopTabNavigator();

const tabIcon =
  (name) =>
  ({ color, focused }) =>
    (
      <MaterialIcons
        name={name}
        size={focused ? 22 : 20}
        color={color}
      />
    );

export const MentorSectionNavigator = () => {
  return (
    <TopTab.Navigator
      tabBar={props => <CosmicTopTabBar {...props} compact />}
      screenOptions={{
        // iOS: horizontal pager swipe often cancels taps on dense slot grids.
        swipeEnabled: Platform.OS !== 'ios',
        lazy: true,
        lazyPreloadDistance: 1,
        animationEnabled: false,
        ...Platform.select({
          ios: {
            sceneStyle: { paddingTop: 0, marginTop: 0 },
          },
          default: {},
        }),
      }}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      sceneContainerStyle={{ flex: 1, backgroundColor: 'transparent', paddingTop: 0 }}
    >
      <TopTab.Screen
        name={SCREEN_NAMES.MentorDashboard}
        component={MentorDashboardScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: tabIcon('person'),
        }}
      />
      <TopTab.Screen
        name={SCREEN_NAMES.MentorCalls}
        component={MentorCallsScreen}
        options={{
          tabBarLabel: 'Sessions',
          tabBarIcon: tabIcon('video-call'),
        }}
      />
      <TopTab.Screen
        name={SCREEN_NAMES.MentorEarnings}
        component={MentorEarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: tabIcon('payments'),
        }}
      />
      <TopTab.Screen
        name={SCREEN_NAMES.MentorAvailabilityTab}
        component={MentorAvailabilityScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: tabIcon('calendar-today'),
        }}
      />
    </TopTab.Navigator>
  );
};
