import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../hooks/useTheme';
import { formatMentorFreezeUntil } from '../utils/mentorFreeze';

/**
 * Full-screen gate when the signed-in user's mentor side is frozen.
 * Learner tabs remain usable; Me / Upload show this instead.
 */
export default function MentorFrozenGate({ until = null, reason = null }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: c.warningBg }]}>
          <MaterialIcons name="ac-unit" size={36} color={c.warning} />
        </View>
        <Text style={[styles.title, { color: c.text?.primary || c.text }]}>
          Creator account frozen
        </Text>
        <Text style={[styles.body, { color: c.text?.secondary || c.textMuted || c.text }]}>
          Your creator profile and videos are hidden from others until{' '}
          <Text style={{ fontWeight: '600', color: c.text?.primary || c.text }}>
            {formatMentorFreezeUntil(until)}
          </Text>
          . You can still use Search and other features.
        </Text>
        {reason ? (
          <Text style={[styles.reason, { color: c.text?.muted || c.textMuted }]}>
            Reason: {reason}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  reason: {
    marginTop: 14,
    fontSize: 13,
    textAlign: 'center',
  },
});
