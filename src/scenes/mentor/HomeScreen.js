import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import MentorProfileScreen from '../shared/MentorProfileScreen';
import { UNIFIED_THEME } from '../../unifiedTheme';

/**
 * Me → Profile tab: render the same full mentor profile used elsewhere in the app.
 * Resolves the current user id from profile or auth user so the screen works on
 * iOS and Android even while profile is still hydrating.
 */
export default function MentorDashboardScreen() {
  const { profile, user, loading } = useAuth();
  const navigation = useNavigation();
  const mentorId = profile?.id ?? user?.id ?? null;

  if (!mentorId) {
    return (
      <View style={styles.center}>
        {(loading || user) ? (
          <ActivityIndicator size="large" color={UNIFIED_THEME.colors.accent.primary} />
        ) : null}
      </View>
    );
  }

  return (
    <MentorProfileScreen
      route={{ params: { mentorId } }}
      navigation={navigation}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
