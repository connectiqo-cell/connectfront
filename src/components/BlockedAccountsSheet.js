import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Toast from "react-native-simple-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, useThemedStyles } from "../hooks/useTheme";
import { softBorder, softFill, softFillStrong } from "../theme/surfaceStyles";
import { blockApi } from "../api/blockApi";

export default function BlockedAccountsSheet({ visible, onClose }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await blockApi.listBlockedUsers());
    } catch (error) {
      Toast.show(error?.message || "Could not load blocked accounts", Toast.LONG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const unblock = async (id) => {
    setBusyId(id);
    try {
      await blockApi.unblockUser(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      Toast.show("Unblocked. Their content can appear in your feed again.");
    } catch (error) {
      Toast.show(error?.message || "Could not unblock", Toast.LONG);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close blocked accounts"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Blocked accounts</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialIcons
                name="close"
                size={24}
                color={theme.colors.text.muted}
              />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator
              style={styles.loader}
              color={theme.colors.accent.secondary}
            />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  You have not blocked anyone. Blocking someone removes their
                  content from your feed straight away.
                </Text>
              }
              renderItem={({ item }) => (
                <View style={styles.row}>
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
                      {busyId === item.id ? "Unblocking…" : "Unblock"}
                    </Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  return StyleSheet.create({
    modal: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.58)",
    },
    sheet: {
      maxHeight: "80%",
      backgroundColor: C.surface.sheet,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: softBorder(theme),
      paddingHorizontal: T.spacing.lg,
      paddingTop: T.spacing.sm,
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border.default,
      alignSelf: "center",
      marginBottom: T.spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: T.spacing.md,
    },
    title: {
      ...T.typography.headingMd,
      color: C.text.primary,
      fontWeight: "800",
    },
    loader: { paddingVertical: T.spacing.xl },
    listContent: { paddingBottom: T.spacing.md, gap: 8 },
    empty: {
      ...T.typography.bodySm,
      color: C.text.muted,
      lineHeight: 18,
      paddingVertical: T.spacing.lg,
    },
    row: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: T.spacing.sm,
      paddingHorizontal: T.spacing.md,
      borderRadius: 13,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    name: {
      ...T.typography.bodyMd,
      color: C.text.primary,
      flex: 1,
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
      ...T.typography.labelSm,
      color: C.text.primary,
      fontWeight: "700",
    },
  });
}
