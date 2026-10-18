import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CosmicBottomTabBar } from '../components/CosmicBottomTabBar';
import FirstTimeGuide from '../components/FirstTimeGuide';
import { SCREEN_NAMES } from './screenNames';
import HomeScreen from '../scenes/home/HomeScreen';
import { MentorSectionNavigator } from './MentorSectionNavigator';
import { LearnerSectionNavigator } from './LearnerSectionNavigator';
import CollabHubScreen from '../scenes/collabhub/CollabHubScreen';
import UploadTabScreen from '../scenes/shared/UploadTabScreen';

const BottomTab = createBottomTabNavigator();

export const UnifiedTabNavigator = () => {
  return (
    <>
    <BottomTab.Navigator
      tabBar={(props) => <CosmicBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        lazy: true,
        // Pause inactive tab trees so decorative animations / effects stop.
        freezeOnBlur: true,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          height: 'auto',
        },
      }}
    >
      <BottomTab.Screen
        name={SCREEN_NAMES.UnifiedHome}
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name={SCREEN_NAMES.LearnerSection}
        component={LearnerSectionNavigator}
        options={{
          tabBarLabel: 'Search',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="search" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name={SCREEN_NAMES.UploadTab}
        component={UploadTabScreen}
        options={{
          tabBarLabel: 'Upload',
          tabBarSpecial: true,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="file-upload" size={size} color={color} />
          ),
        }}
      />
      <BottomTab.Screen
        name={SCREEN_NAMES.MentorSection}
        component={MentorSectionNavigator}
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Settings moved to the Home app bar — this slot earns more as the
          campaign feed, which is the only part of CollabHub a creator opens
          repeatedly. */}
      <BottomTab.Screen
        name={SCREEN_NAMES.CollabHubTab}
        component={CollabHubScreen}
        options={{
          tabBarLabel: 'Collab',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="auto-awesome" size={size} color={color} />
          ),
        }}
      />
    </BottomTab.Navigator>
    <FirstTimeGuide />
    </>
  );
};
