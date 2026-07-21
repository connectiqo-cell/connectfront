import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { UNIFIED_THEME } from '../unifiedTheme';

export const TimeSlotPicker = ({ slots = [], selectedSlot, onSelectSlot }) => {
  return (
    <View style={styles.container}>
      {slots.map((slot, index) => (
        <TouchableOpacity
          key={`${slot}-${index}`}
          style={[
            styles.slot,
            selectedSlot === slot && styles.slotSelected,
          ]}
          onPress={() => onSelectSlot(slot)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.slotText,
              selectedSlot === slot && styles.slotTextSelected,
            ]}
          >
            {slot}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: UNIFIED_THEME.spacing.lg,
    justifyContent: 'space-between',
  },
  slot: {
    width: '48%',
    paddingVertical: UNIFIED_THEME.spacing.md,
    marginVertical: UNIFIED_THEME.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UNIFIED_THEME.colors.border.light,
    backgroundColor: UNIFIED_THEME.colors.component.input,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotSelected: {
    backgroundColor: UNIFIED_THEME.colors.accent.primary,
    borderColor: UNIFIED_THEME.colors.accent.primary,
  },
  slotText: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
  },
  slotTextSelected: {
    color: UNIFIED_THEME.colors.text.onAccent,
  },
});
