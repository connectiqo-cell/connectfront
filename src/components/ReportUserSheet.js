import React, { useEffect, useState } from "react";
import {
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

const MAX_DETAILS_LENGTH = 1000;

export default function ReportUserSheet({
  visible,
  reportedUserId,
  reportedUserName = "this user",
  contextType = "profile",
  contextId = null,
  onClose,
}) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason("");
      setDetails("");
      setSubmitting(false);
    }
  }, [visible, reportedUserId]);

  const close = () => {
    if (!submitting) onClose?.();
  };

  const submit = async () => {
    if (!reason || submitting) return;
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
        "Report submitted. Thank you for helping keep the community safe."
      );
    } catch (error) {
      Toast.show(error?.message || "Could not submit report");
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
              <Text style={styles.title}>Report {reportedUserName}</Text>
              <Text style={styles.subtitle}>
                Your report is private. The person you report will not be told
                who submitted it.
              </Text>
            </View>
            <Pressable
              onPress={close}
              disabled={submitting}
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
              Why are you reporting this user?
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
                    disabled={submitting}
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
              editable={!submitting}
              textAlignVertical="top"
            />

            <View style={styles.notice}>
              <MaterialIcons
                name="info-outline"
                size={18}
                color={theme.colors.accent.secondary}
              />
              <Text style={styles.noticeText}>
                Reporting does not block this user. If you are in immediate
                danger, contact local emergency services.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <CosmicButton
              label={submitting ? "Submitting…" : "Submit report"}
              variant="danger"
              onPress={submit}
              disabled={!reason || submitting}
              loading={submitting}
              icon="flag"
            />
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
    },
  });
}
