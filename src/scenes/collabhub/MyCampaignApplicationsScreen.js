import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { collabHubApi } from '../../api/collabHubApi';

const money = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS = {
  pending: { label: 'Pending', icon: 'schedule', tone: 'warning' },
  shortlisted: { label: 'Shortlisted', icon: 'star', tone: 'info' },
  accepted: { label: 'Accepted', icon: 'check-circle', tone: 'success' },
  rejected: { label: 'Not selected', icon: 'cancel', tone: 'error' },
};

export default function MyCampaignApplicationsScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const C = theme.colors;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setError('');
      setRows(await collabHubApi.getMyApplications(user.id));
    } catch (e) {
      setError(e?.message || 'Could not load your applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tone = key => ({
    success: C.accent.success,
    warning: C.accent.warning,
    error: C.accent.error,
    info: C.accent.info,
  }[key] || C.text.muted);

  // Anything the brand has acted on sits above the ones still waiting.
  const live = rows.filter(r => r.status === 'accepted' || r.status === 'shortlisted');
  const waiting = rows.filter(r => r.status === 'pending');
  const closed = rows.filter(r => r.status === 'rejected');

  const renderCard = (app) => {
    const s = STATUS[app.status] || { label: app.status, icon: 'help', tone: 'muted' };
    return (
      <Pressable
        key={app.id}
        style={({ pressed }) => [
          styles.card,
          { borderLeftColor: tone(s.tone) },
          pressed && styles.cardPressed,
        ]}
        onPress={() =>
          navigation.navigate(SCREEN_NAMES.CampaignDetail, { campaignId: app.campaign_id })
        }
      >
        <View style={styles.cardTop}>
          <Text style={styles.title} numberOfLines={1}>
            {app.campaign?.title || 'Campaign'}
          </Text>
          <Text style={styles.price}>{money(app.campaign?.budget_per_winner)}</Text>
        </View>

        <View style={styles.statusRow}>
          <MaterialIcons name={s.icon} size={14} color={tone(s.tone)} />
          <Text style={[styles.statusText, { color: tone(s.tone) }]}>{s.label}</Text>
          <Text style={styles.date}>{moment(app.applied_at).fromNow()}</Text>
          <MaterialIcons name="chevron-right" size={18} color={C.text.muted} />
        </View>

        <Text style={styles.pitch} numberOfLines={2}>{app.pitch}</Text>
      </Pressable>
    );
  };

  return (
    <SafeScreen
      scrollable={false}
      padding={0}
      hasBottomTabs={false}
      includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}
    >
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>My applications</Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
      </StackScreenHeader>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent.secondary}
          />
        }
      >
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.accent.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <>
            <View style={styles.skelCard} />
            <View style={styles.skelCard} />
          </>
        ) : rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="assignment" size={26} color={C.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyHint}>
              Open a brief in Collab Hub and send a pitch — it shows up here.
            </Text>
            <Pressable style={styles.browseBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.browseText}>Browse campaigns</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {live.length ? (
              <>
                <Text style={styles.groupTitle}>Needs you</Text>
                {live.map(renderCard)}
              </>
            ) : null}
            {waiting.length ? (
              <>
                <Text style={styles.groupTitle}>Waiting on the brand</Text>
                {waiting.map(renderCard)}
              </>
            ) : null}
            {closed.length ? (
              <>
                <Text style={styles.groupTitle}>Closed</Text>
                {closed.map(renderCard)}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const makeStyles = (theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { color: C.text.primary, fontSize: 16, fontWeight: '800' },
    iconBtn: { padding: 8, minWidth: 38 },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.sm,
    },

    groupTitle: {
      color: C.text.muted,
      fontSize: 10.5,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: theme.spacing.md,
    },

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderLeftWidth: 3,
      borderColor: softBorder(theme),
      backgroundColor: cardFill(theme),
      padding: theme.spacing.md,
      gap: 7,
    },
    cardPressed: { opacity: 0.85 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, color: C.text.primary, fontSize: 14.5, fontWeight: '700' },
    price: { color: C.accent.primary, fontSize: 13.5, fontWeight: '800' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 12, fontWeight: '800', flex: 1 },
    date: { color: C.text.muted, fontSize: 10.5 },
    pitch: {
      color: C.text.secondary,
      fontSize: 12,
      lineHeight: 17,
      backgroundColor: softFill(theme),
      borderRadius: 10,
      padding: 10,
    },

    emptyBox: { alignItems: 'center', gap: 9, paddingVertical: theme.spacing.xl },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(theme),
    },
    emptyTitle: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
    emptyHint: {
      color: C.text.muted,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: theme.spacing.lg,
    },
    browseBtn: {
      marginTop: 4,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 11,
      backgroundColor: C.component.button,
    },
    browseText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 12,
      padding: theme.spacing.md,
      backgroundColor: softFill(theme),
    },
    errorText: { color: C.accent.error, fontSize: 12, flex: 1 },

    skelCard: {
      height: 104,
      borderRadius: 16,
      backgroundColor: softFillStrong(theme),
      marginTop: theme.spacing.sm,
    },
  });
};
