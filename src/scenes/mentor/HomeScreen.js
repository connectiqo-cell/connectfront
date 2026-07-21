import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import MentorProfileScreen from '../shared/MentorProfileScreen';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';

/**
 * Me → Profile tab: render the same full mentor profile used elsewhere in the app.
 * Resolves the current user id from profile or auth user so the screen works on
 * iOS and Android even while profile is still hydrating.
 */
export default function MentorDashboardScreen() {
  const styles = useThemedStyles(createMentorHomeStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const { profile, user, loading } = useAuth();
  const navigation = useNavigation();
  const mentorId = profile?.id ?? user?.id ?? null;

  if (!mentorId) {
    return (
      <View style={styles.center}>
        {(loading || user) ? (
          <ActivityIndicator size="large" color={GOLD} />
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

function createMentorHomeStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const isLight = T.mode === 'light';
  return StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
}