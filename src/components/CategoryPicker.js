import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
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
}) => {
  const [adminCategories, setAdminCategories] = useState([]);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchActiveCategoryNames().then((names) => {
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

  const handleSingleSelect = (category) => {
    onSelect?.(category);
    onClose?.();
  };

  const handleDone = () => {
    onChange?.(draft);
    onClose?.();
  };

  const summary = formatSelectedCategoriesLabel(draft);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={24} color={UNIFIED_THEME.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {multiple ? 'Select Categories' : 'Select Your Category'}
          </Text>
          {multiple ? (
            <TouchableOpacity onPress={handleDone}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {multiple ? (
          <Text style={styles.subtitle}>
            {summary ? `${summary} selected` : 'Choose all categories that apply'}
          </Text>
        ) : null}

        <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
          {allCategories.map((category) => {
            const isSelected = multiple
              ? draft.some(c => c.toLowerCase() === category.toLowerCase())
              : selectedCategory === category;

            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryItem,
                  isSelected && styles.categoryItemSelected,
                ]}
                onPress={() => {
                  if (multiple) {
                    setDraft(prev => toggleMentorCategory(prev, category));
                    return;
                  }
                  handleSingleSelect(category);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextSelected,
                  ]}
                >
                  {category}
                </Text>
                {isSelected && (
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={UNIFIED_THEME.colors.primary.light}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UNIFIED_THEME.colors.primary.light,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    paddingVertical: UNIFIED_THEME.spacing.md,
  },
  headerTitle: {
    ...UNIFIED_THEME.typography.headingMd,
    color: UNIFIED_THEME.colors.text.primary,
  },
  doneText: {
    ...UNIFIED_THEME.typography.labelMd,
    color: UNIFIED_THEME.colors.accent.secondary,
    fontWeight: '700',
  },
  subtitle: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.muted,
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    marginBottom: UNIFIED_THEME.spacing.sm,
  },
  categoryList: {
    flex: 1,
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    paddingVertical: UNIFIED_THEME.spacing.md,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: UNIFIED_THEME.spacing.md,
    paddingHorizontal: UNIFIED_THEME.spacing.md,
    marginVertical: UNIFIED_THEME.spacing.xs,
    backgroundColor: UNIFIED_THEME.colors.component.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UNIFIED_THEME.colors.border.light,
  },
  categoryItemSelected: {
    backgroundColor: UNIFIED_THEME.colors.primary.light,
    borderColor: UNIFIED_THEME.colors.primary.dark,
  },
  categoryText: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    flex: 1,
  },
  categoryTextSelected: {
    fontWeight: '600',
    color: UNIFIED_THEME.colors.primary.dark,
  },
});
