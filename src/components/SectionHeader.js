import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../hooks/useTheme';

export const SectionHeader = ({ title, subtitle, count = null }) => {
  const styles = useThemedStyles(createSectionHeaderStyles);

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.horizontalLine} />
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {count !== null ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
};

function createSectionHeaderStyles(theme) {
  const T = theme;
  const C = theme.colors;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingVertical: T.spacing.md,
      marginTop: T.spacing.sm,
      marginBottom: T.spacing.xs,
      gap: T.spacing.md,
    },
    textBlock: {
      flex: 1,
    },
    title: {
      ...T.typography.headingSm,
      fontSize: 17,
      color: C.text.primary,
      fontWeight: '700',
    },
    horizontalLine: {
      height: 1,
      backgroundColor: C.accent.primary,
    },
    subtitle: {
      ...T.typography.bodySm,
      color: C.text.secondary,
      marginTop: T.spacing.xs,
      lineHeight: 18,
    },
    countBadge: {
      backgroundColor: C.buttons.secondaryBg,
      borderRadius: T.borderRadius.round,
      minWidth: 28,
      height: 28,
      paddingHorizontal: T.spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border.light,
    },
    countText: {
      ...T.typography.labelSm,
      color: C.accent.primary,
      fontWeight: '700',
    },
  });
}
