import React from 'react';
import { Platform } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SCREEN_NAMES } from './screenNames';
import { CosmicTopTabBar } from '../components/CapsuleTabBar';
import LearnerHomeScreen from '../scenes/learner/HomeScreen';
import LearnerVideosScreen from '../scenes/learner/VideosScreen';
import LearnerBookingsScreen from '../scenes/learner/BookingsScreen';

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

export const LearnerSectionNavigator = () => {
  return (
    <TopTab.Navigator
      tabBar={props => <CosmicTopTabBar {...props} compact />}
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        lazyPreloadDistance: 0,
        animationEnabled: true,
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
        name={SCREEN_NAMES.LearnerSearch}
        component={LearnerHomeScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: tabIcon('explore'),
        }}
      />
      <TopTab.Screen
        name={SCREEN_NAMES.LearnerVideos}
        component={LearnerVideosScreen}
        options={{
          tabBarLabel: 'Videos',
          tabBarIcon: tabIcon('play-circle-filled'),
        }}
      />
      <TopTab.Screen
        name={SCREEN_NAMES.LearnerBookings}
        component={LearnerBookingsScreen}
        options={{
          tabBarLabel: 'Bookings',
          tabBarIcon: tabIcon('event-note'),
        }}
      />
    </TopTab.Navigator>
  );
};
