import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../hooks/useTheme';
import { checkForceUpdate } from '../utils/forceUpdate';

/**
 * Blocks the whole app when app_config.min_<platform>_version is above this build.
 * Anything short of a reachable backend saying "too old" renders children as usual.
 */
export default function ForceUpdateGate({ children }) {
  const { theme } = useTheme();
  const [gate, setGate] = React.useState(null);

  React.useEffect(() => {
    checkForceUpdate().then(r => { if (r.required) setGate(r); });
  }, []);

  if (!gate) return children;

  const c = theme.colors;
  const textPrimary = c.text?.primary || c.text;

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: c.warningBg }]}>
          <MaterialIcons name="system-update" size={36} color={c.warning} />
        </View>
        <Text style={[styles.title, { color: textPrimary }]}>Update required</Text>
        <Text style={[styles.body, { color: c.text?.secondary || c.textMuted || c.text }]}>
          {gate.message}
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: c.accent?.primary || c.primary }]}
          onPress={() => Linking.openURL(gate.storeUrl)}
        >
          <Text style={styles.buttonText}>Update now</Text>
        </Pressable>
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
  button: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
