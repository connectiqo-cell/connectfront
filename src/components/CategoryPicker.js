import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  StatusBar,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../theme/surfaceStyles';
import { fetchActiveCategoryNames } from '../api/contentApi';
import { MENTOR_CATEGORIES } from '../constants/mentorCategories';
import {
  formatSelectedCategoriesLabel,
  parseMentorCategories,
  toggleMentorCategory,
} from '../utils/mentorCategories';

export const CategoryPicker = ({
  visible,
  selectedCategory,
  selectedCategories,
  onSelect,
  onChange,
  onClose,
  multiple = false,
  minSelections = 0,
  maxSelections = Number.POSITIVE_INFINITY,
  title,
}) => {
  const styles = useThemedStyles(createThemedStyles);
  const { theme, isDark } = useTheme();
  const C = theme.colors;
  const [adminCategories, setAdminCategories] = useState([]);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchActiveCategoryNames().then(names => {
      if (!cancelled) setAdminCategories(names || []);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (multiple) {
      setDraft(parseMentorCategories(selectedCategories ?? selectedCategory));
      return;
    }
    setDraft(parseMentorCategories(selectedCategory));
  }, [visible, multiple, selectedCategories, selectedCategory]);

  const allCategories = useMemo(() => {
    if (adminCategories?.length) return adminCategories;
    return MENTOR_CATEGORIES;
  }, [adminCategories]);

  const handleSingleSelect = category => {
    onSelect?.(category);
    onClose?.();
  };

  const handleDone = () => {
    if (draft.length < minSelections) {
      Toast.show(`Select ${minSelections} categories`);
      return;
    }
    onChange?.(draft);
    onClose?.();
  };

  const summary = formatSelectedCategoriesLabel(draft);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.surface.panel}
      />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
            <MaterialIcons name="close" size={24} color={C.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {title || (multiple ? 'Select Categories' : 'Select Your Category')}
          </Text>
          {multiple ? (
            <TouchableOpacity
              onPress={handleDone}
              disabled={draft.length < minSelections}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.doneText,
                  draft.length < minSelections && styles.doneTextDisabled,
                ]}
              >
                Done
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {multiple ? (
          <Text style={styles.subtitle}>
            {Number.isFinite(maxSelections)
              ? `${draft.length} / ${maxSelections} selected`
              : summary
                ? `${summary} selected`
                : 'Choose all categories that apply'}
          </Text>
        ) : null}

        <ScrollView
          style={styles.categoryList}
          contentContainerStyle={styles.categoryListContent}
          showsVerticalScrollIndicator={false}
        >
          {allCategories.map(category => {
            const isSelected = multiple
              ? draft.some(c => c.toLowerCase() === category.toLowerCase())
              : selectedCategory === category;

            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                onPress={() => {
                  if (multiple) {
                    setDraft(prev => {
                      const selected = prev.some(
                        c => c.toLowerCase() === category.toLowerCase(),
                      );
                      if (!selected && prev.length >= maxSelections) {
                        Toast.show(`Select up to ${maxSelections} categories`);
                        return prev;
                      }
                      return toggleMentorCategory(prev, category);
                    });
                    return;
                  }
                  handleSingleSelect(category);
                }}
                accessibilityRole={multiple ? 'checkbox' : 'button'}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[styles.categoryText, isSelected && styles.categoryTextSelected]}
                >
                  {category}
                </Text>
                {isSelected ? (
                  <MaterialIcons name="check" size={20} color={C.accent.primary} />
                ) : (
                  <MaterialIcons
                    name="radio-button-unchecked"
                    size={20}
                    color={C.text.muted}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.surface.panel,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: softBorder(theme),
    },
    headerTitle: {
      ...T.typography.headingSm,
      color: C.text.primary,
      fontWeight: '800',
      flex: 1,
      textAlign: 'center',
      paddingHorizontal: T.spacing.sm,
    },
    headerSpacer: {
      width: 24,
    },
    doneText: {
      ...T.typography.labelMd,
      color: C.accent.secondary,
      fontWeight: '700',
    },
    doneTextDisabled: {
      opacity: 0.4,
    },
    subtitle: {
      ...T.typography.bodySm,
      color: C.text.muted,
      paddingHorizontal: T.spacing.lg,
      paddingTop: T.spacing.sm,
      marginBottom: T.spacing.sm,
      fontWeight: '600',
    },
    categoryList: {
      flex: 1,
    },
    categoryListContent: {
      paddingHorizontal: T.spacing.lg,
      paddingVertical: T.spacing.md,
      paddingBottom: T.spacing.xxl,
    },
    categoryItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: T.spacing.md,
      paddingHorizontal: T.spacing.md,
      marginVertical: T.spacing.xs,
      backgroundColor: softFill(theme),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    categoryItemSelected: {
      backgroundColor: softFillStrong(theme),
      borderColor: C.border.accent,
    },
    categoryText: {
      ...T.typography.bodyMd,
      color: C.text.primary,
      flex: 1,
      paddingRight: T.spacing.sm,
    },
    categoryTextSelected: {
      fontWeight: '700',
      color: C.accent.primary,
    },
  });
}
