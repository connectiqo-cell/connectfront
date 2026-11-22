import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { cardFill, softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { money, saveReceipt, shareReceipt } from '../../utils/receipt';

function ActionButton({ icon, label, onPress, primary, disabled, styles, colors }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        primary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        pressed && { opacity: 0.88 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <MaterialIcons
        name={icon}
        size={18}
        color={primary ? '#fff' : colors.accent.secondary}
      />
      <Text style={[styles.actionBtnText, primary && styles.actionBtnTextPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ReceiptPreviewScreen({ navigation, route }) {
  const receipt = route?.params?.receipt;
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const [busy, setBusy] = useState(null);

  const statusPaid = useMemo(
    () => /paid|success|completed|settled/i.test(String(receipt?.status || '')),
    [receipt?.status],
  );

  const handleShare = useCallback(async () => {
    if (!receipt || busy) return;
    setBusy('share');
    try {
      await shareReceipt(receipt);
    } catch (err) {
      console.error('[ReceiptPreview] share failed:', err?.message);
      Toast.show('Could not share receipt');
    } finally {
      setBusy(null);
    }
  }, [receipt, busy]);

  const handleDownload = useCallback(async () => {
    if (!receipt || busy) return;
    setBusy('download');
    try {
      const { locationLabel } = await saveReceipt(receipt);
      Toast.show(`Receipt saved to ${locationLabel}`);
    } catch (err) {
      console.error('[ReceiptPreview] save failed:', err?.message);
      try {
        await shareReceipt(receipt);
      } catch {
        Toast.show('Could not download receipt');
      }
    } finally {
      setBusy(null);
    }
  }, [receipt, busy]);

  if (!receipt) {
    return (
      <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
        <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Receipt</Text>
            <View style={styles.headerSpacer} />
          </View>
        </StackScreenHeader>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Receipt not found</Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen scrollable={false} padding={0} hasBottomTabs={false} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
            <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Receipt preview</Text>
            <Text style={styles.headerSubtitle}>{receipt.number}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </StackScreenHeader>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.brand}>Connectiqo</Text>
              <Text style={styles.brandTag}>Connect · Create · Collab</Text>
            </View>
            <View style={styles.cardHeaderRight}>
              <Text style={styles.receiptLabel}>RECEIPT</Text>
              <Text style={styles.metaText}>No. {receipt.number}</Text>
              <Text style={styles.metaText}>Date {receipt.date}</Text>
            </View>
          </View>

          <View style={styles.infoPanel}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>{receipt.billedToLabel || 'Paid by'}</Text>
              <Text style={styles.infoValue}>{receipt.billedTo}</Text>
              {receipt.counterparty ? (
                <>
                  <Text style={[styles.infoLabel, styles.infoLabelSpaced]}>
                    {receipt.counterpartyLabel || 'Counterparty'}
                  </Text>
                  <Text style={styles.infoValue}>{receipt.counterparty}</Text>
                </>
              ) : null}
            </View>
            <View style={styles.statusCol}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={[styles.statusValue, statusPaid && styles.statusPaid]}>
                {receipt.status}
              </Text>
            </View>
          </View>

          <View style={styles.tableHead}>
            <Text style={styles.tableHeadText}>Description</Text>
            <Text style={styles.tableHeadText}>Amount</Text>
          </View>
          {(receipt.lines || []).map((line, index) => (
            <View
              key={`${line.label}-${index}`}
              style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
            >
              <Text style={styles.tableDesc} numberOfLines={2}>{line.label}</Text>
              <Text style={styles.tableAmount}>{money(line.amount)}</Text>
            </View>
          ))}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{receipt.totalLabel || 'Total'}</Text>
            <Text style={styles.totalValue}>{money(receipt.total)}</Text>
          </View>

          {(receipt.reference || []).length > 0 ? (
            <View style={styles.refs}>
              <Text style={styles.refsTitle}>Payment reference</Text>
              {receipt.reference.map(ref => (
                <Text key={ref.label} style={styles.refLine}>
                  <Text style={styles.refLabel}>{ref.label}: </Text>
                  {ref.value}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.note}>
            {receipt.note || 'Computer-generated receipt. Amounts are inclusive of applicable taxes.'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ActionButton
          icon="share"
          label={busy === 'share' ? 'Sharing…' : 'Share'}
          onPress={handleShare}
          disabled={Boolean(busy)}
          styles={styles}
          colors={C}
        />
        <ActionButton
          icon="file-download"
          label={busy === 'download' ? 'Saving…' : 'Download'}
          onPress={handleDownload}
          primary
          disabled={Boolean(busy)}
          styles={styles}
          colors={C}
        />
      </View>
    </SafeScreen>
  );
}

function createStyles(theme) {
  const C = theme.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(theme),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
    },
    headerCenter: { flex: 1 },
    headerTitle: {
      color: C.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: C.text.muted,
      fontSize: 12,
      marginTop: 2,
    },
    headerSpacer: { width: 40 },
    scroll: { flex: 1 },
    content: {
      padding: 16,
      paddingBottom: 24,
    },
    card: {
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: cardFill(theme),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
    },
    cardHeader: {
      backgroundColor: '#2E1470',
      paddingHorizontal: 18,
      paddingVertical: 18,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    brand: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '800',
    },
    brandTag: {
      color: 'rgba(216,205,255,0.9)',
      fontSize: 11,
      marginTop: 4,
    },
    cardHeaderRight: { alignItems: 'flex-end' },
    receiptLabel: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    metaText: {
      color: 'rgba(230,220,255,0.9)',
      fontSize: 11,
      marginTop: 3,
    },
    infoPanel: {
      margin: 14,
      padding: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(167,139,250,0.12)',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    infoCol: { flex: 1 },
    statusCol: { minWidth: 72, alignItems: 'flex-end' },
    infoLabel: {
      color: C.text.muted,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    infoLabelSpaced: { marginTop: 12 },
    infoValue: {
      color: C.text.primary,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    statusValue: {
      color: C.accent.primary,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 4,
    },
    statusPaid: { color: C.accent.success },
    tableHead: {
      marginHorizontal: 14,
      backgroundColor: '#5A2ECF',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tableHeadText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    tableRow: {
      marginHorizontal: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    tableRowAlt: {
      backgroundColor: softFill(theme),
      borderRadius: 8,
    },
    tableDesc: {
      flex: 1,
      color: C.text.primary,
      fontSize: 13,
    },
    tableAmount: {
      color: C.text.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    totalBox: {
      alignSelf: 'flex-end',
      marginTop: 10,
      marginRight: 14,
      marginBottom: 8,
      minWidth: 168,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: '#1C1838',
    },
    totalLabel: {
      color: 'rgba(210,205,235,0.85)',
      fontSize: 11,
      marginBottom: 4,
    },
    totalValue: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    refs: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 4,
    },
    refsTitle: {
      color: C.text.muted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
    },
    refLine: {
      color: C.text.primary,
      fontSize: 12,
      marginBottom: 4,
    },
    refLabel: {
      color: C.text.muted,
      fontWeight: '700',
    },
    note: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 16,
      color: C.text.muted,
      fontSize: 11,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 22 : 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: softBorder(theme),
      backgroundColor: cardFill(theme),
    },
    actionBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    actionBtnPrimary: {
      backgroundColor: C.accent.secondary,
    },
    actionBtnSecondary: {
      backgroundColor: softFillStrong(theme),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: softBorder(theme),
    },
    actionBtnText: {
      color: C.accent.secondary,
      fontSize: 14,
      fontWeight: '700',
    },
    actionBtnTextPrimary: {
      color: '#fff',
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: C.text.muted,
      fontSize: 14,
    },
  });
}
