import React from 'react'; // eslint-disable-line
import { createStackNavigator } from '@react-navigation/stack';
import { UNIFIED_THEME } from '../unifiedTheme';
import { SCREEN_NAMES } from './screenNames';
import { createAndroidOverlayBackListeners } from '../hooks/useSystemBack';
import WelcomeScreen from '../scenes/auth/WelcomeScreen';
import SignupScreen from '../scenes/auth/SignupScreen';
import LoginScreen from '../scenes/auth/LoginScreen';
import ForgotPasswordScreen from '../scenes/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../scenes/auth/ResetPasswordScreen';
const AuthStack = createStackNavigator();
const androidAuthBackListeners = createAndroidOverlayBackListeners();

export const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: false,
        cardStyle: { backgroundColor: UNIFIED_THEME.colors.primary.void },
      }}
      screenListeners={androidAuthBackListeners}
    >
      <AuthStack.Screen name={SCREEN_NAMES.Welcome} component={WelcomeScreen} />
      <AuthStack.Screen name={SCREEN_NAMES.Signup} component={SignupScreen} />
      <AuthStack.Screen name={SCREEN_NAMES.Login} component={LoginScreen} />
      <AuthStack.Screen name={SCREEN_NAMES.ForgotPassword} component={ForgotPasswordScreen} />
      <AuthStack.Screen name={SCREEN_NAMES.ResetPassword} component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
};
