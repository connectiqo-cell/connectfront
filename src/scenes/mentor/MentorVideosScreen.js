import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StatusBar,
  Image,
  RefreshControl,
  Pressable,
  Easing,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import CosmicButton from '../../components/CosmicButton';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import Toast from 'react-native-simple-toast';
import LinearGradient from 'react-native-linear-gradient';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useAuth } from '../../hooks/useAuth';
import { videoApi } from '../../api/videoApi';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;
const TB = C.tabBar;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';
const INPUT_BG = '#0f0e2a';
const SHEET_BG = '#0f0e2a';
const GLASS_BORDER = 'rgba(167,139,250,0.22)';
const TITLE_MAX = 80;
const DESC_MAX = 200;
const MAX_VIDEO_MB = 80;

function runEntrance(opacity, translateY, delay = 0) {
  opacity.setValue(0);
  translateY.setValue(14);
  Animated.parallel([
    Animated.timing(opacity, {
      toValue: 1,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(translateY, {
      toValue: 0,
      duration: 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]).start();
}

function FadeSlideIn({ children, delay = 0, style, replayToken = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const hasEntered = useRef(false);

  useEffect(() => {
    if (!hasEntered.current) {
      hasEntered.current = true;
      runEntrance(opacity, translateY, delay);
      return;
    }
    if (replayToken > 0) runEntrance(opacity, translateY, delay);
  }, [replayToken, delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function AnimatedPressable({
  children,
  style,
  onPress,
  disabled,
  hoverScale = 1.08,
  pressScale = 0.92,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const hovered = useRef(false);

  const springTo = toValue => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && springTo(pressScale)}
      onPressOut={() => !disabled && springTo(hovered.current ? hoverScale : 1)}
      onHoverIn={() => {
        if (!disabled) {
          hovered.current = true;
          springTo(hoverScale);
        }
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function HoverHighlight({
  children,
  style,
  onPress,
  disabled,
  pressScale = 0.98,
  hoverScale = 1.02,
  highlightRadius = 16,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const hovered = useRef(false);

  const springTo = toValue => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 260,
      useNativeDriver: true,
    }).start();
  };

  const setHighlight = active => {
    Animated.timing(highlight, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const highlightOpacity = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const content = (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverHighlight, { opacity: highlightOpacity, borderRadius: highlightRadius }]}
      />
      {children}
    </Animated.View>
  );

  const handlers = {
    onPressIn: () => {
      if (disabled) return;
      springTo(pressScale);
      setHighlight(true);
    },
    onPressOut: () => {
      springTo(hovered.current ? hoverScale : 1);
      if (!hovered.current) setHighlight(false);
    },
    onHoverIn: () => {
      if (disabled) return;
      hovered.current = true;
      springTo(hoverScale);
      setHighlight(true);
    },
    onHoverOut: () => {
      hovered.current = false;
      springTo(1);
      setHighlight(false);
    },
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} disabled={disabled} {...handlers}>
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable disabled={disabled} {...handlers}>
      {content}
    </Pressable>
  );
}

function PulseGlow({ color = GOLD, size = 52 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseGlow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity: glowOpacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function AnimatedPriceText({ value, style, replayToken = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [value, replayToken, scale, opacity]);

  return (
    <Animated.Text style={[style, { opacity, transform: [{ scale }] }]}>
      {value}
    </Animated.Text>
  );
}

function formatFileSize(bytes) {
  const mb = (bytes || 0) / (1024 * 1024);
  if (mb < 1) return `${Math.round((bytes || 0) / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatRupee(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

const SectionLabel = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

function UnlockPriceCard({
  price,
  lockedCount,
  editing,
  priceInput,
  saving,
  error,
  onEdit,
  onCancel,
  onChange,
  onSave,
  replayToken = 0,
}) {
  return (
    <HoverHighlight style={styles.unlockCard} highlightRadius={16} hoverScale={1.01} pressScale={0.995}>
      <LinearGradient
        colors={['rgba(240,216,117,0.14)', 'rgba(124,58,237,0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.unlockCardGlow}
      />
      <View style={styles.unlockCardInner}>
        <View style={styles.unlockCardTop}>
          <View style={styles.unlockIconWrap}>
            <PulseGlow color={GOLD} size={52} />
            <LinearGradient colors={B.premiumGradient} style={styles.unlockIconGrad}>
              <MaterialIcons name="lock-open" size={22} color={GOLD} />
            </LinearGradient>
          </View>
          <View style={styles.unlockMeta}>
            <Text style={styles.unlockTitle}>Library unlock price</Text>
            <Text style={styles.unlockSubtitle}>One-time access to all locked videos</Text>
          </View>
          {!editing ? (
            <AnimatedPressable onPress={onEdit} style={styles.unlockEditBtn} hoverScale={1.06} pressScale={0.94}>
              <MaterialIcons name="edit" size={16} color={TEAL} />
              <Text style={styles.unlockEditLabel}>Edit</Text>
            </AnimatedPressable>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.unlockEditBlock}>
            <Text style={styles.unlockFieldLabel}>Price per library unlock</Text>
            <View style={[styles.unlockInputWrap, error && styles.unlockInputWrapError]}>
              <Text style={styles.unlockCurrency}>₹</Text>
              <TextInput
                style={styles.unlockInput}
                value={priceInput}
                onChangeText={onChange}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="299"
                placeholderTextColor={C.text.muted}
                autoFocus
                editable={!saving}
              />
            </View>
            {error ? (
              <View style={styles.unlockErrorRow}>
                <MaterialIcons name="error-outline" size={14} color={C.accent.error} />
                <Text style={styles.unlockErrorText}>{error}</Text>
              </View>
            ) : (
              <Text style={styles.unlockInputHint}>Recommended range · ₹99 – ₹999</Text>
            )}
            <View style={styles.unlockActions}>
              <AnimatedPressable
                onPress={onCancel}
                style={styles.unlockCancelBtn}
                disabled={saving}
                hoverScale={1.04}
                pressScale={0.96}
              >
                <Text style={styles.unlockCancelText}>Cancel</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={onSave}
                style={[styles.unlockSaveBtn, saving && styles.unlockSaveBtnDisabled]}
                disabled={saving}
                hoverScale={1.04}
                pressScale={0.96}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={C.primary.void} />
                ) : (
                  <>
                    <MaterialIcons name="check" size={16} color={C.primary.void} />
                    <Text style={styles.unlockSaveText}>Save price</Text>
                  </>
                )}
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <View style={styles.unlockDisplayBlock}>
            <AnimatedPriceText
              value={formatRupee(price)}
              style={styles.unlockAmount}
              replayToken={replayToken}
            />
            <Text style={styles.unlockPerLabel}>per learner · full library access</Text>
            <View style={styles.unlockInfoRow}>
              <View style={styles.unlockInfoChip}>
                <MaterialIcons name="lock" size={13} color={GOLD} />
                <Text style={styles.unlockInfoChipText}>
                  {lockedCount} locked video{lockedCount === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.unlockInfoChip}>
                <MaterialIcons name="payments" size={13} color={TEAL} />
                <Text style={styles.unlockInfoChipText}>Paid once</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </HoverHighlight>
  );
}

function VideoPlayerModal({ video, onClose }) {
  const videoRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <Modal
      visible={!!video}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={playerStyles.container}>
        {video && (
          <Video
            ref={videoRef}
            source={{ uri: video.video_url }}
            style={playerStyles.video}
            resizeMode="contain"
            paused={paused}
            onLoadStart={() => { setLoading(true); setError(false); }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            repeat={false}
            controls={false}
          />
        )}

        {loading && !error && (
          <ActivityIndicator style={playerStyles.loader} size="large" color={TEAL} />
        )}

        {error && (
          <View style={playerStyles.errorBox}>
            <MaterialIcons name="error-outline" size={40} color={T.colors.accent.error} />
            <Text style={playerStyles.errorText}>Could not play video</Text>
          </View>
        )}

        {/* Controls overlay */}
        <View style={[playerStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={playerStyles.closeBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={playerStyles.videoTitle} numberOfLines={1}>
            {video?.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <TouchableOpacity
          style={playerStyles.playPauseArea}
          onPress={() => setPaused(p => !p)}
          activeOpacity={1}
        >
          {paused && (
            <View style={playerStyles.playIcon}>
              <MaterialIcons name="play-arrow" size={52} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const playerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  loader: { position: 'absolute', alignSelf: 'center' },
  errorBox: { alignItems: 'center', gap: 8 },
  errorText: { color: T.colors.accent.error, fontSize: 14 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeBtn: { padding: 8, width: 40 },
  videoTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  playPauseArea: { position: 'absolute', top: 60, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  playIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({ video, index = 0, replayToken = 0, onToggleFree, onDelete, onPlay, onEdit }) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (value) => {
    setToggling(true);
    await onToggleFree(video.id, value);
    setToggling(false);
  };

  return (
    <FadeSlideIn delay={80 + index * 55} replayToken={replayToken} style={styles.cardWrap}>
      <HoverHighlight style={styles.card} highlightRadius={16} hoverScale={1.015} pressScale={0.99}>
        <HoverHighlight
          onPress={() => onPlay(video)}
          style={styles.cardThumbWrap}
          highlightRadius={12}
          hoverScale={1.03}
          pressScale={0.97}
        >
          {video.thumbnail_url ? (
            <Image source={{ uri: video.thumbnail_url }} style={styles.cardThumbImg} resizeMode="cover" />
          ) : (
            <LinearGradient colors={S.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardThumb}>
              <MaterialIcons name="videocam" size={28} color="rgba(255,255,255,0.45)" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(5,5,20,0.75)']}
            style={styles.cardThumbFade}
          />
          <View style={styles.cardPlayBadge}>
            <MaterialIcons name="play-arrow" size={18} color="#fff" />
          </View>
          <View style={[styles.statusBadge, video.is_free ? styles.statusBadgeFree : styles.statusBadgeLocked]}>
            <MaterialIcons
              name={video.is_free ? 'lock-open' : 'lock'}
              size={11}
              color={video.is_free ? C.accent.success : GOLD}
            />
            <Text style={[styles.statusBadgeText, video.is_free && { color: C.accent.success }]}>
              {video.is_free ? 'Free' : 'Locked'}
            </Text>
          </View>
        </HoverHighlight>

        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={2}>{video.title}</Text>
            <AnimatedPressable
              onPress={() => onEdit(video)}
              style={styles.editBtn}
              hoverScale={1.12}
              pressScale={0.9}
            >
              <MaterialIcons name="edit" size={18} color={TEAL} />
            </AnimatedPressable>
          </View>
          {video.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{video.description}</Text>
          ) : (
            <Text style={styles.cardDescMuted}>No description</Text>
          )}
          <View style={styles.cardFooter}>
            <View style={styles.freeRow}>
              <Text style={styles.freeLabel}>Public access</Text>
              {toggling ? (
                <ActivityIndicator size="small" color={TEAL} style={{ marginLeft: 6 }} />
              ) : (
                <Switch
                  value={video.is_free}
                  onValueChange={handleToggle}
                  trackColor={{ false: 'rgba(255,255,255,0.15)', true: TEAL }}
                  thumbColor={video.is_free ? GOLD : 'rgba(255,255,255,0.6)'}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              )}
            </View>
            <AnimatedPressable
              onPress={() => onDelete(video)}
              style={styles.deleteBtn}
              hoverScale={1.12}
              pressScale={0.9}
            >
              <MaterialIcons name="delete-outline" size={20} color={T.colors.accent.error} />
            </AnimatedPressable>
          </View>
        </View>
      </HoverHighlight>
    </FadeSlideIn>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ video, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setIsFree(video.is_free || false);
      setSaved(false);
      setErrorMsg('');
      scaleAnim.setValue(1);
      checkAnim.setValue(0);
    }
  }, [video]);

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg('Title cannot be empty');
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.04, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      return;
    }
    setErrorMsg('');
    setSaving(true);
    try {
      const updated = await videoApi.updateVideo({
        id: video.id,
        title: title.trim(),
        description: description.trim(),
        isFree,
      });
      onSaved(updated);
      setSaved(true);
      Animated.spring(checkAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }).start();
      setTimeout(() => { onClose(); setSaved(false); }, 900);
    } catch (e) {
      setErrorMsg(e.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!video} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.editModalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <View style={styles.editModalHeader}>
            <MaterialIcons name="edit" size={18} color={PURPLE_LINK} />
            <Text style={styles.modalTitle}>Edit Video</Text>
          </View>

          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={t => { setTitle(t); setErrorMsg(''); }}
            placeholder="Video title"
            placeholderTextColor={C.text.muted}
            maxLength={80}
          />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={C.text.muted}
            multiline
            maxLength={200}
          />

          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>Free to watch</Text>
            <Switch
              value={isFree}
              onValueChange={setIsFree}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: TEAL }}
              thumbColor={isFree ? GOLD : 'rgba(255,255,255,0.6)'}
            />
          </View>

          {/* Error message */}
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={14} color={T.colors.accent.error} />
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.uploadBtn,
                saved && styles.savedBtn,
                (saving || saved) && { opacity: 0.9 },
              ]}
              onPress={handleSave}
              disabled={saving || saved}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#000" size="small" />
              ) : saved ? (
                <Animated.View style={[styles.savedRow, { transform: [{ scale: checkAnim }] }]}>
                  <MaterialIcons name="check-circle" size={18} color="#000" />
                  <Text style={styles.uploadBtnText}>Saved!</Text>
                </Animated.View>
              ) : (
                <Text style={styles.uploadBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ visible, onClose, onUploaded }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [pickedFile, setPickedFile] = useState(null);
  const [pickedThumbnail, setPickedThumbnail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formError, setFormError] = useState('');
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const animateProgress = (toValue) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const reset = () => {
    setTitle('');
    setDescription('');
    setIsFree(false);
    setPickedFile(null);
    setPickedThumbnail(null);
    setUploading(false);
    setProgress(0);
    setFormError('');
    progressAnim.setValue(0);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const pickVideo = () => {
    if (uploading) return;
    launchImageLibrary(
      { mediaType: 'video', videoQuality: 'medium' },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset) return;

        const sizeMB = (asset.fileSize || 0) / (1024 * 1024);
        if (sizeMB > MAX_VIDEO_MB) {
          Toast.show(`Video must be under ${MAX_VIDEO_MB} MB`, Toast.LONG);
          return;
        }
        setPickedFile(asset);
        setFormError('');
      },
    );
  };

  const pickThumbnail = () => {
    if (uploading) return;
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset) return;
        setPickedThumbnail(asset);
      },
    );
  };

  const handleUpload = async () => {
    if (!title.trim()) {
      setFormError('Add a title for your video');
      return;
    }
    if (!pickedFile) {
      setFormError('Select a video from your gallery');
      return;
    }

    setFormError('');
    setUploading(true);
    setProgress(0);
    progressAnim.setValue(0);
    try {
      const uploaded = await videoApi.uploadVideo({
        mentorId: user.id,
        title: title.trim(),
        description: description.trim(),
        fileUri: pickedFile.uri,
        fileName: pickedFile.fileName || `video_${Date.now()}.mp4`,
        isFree,
        onProgress: (pct) => {
          setProgress(pct);
          animateProgress(pct);
        },
        thumbnailUri: pickedThumbnail?.uri,
        thumbnailFileName: pickedThumbnail?.fileName || (pickedThumbnail ? `thumb_${Date.now()}.jpg` : undefined),
      });
      Toast.show('Video uploaded successfully', Toast.SHORT);
      onUploaded(uploaded);
      reset();
      onClose();
    } catch (e) {
      setFormError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleClose} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <LinearGradient colors={B.nebulaGradient} style={styles.modalHeaderIconGrad}>
                <MaterialIcons name="cloud-upload" size={18} color={B.nebulaText} />
              </LinearGradient>
            </View>
            <View style={styles.modalHeaderText}>
              <Text style={styles.modalTitle}>Upload video</Text>
              <Text style={styles.modalSubtitle}>Share knowledge with your learners</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn} disabled={uploading}>
              <MaterialIcons name="close" size={20} color={C.text.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionLabel>Media</SectionLabel>

            <TouchableOpacity
              style={[styles.mediaZone, pickedFile && styles.mediaZoneFilled]}
              onPress={pickVideo}
              activeOpacity={0.85}
              disabled={uploading}
            >
              <MaterialIcons
                name={pickedFile ? 'check-circle' : 'video-library'}
                size={28}
                color={pickedFile ? C.accent.success : TEAL}
              />
              <Text style={styles.mediaZoneTitle}>
                {pickedFile ? 'Video selected' : 'Choose video'}
              </Text>
              <Text style={styles.mediaZoneHint}>
                {pickedFile
                  ? `${pickedFile.fileName || 'Gallery video'} · ${formatFileSize(pickedFile.fileSize)}`
                  : `MP4 or MOV · Max ${MAX_VIDEO_MB} MB`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.thumbZone, pickedThumbnail && styles.thumbZoneFilled]}
              onPress={pickThumbnail}
              activeOpacity={0.85}
              disabled={uploading}
            >
              {pickedThumbnail ? (
                <Image source={{ uri: pickedThumbnail.uri }} style={styles.thumbPreview} resizeMode="cover" />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <MaterialIcons name="image" size={22} color={PURPLE_LINK} />
                </View>
              )}
              <View style={styles.thumbMeta}>
                <Text style={styles.thumbTitle}>
                  {pickedThumbnail ? 'Thumbnail selected' : 'Add thumbnail'}
                </Text>
                <Text style={styles.thumbHint}>
                  {pickedThumbnail ? 'Tap to change' : 'Optional · helps attract viewers'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={C.text.muted} />
            </TouchableOpacity>

            <SectionLabel>Details</SectionLabel>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. How to grow on Instagram"
              placeholderTextColor={C.text.muted}
              value={title}
              onChangeText={t => { setTitle(t); setFormError(''); }}
              maxLength={TITLE_MAX}
              editable={!uploading}
            />
            <Text style={styles.charCount}>{title.length}/{TITLE_MAX}</Text>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="What will learners gain from this video?"
              placeholderTextColor={C.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={DESC_MAX}
              editable={!uploading}
            />
            <Text style={styles.charCount}>{description.length}/{DESC_MAX}</Text>

            <View style={styles.visibilityCard}>
              <View style={styles.visibilityInfo}>
                <MaterialIcons name={isFree ? 'public' : 'lock'} size={20} color={isFree ? C.accent.success : GOLD} />
                <View style={styles.visibilityText}>
                  <Text style={styles.visibilityTitle}>{isFree ? 'Free for everyone' : 'Premium content'}</Text>
                  <Text style={styles.visibilityHint}>
                    {isFree
                      ? 'Great for building trust — your first few videos should be free'
                      : 'Only subscribers who unlock your library can watch'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isFree}
                onValueChange={setIsFree}
                disabled={uploading}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: TEAL }}
                thumbColor={isFree ? GOLD : 'rgba(255,255,255,0.6)'}
              />
            </View>

            {formError ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={14} color={T.colors.accent.error} />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            ) : null}

            {uploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    {progress < 100 ? 'Uploading video…' : 'Saving to library…'}
                  </Text>
                  <Text style={styles.progressText}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                          extrapolate: 'clamp',
                        }),
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <CosmicButton
              label={
                uploading
                  ? progress < 100
                    ? 'Uploading…'
                    : 'Saving…'
                  : 'Publish video'
              }
              variant="nebula"
              icon="cloud-upload"
              onPress={handleUpload}
              loading={uploading}
              disabled={uploading}
              style={styles.uploadBtn}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MentorVideosScreen({ embeddedInTab = false }) {
  const navigation = useNavigation();
  const bottomListPad = (TB.floating?.contentReserve ?? 115) + T.spacing.lg;
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [unlockPrice, setUnlockPrice] = useState(299);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('299');
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [replayToken, setReplayToken] = useState(0);

  const loadVideos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [vids, price] = await Promise.all([
        videoApi.getMentorVideos(user.id),
        videoApi.getUnlockPrice(user.id),
      ]);
      setVideos(vids);
      setUnlockPrice(price);
      setPriceInput(String(price));
    } catch (e) {
      Toast.show(e.message, Toast.LONG);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) loadVideos(true);
    }, [loadVideos, loading]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideos(true);
    setReplayToken(t => t + 1);
  };

  const handleToggleFree = async (id, isFree) => {
    try {
      await videoApi.updateVideo({ id, isFree });
      setVideos(prev => prev.map(v => v.id === id ? { ...v, is_free: isFree } : v));
    } catch (e) {
      Toast.show(e.message, Toast.LONG);
    }
  };

  const handleDelete = (video) => {
    Alert.alert('Delete video', `Remove "${video.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await videoApi.deleteVideo({ id: video.id, storagePath: video.storage_path });
            setVideos(prev => prev.filter(v => v.id !== video.id));
            Toast.show('Video deleted', Toast.SHORT);
          } catch (e) {
            Toast.show(e.message, Toast.LONG);
          }
        },
      },
    ]);
  };

  const handleSavePrice = async () => {
    const p = parseInt(priceInput, 10);
    if (isNaN(p) || p < 1) {
      setPriceError('Enter a valid price of at least ₹1');
      return;
    }
    if (p > 9999) {
      setPriceError('Maximum price is ₹9,999');
      return;
    }
    setPriceError('');
    setSavingPrice(true);
    try {
      await videoApi.setUnlockPrice({ mentorId: user.id, price: p });
      setUnlockPrice(p);
      setEditingPrice(false);
      setReplayToken(t => t + 1);
      Toast.show('Unlock price updated', Toast.SHORT);
    } catch (e) {
      setPriceError(e.message || 'Could not save price. Try again.');
    } finally {
      setSavingPrice(false);
    }
  };

  const handleStartEditPrice = () => {
    setPriceInput(String(unlockPrice));
    setPriceError('');
    setEditingPrice(true);
  };

  const handleCancelEditPrice = () => {
    setPriceInput(String(unlockPrice));
    setPriceError('');
    setEditingPrice(false);
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate(SCREEN_NAMES.UnifiedHome);
    }
  };

  const lockedCount = videos.filter(v => !v.is_free).length;

  const listHeader = (
    <>
      <FadeSlideIn delay={40} replayToken={replayToken}>
        <UnlockPriceCard
          price={unlockPrice}
          lockedCount={lockedCount}
          editing={editingPrice}
          priceInput={priceInput}
          saving={savingPrice}
          error={priceError}
          replayToken={replayToken}
          onEdit={handleStartEditPrice}
          onCancel={handleCancelEditPrice}
          onChange={text => {
            setPriceInput(text.replace(/[^0-9]/g, ''));
            setPriceError('');
          }}
          onSave={handleSavePrice}
        />
      </FadeSlideIn>

      <FadeSlideIn delay={100} replayToken={replayToken}>
        <CosmicButton
          label="Upload new video"
          variant="nebula"
          icon="add"
          onPress={() => setShowUpload(true)}
          style={styles.uploadCta}
        />
      </FadeSlideIn>

      <FadeSlideIn delay={150} replayToken={replayToken}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your videos</Text>
          <Text style={styles.sectionSubtitle}>
            {videos.length ? 'Tap a video to preview' : 'Start building your library'}
          </Text>
        </View>
      </FadeSlideIn>
    </>
  );

  const headerBlock = (
    <FadeSlideIn delay={0} replayToken={replayToken}>
      <View style={styles.screenHeader}>
        {!embeddedInTab ? (
          <AnimatedPressable onPress={handleGoBack} style={styles.backBtn} hoverScale={1.08} pressScale={0.92}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </AnimatedPressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.screenHeaderCenter}>
          <Text style={styles.screenTitle}>Upload</Text>
          <Text style={styles.screenSubtitle}>Manage and publish your content</Text>
        </View>
        <AnimatedPressable
          onPress={handleRefresh}
          style={styles.refreshBtn}
          disabled={refreshing}
          hoverScale={1.08}
          pressScale={0.92}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={TEAL} />
          ) : (
            <MaterialIcons name="refresh" size={20} color={TEAL} />
          )}
        </AnimatedPressable>
      </View>
    </FadeSlideIn>
  );

  return (
    <SafeScreen
      scrollable={false}
      padding={0}
      hasBottomTabs={false}
      includeTopInset={embeddedInTab ? false : STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}
    >
      <View style={styles.screenBody}>
      {embeddedInTab ? headerBlock : (
        <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>{headerBlock}</StackScreenHeader>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={TEAL} size="large" />
          <Text style={styles.loadingText}>Loading your library…</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listFlex}
          data={videos}
          keyExtractor={v => v.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <FadeSlideIn delay={200} replayToken={replayToken}>
              <HoverHighlight style={styles.emptyState} highlightRadius={16} hoverScale={1.01} pressScale={0.99}>
                <View style={styles.emptyIconWrap}>
                  <PulseGlow color={PURPLE_LINK} size={64} />
                  <MaterialIcons name="cloud-upload" size={36} color={PURPLE_LINK} />
                </View>
                <Text style={styles.emptyText}>No videos yet</Text>
                <Text style={styles.emptyHint}>
                  Upload your first lesson to help learners discover your expertise
                </Text>
                <CosmicButton
                  label="Upload your first video"
                  variant="nebula"
                  icon="add"
                  onPress={() => setShowUpload(true)}
                  style={styles.emptyCta}
                />
              </HoverHighlight>
            </FadeSlideIn>
          }
          renderItem={({ item, index }) => (
            <VideoCard
              video={item}
              index={index}
              replayToken={replayToken}
              onToggleFree={handleToggleFree}
              onDelete={handleDelete}
              onPlay={setPlayingVideo}
              onEdit={setEditingVideo}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomListPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} colors={[TEAL]} />
          }
        />
      )}

      </View>

      <UploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={(v) => setVideos(prev => [v, ...prev])}
      />

      <VideoPlayerModal
        video={playingVideo}
        onClose={() => setPlayingVideo(null)}
      />

      <EditModal
        video={editingVideo}
        onClose={() => setEditingVideo(null)}
        onSaved={(updated) =>
          setVideos(prev => prev.map(v => v.id === updated.id ? updated : v))
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.18)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  screenHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: T.spacing.sm,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
  },
  screenSubtitle: {
    fontSize: 12,
    color: C.text.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: C.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  list: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.sm,
  },
  listFlex: {
    flex: 1,
  },

  hoverHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(167,139,250,0.1)',
  },
  pulseGlow: {
    position: 'absolute',
    borderWidth: 2,
  },

  cardWrap: {
    marginBottom: 12,
  },

  unlockCard: {
    borderRadius: 16,
    marginBottom: T.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.28)',
    backgroundColor: PANEL_BG,
  },
  unlockCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  unlockCardInner: {
    padding: T.spacing.lg,
  },
  unlockCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: T.spacing.md,
  },
  unlockIconWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockIconGrad: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockMeta: { flex: 1 },
  unlockTitle: {
    color: C.text.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  unlockSubtitle: {
    color: C.text.muted,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  unlockEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: S.accentTeal,
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.25)',
  },
  unlockEditLabel: {
    color: TEAL,
    fontSize: 12,
    fontWeight: '700',
  },
  unlockDisplayBlock: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  unlockAmount: {
    color: GOLD,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unlockPerLabel: {
    color: C.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  unlockInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unlockInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  unlockInfoChipText: {
    color: C.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  unlockEditBlock: {
    gap: 8,
  },
  unlockFieldLabel: {
    color: PURPLE_LINK,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  unlockInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  unlockInputWrapError: {
    borderColor: 'rgba(248,113,113,0.45)',
  },
  unlockCurrency: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '800',
    marginRight: 6,
  },
  unlockInput: {
    flex: 1,
    color: C.text.primary,
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 10,
  },
  unlockInputHint: {
    color: C.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  unlockErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  unlockErrorText: {
    color: C.accent.error,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  unlockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  unlockCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unlockCancelText: {
    color: C.text.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  unlockSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 118,
    justifyContent: 'center',
  },
  unlockSaveBtnDisabled: {
    opacity: 0.75,
  },
  unlockSaveText: {
    color: C.primary.void,
    fontSize: 13,
    fontWeight: '800',
  },

  uploadCta: { marginBottom: T.spacing.lg },

  sectionHeader: {
    marginBottom: T.spacing.sm,
  },
  sectionTitle: {
    color: C.text.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: C.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    color: PURPLE_LINK,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  cardThumbWrap: {
    width: 104,
    height: 104,
    position: 'relative',
  },
  cardThumb: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardThumbImg: {
    width: '100%',
    height: '100%',
  },
  cardThumbFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  cardPlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeFree: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  statusBadgeLocked: {
    backgroundColor: 'rgba(240,216,117,0.18)',
  },
  statusBadgeText: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardInfo: { flex: 1, padding: 12 },
  cardTitle: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
  cardDesc: { color: C.text.muted, fontSize: 12, marginBottom: 8, lineHeight: 17 },
  cardDescMuted: { color: 'rgba(255,255,255,0.28)', fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  freeLabel: { color: C.text.secondary, fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 4 },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: T.spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: PANEL_BG,
    marginTop: 4,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  emptyText: { color: C.text.primary, fontSize: 16, fontWeight: '800' },
  emptyHint: { color: C.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyCta: { marginTop: 8, alignSelf: 'stretch' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,3,8,0.75)',
  },
  modalSheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: GLASS_BORDER,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  modalHeaderIcon: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeaderIconGrad: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: C.text.primary, fontSize: 17, fontWeight: '800' },
  modalSubtitle: { color: C.text.muted, fontSize: 12, marginTop: 2 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PANEL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },

  mediaZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(94,234,212,0.3)',
    borderStyle: 'dashed',
    backgroundColor: S.accentTeal,
    marginBottom: 10,
    gap: 6,
  },
  mediaZoneFilled: {
    borderStyle: 'solid',
    borderColor: 'rgba(34,197,94,0.35)',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  mediaZoneTitle: {
    color: C.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  mediaZoneHint: {
    color: C.text.muted,
    fontSize: 12,
    textAlign: 'center',
  },

  thumbZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 8,
  },
  thumbZoneFilled: {
    borderColor: 'rgba(167,139,250,0.35)',
  },
  thumbPreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: S.accentViolet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMeta: { flex: 1 },
  thumbTitle: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
  thumbHint: { color: C.text.muted, fontSize: 11, marginTop: 2 },

  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 12,
  },
  visibilityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  visibilityText: { flex: 1 },
  visibilityTitle: {
    color: C.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  visibilityHint: {
    color: C.text.muted,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },

  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  inputMulti: { height: 88, textAlignVertical: 'top' },
  charCount: {
    color: C.text.muted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 2,
  },

  progressContainer: { marginTop: 14, marginBottom: 4, gap: 8 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { color: C.text.secondary, fontSize: 12, fontWeight: '600' },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: TEAL, borderRadius: 3 },
  progressText: { color: TEAL, fontSize: 12, fontWeight: '800' },

  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  editBtn: { paddingTop: 2 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    marginTop: 10,
    marginBottom: 4,
  },
  errorBannerText: {
    color: C.accent.error,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  editModalBackdrop: { flex: 1, backgroundColor: 'rgba(3,3,8,0.75)' },
  savedBtn: { backgroundColor: C.accent.success },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldLabel: {
    color: PURPLE_LINK,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  uploadBtn: { marginTop: 16, marginBottom: 8 },
  uploadBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
});
