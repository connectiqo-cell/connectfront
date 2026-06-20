import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { UNIFIED_THEME } from '../unifiedTheme';
import { formatPrice } from '../utils/formatCurrency';
import { StarRating } from './StarRating';
import CosmicButton from './CosmicButton';
import { iosFlexChild } from '../utils/platformLayout';

export const MentorCard = ({ mentor, onPress }) => {
  const avatarUrl = mentor.profiles?.avatar_url;
  const name = mentor.profiles?.name || 'Unknown';
  const specialization = mentor.specialization || 'Not specified';
  const pricePerHour = mentor.price_per_hour || 0;
  const rating = mentor.rating || 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <MaterialIcons name="person" size={32} color={UNIFIED_THEME.colors.primary.light} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.specialization} numberOfLines={1}>{specialization}</Text>
          <View style={styles.ratingContainer}>
            <StarRating rating={rating} size={14} />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatPrice(pricePerHour)}</Text>
        </View>
      </View>

      {mentor.bio && (
        <Text style={styles.bio} numberOfLines={2}>{mentor.bio}</Text>
      )}

      <View style={styles.footer}>
        <View style={styles.badge}>
          <MaterialIcons name="check-circle" size={14} color={UNIFIED_THEME.colors.success} />
          <Text style={styles.badgeText}>{mentor.total_sessions || 0} sessions</Text>
        </View>
        <CosmicButton
          label="Book Now"
          variant="primary"
          size="compact"
          onPress={onPress}
          style={styles.bookButton}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: UNIFIED_THEME.colors.component.input,
    borderRadius: 12,
    padding: UNIFIED_THEME.spacing.md,
    marginHorizontal: UNIFIED_THEME.spacing.md,
    marginVertical: UNIFIED_THEME.spacing.sm,
    borderWidth: 1,
    borderColor: UNIFIED_THEME.colors.primary.light,
  },
  header: {
    flexDirection: 'row',
    marginBottom: UNIFIED_THEME.spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: UNIFIED_THEME.spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: UNIFIED_THEME.colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  specialization: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.primary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.secondary,
    marginLeft: 4,
  },
  priceContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  price: {
    ...UNIFIED_THEME.typography.bodyMd,
    color: UNIFIED_THEME.colors.text.primary,
    fontWeight: '600',
  },
  bio: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.secondary,
    marginBottom: UNIFIED_THEME.spacing.md,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: UNIFIED_THEME.spacing.sm,
    paddingVertical: 4,
    backgroundColor: UNIFIED_THEME.colors.accent.secondary,
    borderRadius: 8,
  },
  badgeText: {
    ...UNIFIED_THEME.typography.bodySm,
    color: UNIFIED_THEME.colors.text.primary,
    marginLeft: 4,
  },
  bookButton: {
    ...iosFlexChild(),
    flexShrink: 0,
    minWidth: 108,
    maxWidth: Platform.OS === 'ios' ? 150 : 140,
  },
});
