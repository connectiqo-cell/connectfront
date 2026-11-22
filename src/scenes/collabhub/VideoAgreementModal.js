import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill } from '../../theme/surfaceStyles';

/**
 * Creator video-usage agreement, shown once per application before the first
 * upload. The clauses come from legal_agreements (already brand-filled by the
 * caller); upload stays disabled until the checkbox is ticked.
 */
export default function VideoAgreementModal({ visible, brandName, clauses, onAccept, onCancel }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const C = theme.colors;
  const [agreed, setAgreed] = useState(false);

  // A fixed sheet height (not maxHeight) so the clause list takes only the
  // space left over — a percentage maxHeight let 9 long clauses push the
  // checkbox and buttons off screen on Android. Recomputed on rotation.
  const available = windowHeight - insets.top;
  // Landscape phones and small screens: drop the subtitle and tighten spacing
  // so the clause list keeps usable room between header and footer.
  const compact = available < 560;
  const sheetHeight = Math.round(available * (compact ? 0.94 : 0.88));
  // Tablets / wide landscape: keep a readable line length, centred.
  const sheetWidth = Math.min(windowWidth, MAX_SHEET_WIDTH);

  // Every opening starts unticked — consent is never pre-filled.
  useEffect(() => {
    if (visible) setAgreed(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      // Backdrop must cover the whole screen — status bar and Android nav bar
      // included — like the app's other sheets.
      statusBarTranslucent
      navigationBarTranslucent
      // iOS Modal is portrait-only unless told otherwise; the app allows landscape.
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            compact && styles.sheetCompact,
            {
              height: sheetHeight,
              width: sheetWidth,
              paddingBottom: Math.max(insets.bottom, compact ? 8 : 14) + 4,
              // Landscape notch / punch-hole on either side.
              paddingLeft: Math.max(insets.left, compact ? 14 : 20),
              paddingRight: Math.max(insets.right, compact ? 14 : 20),
            },
          ]}
        >
          <View style={styles.head}>
            <MaterialIcons name="gavel" size={18} color={C.accent.primary} />
            <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={CHROME_FONT_MAX}>
              Video usage agreement
            </Text>
            <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Close">
              <MaterialIcons name="close" size={22} color={C.text.muted} />
            </Pressable>
          </View>
          {compact ? null : (
            <Text style={styles.subtitle} maxFontSizeMultiplier={CHROME_FONT_MAX}>
              Between you and {brandName || 'the brand'}. Please read before uploading.
            </Text>
          )}

          {/* Legal text scales with the user's font setting — it scrolls, so
              it never pushes the footer away. */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            persistentScrollbar
          >
            {(clauses || []).map((clause, i) => (
              <View key={i} style={styles.clause}>
                <Text style={styles.num}>{i + 1}.</Text>
                <Text style={styles.clauseText}>{clause}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.checkRow, compact && styles.checkRowCompact]}
            onPress={() => setAgreed(a => !a)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            hitSlop={6}
          >
            <MaterialIcons
              name={agreed ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={agreed ? C.accent.primary : C.text.muted}
            />
            <Text style={styles.checkText} maxFontSizeMultiplier={CHROME_FONT_MAX}>
              I've read and agree to the terms above
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={[styles.cancelBtn, compact && styles.btnCompact]} onPress={onCancel}>
              <Text style={styles.cancelText} numberOfLines={1} maxFontSizeMultiplier={CHROME_FONT_MAX}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              style={[styles.acceptBtn, compact && styles.btnCompact, !agreed && styles.disabled]}
              onPress={onAccept}
              disabled={!agreed}
              accessibilityState={{ disabled: !agreed }}
            >
              <MaterialIcons name="file-upload" size={17} color="#fff" />
              <Text
                style={styles.acceptText}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={CHROME_FONT_MAX}
              >
                Agree & upload
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const MAX_SHEET_WIDTH = 640;
// Title, checkbox label and buttons are fixed chrome — cap their growth under
// large accessibility fonts so they cannot squeeze the clause list to nothing.
const CHROME_FONT_MAX = 1.3;

const makeStyles = (theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: C.surface.panel,
      paddingTop: theme.spacing.lg,
      gap: 10,
    },
    sheetCompact: { paddingTop: 12, gap: 7 },
    checkRowCompact: { paddingVertical: 2 },
    btnCompact: { paddingVertical: 10 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, color: C.text.primary, fontSize: 17, fontWeight: '800' },
    subtitle: { color: C.text.muted, fontSize: 12, lineHeight: 17 },
    // Fills whatever the header and footer leave; the clauses scroll inside.
    list: {
      flex: 1,
      // Always leave some clause text visible, even in tight landscape.
      minHeight: 72,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: softFill(theme),
    },
    listContent: { padding: theme.spacing.md, gap: 12 },
    clause: { flexDirection: 'row', gap: 8 },
    num: { color: C.accent.primary, fontSize: 13, fontWeight: '800', minWidth: 18 },
    clauseText: { flex: 1, color: C.text.secondary, fontSize: 13, lineHeight: 19 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    checkText: { flex: 1, color: C.text.primary, fontSize: 13, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: softBorder(theme),
      paddingVertical: 14,
    },
    cancelText: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
    acceptBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: C.component.button,
    },
    acceptText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    disabled: { opacity: 0.45 },
  });
};
