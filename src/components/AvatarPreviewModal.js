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
import { UNIFIED_THEME } from '../unifiedTheme';

const T = UNIFIED_THEME;
const C = T.colors;
const PURPLE_LINK = '#a78bfa';

export function AvatarPreviewModal({
  visible,
  uri,
  name = '',
  isOwnProfile = false,
  uploading = false,
  onClose,
  onChangePhoto,
}) {
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
        <View style={[styles.header, { paddingTop: insets.top + T.spacing.sm }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="close" size={24} color={C.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{name || 'Profile photo'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <MaterialIcons name="person" size={88} color={PURPLE_LINK} />
              <Text style={styles.placeholderTxt}>No profile photo yet</Text>
            </View>
          )}
        </View>

        {isOwnProfile && onChangePhoto ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, T.spacing.lg) }]}>
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: C.text.primary,
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
  image: {
    width: '100%',
    height: '100%',
    maxWidth: 360,
    maxHeight: 360,
    borderRadius: 180,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.md,
  },
  placeholderTxt: { color: C.text.muted, fontSize: 14 },
  footer: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
  },
  changeBtn: { marginVertical: 0 },
});
