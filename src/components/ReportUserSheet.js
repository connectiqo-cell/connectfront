import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Toast from "react-native-simple-toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CosmicButton from "./CosmicButton";
import { useTheme, useThemedStyles } from "../hooks/useTheme";
import { softBorder, softFill, softFillStrong } from "../theme/surfaceStyles";
import { reportApi, USER_REPORT_REASONS } from "../api/reportApi";
import { blockApi } from "../api/blockApi";

const MAX_DETAILS_LENGTH = 1000;

export default function ReportUserSheet({
  visible,
  reportedUserId,
  reportedUserName = "this user",
  contextType = "profile",
  contextId = null,
  onClose,
  onBlocked,
}) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason("");
      setDetails("");
      setSubmitting(false);
      setBlocking(false);
    }
  }, [visible, reportedUserId]);

  const close = () => {
    if (!submitting && !blocking) onClose?.();
  };

  const runBlock = async () => {
    setBlocking(true);
    try {
      await blockApi.blockUser({
        blockedUserId: reportedUserId,
        reason: reason || "other",
        details,
      });
      onClose?.();
      onBlocked?.(reportedUserId);
      Toast.show(
        `${reportedUserName} is blocked. Their content is removed from your feed and our moderators have been notified.`,
        Toast.LONG
      );
    } catch (error) {
      Toast.show(error?.message || "Could not block this user", Toast.LONG);
    } finally {
      setBlocking(false);
    }
  };

  const confirmBlock = () => {
    if (submitting || blocking) return;
    if (!reportedUserId) {
      Toast.show("Could not identify who to block. Please try again.", Toast.LONG);
      return;
    }
    Alert.alert(
      `Block ${reportedUserName}?`,
      "They will be removed from your feed immediately and will not be able to reach you. Our moderation team is notified so the content can be reviewed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: runBlock },
      ]
    );
  };

  const submit = async () => {
    if (!reason || submitting) return;
    if (!reportedUserId) {
      Toast.show("Could not identify who to report. Please try again.", Toast.LONG);
      return;
    }
    if (contextType !== "profile" && !contextId) {
      Toast.show("Missing session details for this report.", Toast.LONG);
      return;
    }
    setSubmitting(true);
    try {
      await reportApi.submitUserReport({
        reportedUserId,
        reason,
        details,
        contextType,
        contextId,
      });
      onClose?.();
      Toast.show(
        "Report submitted. Thank you for helping keep the community safe.",
        Toast.LONG
      );
    } catch (error) {
      Toast.show(error?.message || "Could not submit report", Toast.LONG);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close report form"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialIcons
                name="flag"
                size={20}
                color={theme.colors.accent.error}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>
                {contextType === "video"
                  ? "Report this video"
                  : `Report ${reportedUserName}`}
              </Text>
              <Text style={styles.subtitle}>
                {contextType === "video"
                  ? `This sends a private report about ${reportedUserName}'s video. They will not see who reported it.`
                  : contextType === "call"
                    ? "This sends a private report about this call participant. The call continues, and they will not see who reported them."
                    : "Your report is private. The person you report will not be told who submitted it."}
              </Text>
            </View>
            <Pressable
              onPress={close}
              disabled={submitting || blocking}
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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>
              {contextType === "video"
                ? "Why are you reporting this video?"
                : contextType === "call"
                  ? "Why are you reporting this participant?"
                  : "Why are you reporting this user?"}
            </Text>
            <View style={styles.reasons}>
              {USER_REPORT_REASONS.map((item) => {
                const selected = reason === item.value;
                return (
                  <Pressable
                    key={item.value}
                    style={[
                      styles.reasonRow,
                      selected && styles.reasonRowSelected,
                    ]}
                    onPress={() => setReason(item.value)}
                    disabled={submitting || blocking}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        selected && styles.reasonTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <MaterialIcons
                      name={
                        selected
                          ? "radio-button-checked"
                          : "radio-button-unchecked"
                      }
                      size={21}
                      color={
                        selected
                          ? theme.colors.buttons.nebulaGradient[0]
                          : theme.colors.text.muted
                      }
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.detailsHeader}>
              <Text style={styles.sectionLabel}>
                Additional details (optional)
              </Text>
              <Text style={styles.counter}>
                {details.length}/{MAX_DETAILS_LENGTH}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder="Share any information that will help us review this report."
              placeholderTextColor={theme.colors.text.muted}
              selectionColor={theme.colors.buttons.nebulaGradient[0]}
              multiline
              maxLength={MAX_DETAILS_LENGTH}
              editable={!submitting && !blocking}
              textAlignVertical="top"
            />

            <View style={styles.notice}>
              <MaterialIcons
                name="info-outline"
                size={18}
                color={theme.colors.accent.secondary}
              />
              <Text style={styles.noticeText}>
                Reporting keeps this account visible to you. To stop seeing them
                entirely, block them below. If you are in immediate danger,
                contact local emergency services.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <CosmicButton
              label={submitting ? "Submitting…" : "Submit report"}
              variant="danger"
              onPress={submit}
              disabled={!reason || submitting || blocking}
              loading={submitting}
              icon="flag"
            />
            <Pressable
              style={styles.blockButton}
              onPress={confirmBlock}
              disabled={submitting || blocking}
              accessibilityRole="button"
              accessibilityLabel={`Block ${reportedUserName}`}
            >
              <MaterialIcons
                name="block"
                size={18}
                color={theme.colors.accent.error}
              />
              <Text style={styles.blockButtonText}>
                {blocking ? "Blocking…" : `Block ${reportedUserName}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  return StyleSheet.create({
    modal: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.58)",
    },
    sheet: {
      maxHeight: "92%",
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
      alignItems: "flex-start",
      gap: T.spacing.sm,
      marginBottom: T.spacing.md,
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: softFillStrong(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      ...T.typography.headingMd,
      color: C.text.primary,
      fontWeight: "800",
      marginBottom: 4,
    },
    subtitle: {
      ...T.typography.bodySm,
      color: C.text.muted,
      lineHeight: 18,
    },
    scroll: {
      flexShrink: 1,
    },
    scrollContent: {
      paddingBottom: T.spacing.md,
    },
    sectionLabel: {
      ...T.typography.labelMd,
      color: C.text.primary,
      fontWeight: "700",
      marginBottom: T.spacing.sm,
    },
    reasons: {
      gap: 7,
      marginBottom: T.spacing.lg,
    },
    reasonRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: T.spacing.md,
      paddingVertical: T.spacing.sm,
      borderRadius: 13,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    reasonRowSelected: {
      backgroundColor: softFillStrong(theme),
      borderColor: C.border.accent,
    },
    reasonText: {
      ...T.typography.bodyMd,
      color: C.text.secondary,
      flex: 1,
      paddingRight: T.spacing.sm,
    },
    reasonTextSelected: {
      color: C.text.primary,
      fontWeight: "700",
    },
    detailsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    counter: {
      ...T.typography.bodySm,
      color: C.text.muted,
      marginBottom: T.spacing.sm,
    },
    input: {
      minHeight: 104,
      maxHeight: 150,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: C.component.input,
      color: C.text.primary,
      paddingHorizontal: T.spacing.md,
      paddingVertical: T.spacing.md,
      ...T.typography.bodyMd,
    },
    notice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: T.spacing.sm,
      padding: T.spacing.md,
      marginTop: T.spacing.md,
      borderRadius: 13,
      backgroundColor: softFill(theme),
    },
    noticeText: {
      ...T.typography.bodySm,
      color: C.text.muted,
      lineHeight: 18,
      flex: 1,
    },
    actions: {
      paddingTop: T.spacing.sm,
      gap: T.spacing.sm,
    },
    blockButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: T.spacing.sm,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.accent.error,
      backgroundColor: softFill(theme),
    },
    blockButtonText: {
      ...T.typography.labelMd,
      color: C.accent.error,
      fontWeight: "700",
    },
  });
}
