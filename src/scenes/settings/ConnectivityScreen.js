import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import Button from '../../components/Button';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { SUPABASE_URL } from '../../lib/supabase';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = C.surface.panel;
const INPUT_BG = C.surface.sheet;

function maskHost(url) {
  if (!url) return 'Not configured';
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return url.length > 48 ? `${url.slice(0, 46)}…` : url;
  }
}

function Row({ icon, title, subtitle, accent, accentBg }) {
  const styles = useThemedStyles(createConnectivityStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  return (
    <View style={styles.row}>
      <View style={[styles.rowIconBg, { backgroundColor: accentBg }]}>
        <MaterialIcons name={icon} size={22} color={accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function ConnectivityScreen({ navigation }) {
  const styles = useThemedStyles(createConnectivityStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const endpoints = useMemo(
    () => ({
      supabase: maskHost(SUPABASE_URL),
      tokenServer: maskHost(`${SUPABASE_URL}/functions/v1/get-videosdk-token`),
    }),
    [],
  );

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop} style={styles.headerShell}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connectivity</Text>
        <View style={styles.headerSpacer} />
      </View>
      </StackScreenHeader>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Overview of endpoints this build talks to. Add real reachability checks when you wire the backend.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>From .env</Text>
          <Row
            icon="cloud"
            title="Supabase"
            subtitle={endpoints.supabase}
            accent={TEAL}
            accentBg={S.accentTeal}
          />
          <View style={styles.divider} />
          <Row
            icon="vpn-key"
            title="Token / auth server"
            subtitle={endpoints.tokenServer}
            accent={GOLD}
            accentBg={S.accentGold}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Device</Text>
          <Row
            icon="wifi-tethering"
            title="Network status"
            subtitle="Not monitored yet — install @react-native-community/netinfo to show online / offline."
            accent={PURPLE_LINK}
            accentBg={S.accentViolet}
          />
        </View>

        <Button
          text="Run check (placeholder)"
          icon="sync"
          variant="info"
          onPress={() => Toast.show('Wire NetInfo + health checks when backend is ready', Toast.SHORT)}
          style={styles.checkBtnThemed}
        />
      </ScrollView>
    </SafeScreen>
  );
}

function createConnectivityStyles(theme) {
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
  headerShell: {
    paddingHorizontal: T.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: C.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    color: C.accent.primary,
    fontWeight: '800',
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.xxxl,
  },
  intro: {
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 20,
    marginBottom: T.spacing.lg,
  },
  card: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    padding: T.spacing.lg,
    marginBottom: T.spacing.md,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: PURPLE_LINK,
    textTransform: 'uppercase',
    marginBottom: T.spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: T.spacing.md },
  rowIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.text.primary, marginBottom: 4 },
  rowSub: { fontSize: 12, color: C.text.secondary, lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(167,139,250,0.15)',
    marginVertical: T.spacing.md,
    marginLeft: 44 + T.spacing.md,
  },
  checkBtnThemed: { marginVertical: T.spacing.sm },
});
}