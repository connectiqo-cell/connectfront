import React from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import CosmicButton from './CosmicButton';
import { useThemedStyles } from '../hooks/useTheme';

/**
 * Full-screen avatar preview always sits on a dark scrim, so chrome
 * (title, close, placeholder) must stay light — never use light-theme
 * text.primary here or the UI disappears after tapping upload/change.
 */
export function AvatarPreviewModal({
  visible,
  uri,
  name = '',
  isOwnProfile = false,
  uploading = false,
  onClose,
  onChangePhoto,
}) {
  const styles = useThemedStyles(createAvatarPreviewStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.header, { paddingTop: insets.top + styles._spacingSm }]}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{name || 'Profile photo'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          {uri ? (
            <View style={styles.imageCircle}>
              <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.placeholder}>
              <MaterialIcons name="person" size={88} color="#c4b5fd" />
              <Text style={styles.placeholderTxt}>No profile photo yet</Text>
            </View>
          )}
        </View>

        {isOwnProfile && onChangePhoto ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, styles._spacingLg) }]}>
            <CosmicButton
              label={uploading ? 'Updating…' : uri ? 'Change photo' : 'Add photo'}
              variant="nebula"
              icon="photo-camera"
              onPress={onChangePhoto}
              loading={uploading}
              disabled={uploading}
              style={styles.changeBtn}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function createAvatarPreviewStyles(theme) {
  const T = theme;
  return StyleSheet.create({
    _spacingSm: T.spacing.sm,
    _spacingLg: T.spacing.lg,
    root: { flex: 1, backgroundColor: 'rgba(3,3,10,0.96)' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: T.spacing.md,
      paddingBottom: T.spacing.sm,
      zIndex: 2,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: T.spacing.sm,
    },
    headerSpacer: { width: 40 },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: T.spacing.lg,
    },
    imageCircle: {
      width: '86%',
      maxWidth: 360,
      aspectRatio: 1,
      borderRadius: 999,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: T.spacing.md,
    },
    placeholderTxt: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 14,
      fontWeight: '600',
    },
    footer: {
      paddingHorizontal: T.spacing.lg,
      paddingTop: T.spacing.md,
    },
    changeBtn: { marginVertical: 0 },
  });
}
