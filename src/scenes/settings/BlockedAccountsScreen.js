import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { useFocusEffect } from '@react-navigation/native';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { blockApi } from '../../api/blockApi';

export default function BlockedAccountsScreen({ navigation }) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const TEAL = C.accent.secondary;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows(await blockApi.listBlockedUsers());
    } catch (error) {
      Toast.show(error?.message || 'Could not load blocked accounts', Toast.LONG);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          if (!cancelled) await load();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const unblock = async (id) => {
    setBusyId(id);
    try {
      await blockApi.unblockUser(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      Toast.show('Unblocked. Their content can appear in your feed again.');
    } catch (error) {
      Toast.show(error?.message || 'Could not unblock', Toast.LONG);
    } finally {
      setBusyId(null);
    }
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
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Blocked accounts</Text>
            <Text style={styles.headerSubtitle}>
              {loading
                ? 'Loading…'
                : rows.length
                  ? `${rows.length} blocked · Unblock anytime`
                  : 'People you block appear here'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </StackScreenHeader>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TEAL}
              colors={[TEAL]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="block" size={36} color={C.text.muted} />
              <Text style={styles.emptyTitle}>No blocked accounts</Text>
              <Text style={styles.emptyText}>
                When you block someone, they appear here. Blocking removes their
                content from your feed.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Pressable
                style={styles.unblockBtn}
                onPress={() => unblock(item.id)}
                disabled={busyId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.name}`}
              >
                <Text style={styles.unblockText}>
                  {busyId === item.id ? 'Unblocking…' : 'Unblock'}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeScreen>
  );
}

function createStyles(theme) {
  const T = theme;
  const C = theme.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.md,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: softBorder(theme),
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    headerCenter: { flex: 1 },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: C.text.primary,
    },
    headerSubtitle: {
      fontSize: 12,
      color: C.text.muted,
      marginTop: 2,
    },
    headerSpacer: { width: 40 },
    loaderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: T.spacing.lg,
      paddingBottom: T.spacing.xxxl,
      gap: 10,
      flexGrow: 1,
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 48,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text.primary,
      marginTop: 8,
    },
    emptyText: {
      fontSize: 13,
      color: C.text.muted,
      textAlign: 'center',
      lineHeight: 19,
    },
    row: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: T.spacing.sm,
      paddingHorizontal: T.spacing.md,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFillStrong(theme),
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: C.accent.secondary,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: C.text.primary,
    },
    unblockBtn: {
      paddingHorizontal: T.spacing.md,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: softFillStrong(theme),
      borderWidth: 1,
      borderColor: C.border.accent,
    },
    unblockText: {
      fontSize: 12,
      fontWeight: '700',
      color: C.text.primary,
    },
  });
}
