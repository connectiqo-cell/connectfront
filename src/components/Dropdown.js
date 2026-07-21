import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';

export const Dropdown = ({ label, items, selectedValue, onSelect, placeholder }) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.buttonText, !selectedValue && styles.placeholderText]}>
          {selectedValue || placeholder || 'Select an option'}
        </Text>
        <MaterialIcons
          name="arrow-drop-down"
          size={24}
          color={UNIFIED_THEME.colors.text.secondary}
        />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={UNIFIED_THEME.colors.text.primary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.option,
                    selectedValue === item && styles.optionSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedValue === item && styles.optionTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {selectedValue === item && (
                    <MaterialIcons
                      name="check"
                      size={20}
                      color={UNIFIED_THEME.colors.accent.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: UNIFIED_THEME.spacing.lg,
  },
  label: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.secondary,
    marginBottom: UNIFIED_THEME.spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: UNIFIED_THEME.spacing.md,
    paddingVertical: UNIFIED_THEME.spacing.md,
    backgroundColor: UNIFIED_THEME.colors.component.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UNIFIED_THEME.colors.border.light,
  },
  buttonText: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    flex: 1,
  },
  placeholderText: {
    color: UNIFIED_THEME.colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    backgroundColor: UNIFIED_THEME.colors.surface.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: UNIFIED_THEME.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    paddingVertical: UNIFIED_THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: UNIFIED_THEME.colors.border.light,
  },
  modalTitle: {
    ...UNIFIED_THEME.typography.bodyLg,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
  },
  optionsList: {
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    paddingVertical: UNIFIED_THEME.spacing.md,
  },
  option: {
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
  optionSelected: {
    backgroundColor: UNIFIED_THEME.colors.surface.accentViolet,
    borderColor: UNIFIED_THEME.colors.border.accent,
  },
  optionText: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: UNIFIED_THEME.colors.accent.primary,
  },
});
