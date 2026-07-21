import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  AppState,
  Animated,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import Toast from 'react-native-simple-toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import {
  getFloatingTabBarContentInset,
} from '../../components/CosmicBottomTabBar';
import CosmicButton from '../../components/CosmicButton';
import { CircularProfileImage } from '../../components/CircularGradientFrame';
import { useAvatarPreview } from '../../contexts/AvatarPreviewContext';
import { videoApi } from '../../api/videoApi';
import { homeApi } from '../../api/homeApi';
import { useAuth } from '../../hooks/useAuth';
import { isSameUserId } from '../../utils/mentorOwnership';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import { purchaseAndroidProduct, finishAndroidPurchase, PLAY_VIDEO_UNLOCK_PRODUCT_ID } from '../../utils/playBilling';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { consumePendingLearnerVideo } from '../../navigators/pendingVideoNavigation';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = '#161432';
const SHEET_BG = '#0f0e2a';
const GLASS_BORDER = C.border.light;

function SkeletonBone({ style }) {
  const sk = useThemedStyles(createVideosSkeletonStyles);
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.38] });
  return <Animated.View style={[sk.bone, style, { opacity }]} />;
}

function VideosSkeleton() {
  const sk = useThemedStyles(createVideosSkeletonStyles);
  const { theme } = useTheme();
  return (
    <View style={sk.root}>
      <SkeletonBone style={sk.shimmerVideo} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        style={sk.shimmerGradient}
        pointerEvents="none"
      />
      <View style={sk.shimmerRail}>
        <SkeletonBone style={sk.shimmerAvatar} />
      </View>
      <View style={sk.shimmerDock}>
        <SkeletonBone style={sk.shimmerName} />
        <SkeletonBone style={sk.shimmerTitle} />
        <SkeletonBone style={sk.shimmerDesc} />
      </View>
      <SkeletonBone style={sk.shimmerProgress} />
    </View>
  );
}

function ReelProfileRail({ item, onViewProfile }) {
  const s = useThemedStyles(createVideosStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const { showAvatarPreview } = useAvatarPreview();
  const name = item.profiles?.name || 'Connectiqo';
  const canPress = !!item.mentor_id && onViewProfile;

  const avatar = (
    <CircularProfileImage
      size={56}
      ringWidth={2}
      colors={B.premiumGradient}
      innerBg={C.primary.void}
      borderColor="#fff"
      style={s.railAvatarFrame}
      uri={item.profiles?.avatar_url}
      previewName={name}
      onPress={() => showAvatarPreview({
        uri: item.profiles?.avatar_url,
        name,
      })}
      pressable={false}
      fallback={
        <View style={s.railAvatarFallback}>
          <MaterialIcons name="person" size={22} color="#fff" />
        </View>
      }
    />
  );

  return (
    <View style={s.actionRail}>
      {canPress ? (
        <TouchableOpacity
          style={s.railBtn}
          onPress={() => showAvatarPreview({
            uri: item.profiles?.avatar_url,
            name,
          })}
          activeOpacity={0.85}
          accessibilityLabel={`View ${name}'s profile photo`}
        >
          {avatar}
        </TouchableOpacity>
      ) : (
        <View style={s.railBtn}>{avatar}</View>
      )}
    </View>
  );
}

function ReelProgressBar({ progress, duration }) {
  const s = useThemedStyles(createVideosStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const pct = duration > 0 ? Math.min(progress / duration, 1) : 0;
  return (
    <View style={s.progressTrack} pointerEvents="none">
      <View style={[s.progressFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const REEL_PROGRESS_HEIGHT = 3;
const REEL_META_BOTTOM = 8;
const REEL_DOCK_RESERVE = 76;
const REEL_RAIL_RESERVE = 80;

function ReelInfoDock({
  item,
  onViewProfile,
}) {
  const s = useThemedStyles(createVideosStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const { showAvatarPreview } = useAvatarPreview();
  const [descExpanded, setDescExpanded] = useState(false);
  const [needsMore, setNeedsMore] = useState(false);
  const name = item.profiles?.name || 'Connectiqo';
  const spec = item.mentor_profiles?.specialization;
  const canPressProfile = !!item.mentor_id && onViewProfile;
  const description = (item.description || '').trim();

  useEffect(() => {
    setDescExpanded(false);
    setNeedsMore(false);
  }, [item.id]);

  const handleTextLayout = useCallback((event) => {
    if (descExpanded || !description) return;
    const lines = event.nativeEvent.lines || [];
    if (lines.length === 0) return;
    const renderedChars = lines.reduce((sum, line) => sum + (line.text?.length ?? 0), 0);
    setNeedsMore(renderedChars < description.length);
  }, [descExpanded, description]);

  const showMoreControl = description.length > 0
    && (descExpanded || needsMore || description.length > 50);

  return (
    <View
      style={[
        s.infoDock,
        { paddingRight: REEL_RAIL_RESERVE },
      ]}
    >
      <View style={s.reelMetaRow}>
        {canPressProfile ? (
          <View style={s.reelMentorTap}>
            <TouchableOpacity
              onPress={() => showAvatarPreview({
                uri: item.profiles?.avatar_url,
                name,
              })}
              activeOpacity={0.85}
              accessibilityLabel={`View ${name}'s profile photo`}
            >
              <CircularProfileImage
                size={26}
                ringWidth={1}
                colors={B.premiumGradient}
                innerBg={C.primary.void}
                borderColor="#fff"
                style={s.reelInlineAvatarFrame}
                uri={item.profiles?.avatar_url}
                previewName={name}
                pressable={false}
                fallback={
                  <View style={s.reelInlineAvatarFallback}>
                    <MaterialIcons name="person" size={14} color="#fff" />
                  </View>
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onViewProfile(item.mentor_id)}
              activeOpacity={0.85}
            >
              <Text style={s.reelMentorName} numberOfLines={1}>@{name}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.reelMentorName} numberOfLines={1}>@{name}</Text>
        )}
      </View>

      {spec ? (
        <Text style={s.reelMentorSpec} numberOfLines={1}>{spec}</Text>
      ) : null}

      <Text
        style={s.reelVideoTitle}
        numberOfLines={descExpanded ? 3 : 2}
      >
        {item.title}
      </Text>

      {description ? (
        <View style={s.reelDescBlock}>
          <Text
            style={s.reelVideoDesc}
            numberOfLines={descExpanded ? undefined : 2}
            onTextLayout={handleTextLayout}
          >
            {description}
          </Text>
          {showMoreControl ? (
            <Pressable
              onPress={() => setDescExpanded(v => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [s.reelMoreBtn, pressed && s.reelMoreBtnPressed]}
            >
              <Text style={s.reelMoreText}>{descExpanded ? 'Show less' : 'more'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── Unlock bottom sheet ──────────────────────────────────────────────────────
function UnlockSheet({ video, onClose, onUnlocked }) {
  const u = useThemedStyles(createUnlockStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const price = video?.mentor_profiles?.unlock_price || 299;
  const mentorName = video?.profiles?.name || 'this mentor';

  const handleUnlock = async () => {
    if (!user) { Toast.show('Please log in'); return; }
    if (isSameUserId(video?.mentor_id, user, profile)) {
      onUnlocked(video.mentor_id);
      onClose();
      return;
    }
    setLoading(true);
    try {
      if (Platform.OS === 'android') {
        const purchase = await purchaseAndroidProduct(PLAY_VIDEO_UNLOCK_PRODUCT_ID);

        await videoApi.verifyPlayPurchase({
          mentorId:      video.mentor_id,
          learnerId:     user.id,
          productId:     purchase.productId,
          purchaseToken: purchase.purchaseToken,
        });

        // Only consume after the server has confirmed + credited the purchase —
        // otherwise a crash between verify and consume would leave the token
        // consumable-but-uncredited.
        await finishAndroidPurchase(purchase);
      } else {
        const order = await videoApi.createVideoOrder({
          mentorId:  video.mentor_id,
          learnerId: user.id,
        });

        const paymentData = await openRazorpayCheckout({
          key:         order.keyId,
          amount:      order.amount,
          currency:    order.currency || 'INR',
          name:        'Connectiqo',
          description: `Subscribe to ${mentorName}'s video library`,
          order_id:    order.orderId,
          prefill:     { email: user.email || '' },
          theme:       { color: '#5eead4' },
          upi:         { flow: 'intent' },
        });

        await videoApi.verifyVideoSubscription({
          razorpayOrderId:   order.orderId,
          razorpayPaymentId: paymentData.razorpay_payment_id,
          razorpaySignature: paymentData.razorpay_signature,
          mentorId:          video.mentor_id,
          learnerId:         user.id,
        });
      }

      onUnlocked(video.mentor_id);
      onClose();
      Toast.show('Subscribed! Watch all videos this month.', Toast.SHORT);
    } catch (e) {
      if (e?.code !== 'PAYMENT_CANCELLED') {
        Toast.show(e?.message || 'Payment failed', Toast.LONG);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!video) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={u.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={u.sheet}>
        <View style={u.handle} />

        <View style={u.mentorRow}>
          <CircularProfileImage
            size={52}
            ringWidth={2}
            colors={B.premiumGradient}
            innerBg={C.primary.void}
            uri={video.profiles?.avatar_url}
            previewName={mentorName}
            fallback={
              <View style={u.avatarFallback}>
                <MaterialIcons name="person" size={20} color={PURPLE_LINK} />
              </View>
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={u.mentorName}>{mentorName}</Text>
            <Text style={u.mentorSpec}>{video.mentor_profiles?.specialization || ''}</Text>
          </View>
          <View style={u.pricePill}>
            <Text style={u.priceText}>₹{price}</Text>
          </View>
        </View>

        <View style={u.divider} />

        <Text style={u.title}>Subscribe to video library</Text>
        <Text style={u.sub}>Monthly subscription · Access all of {mentorName}'s videos</Text>

        <View style={u.perks}>
          {['All current videos', 'All future uploads', 'Cancel anytime'].map(p => (
            <View key={p} style={u.perkRow}>
              <MaterialIcons name="check-circle" size={16} color={C.accent.success} />
              <Text style={u.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <CosmicButton
          label={`Subscribe · ₹${price}/mo`}
          variant="nebula"
          onPress={handleUnlock}
          loading={loading}
          disabled={loading}
          style={u.payBtn}
        />

        <CosmicButton
          label="Maybe later"
          variant="goldOutline"
          size="compact"
          onPress={onClose}
          style={u.cancelBtnWrap}
        />
      </View>
    </Modal>
  );
}

function createUnlockStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,3,8,0.75)' },
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: T.spacing.lg,
    paddingBottom: T.spacing.xxxl,
    borderTopWidth: 1,
    borderColor: GLASS_BORDER,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: T.spacing.lg,
  },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.md,
    marginBottom: T.spacing.lg,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    backgroundColor: C.primary.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorName: { color: C.text.primary, fontSize: 15, fontWeight: '800' },
  mentorSpec: { color: GOLD, fontSize: 12, marginTop: 2, fontWeight: '600' },
  pricePill: { backgroundColor: S.accentTeal, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(94,234,212,0.25)' },
  priceText: { color: TEAL, fontSize: 14, fontWeight: '800' },
  divider: {
    height: 1,
    backgroundColor: 'rgba(167,139,250,0.18)',
    marginBottom: T.spacing.lg,
  },
  title: {
    color: C.text.primary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: T.spacing.xs,
  },
  sub: {
    color: C.text.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: T.spacing.lg,
  },
  perks: {
    gap: T.spacing.sm,
    marginBottom: T.spacing.xl,
    backgroundColor: PANEL_BG,
    borderRadius: 14,
    padding: T.spacing.md,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.sm },
  perkText: { color: C.text.secondary, fontSize: 13 },
  payBtn: { marginBottom: T.spacing.sm, marginVertical: 0 },
  cancelBtnWrap: { marginVertical: 0 },
});
}

// ─── Single short card (full-screen reel) ─────────────────────────────────────
function ShortCard({
  item,
  isActive,
  height,
  isUnlocked,
  onLockPress,
  onViewProfile,
  forcePaused,
  allowPlayback,
}) {
  const s = useThemedStyles(createVideosStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const canPlay = item.is_free || isUnlocked;

  const effectivePaused = !allowPlayback || !isActive || paused || forcePaused;
  const showOverlays = canPlay && allowPlayback;
  const tapBottomReserve = REEL_DOCK_RESERVE + REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT;

  useEffect(() => {
    if (!isActive) {
      if (paused) setPaused(false);
      setProgress(0);
      setDuration(0);
      setBuffering(false);
    }
  }, [isActive, paused]);

  useEffect(() => {
    if (!allowPlayback && paused) setPaused(false);
  }, [allowPlayback, paused]);

  const handleTap = () => {
    setPaused(p => !p);
  };

  return (
    <View style={{ height, width: '100%', backgroundColor: '#000' }}>
      <View style={s.mediaLayer} pointerEvents="none">
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#0d1b3e', '#0a0f2a', '#000']}
            style={StyleSheet.absoluteFill}
          />
        )}

        {isActive && canPlay && item.video_url ? (
          <Video
            key={`${item.id}-${isActive}`}
            source={{ uri: item.video_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={effectivePaused}
            repeat
            controls={false}
            ignoreSilentSwitch="obey"
            playInBackground={false}
            playWhenInactive={false}
            onLoad={data => {
              setDuration(data.duration || 0);
              setBuffering(false);
            }}
            onProgress={data => setProgress(data.currentTime || 0)}
            onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
            onLoadStart={() => setBuffering(true)}
          />
        ) : null}
      </View>

      {canPlay && (
        <Pressable
          style={[
            s.tapArea,
            { bottom: tapBottomReserve, right: REEL_RAIL_RESERVE },
          ]}
          onPress={handleTap}
        />
      )}

      {!canPlay && (
        <View style={s.lockOverlay}>
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.18, 0.55, 1]}
            style={s.reelGradient}
            pointerEvents="none"
          />
          <ReelProfileRail
            item={item}
            onViewProfile={onViewProfile}
          />
          <ReelInfoDock
            item={item}
            onViewProfile={onViewProfile}
          />
          <View style={s.lockCard}>
            <View style={s.lockIconWrap}>
              <MaterialIcons name="lock" size={28} color="#fff" />
            </View>
            <Text style={s.lockTitle}>Premium content</Text>
            <Text style={s.lockSub}>
              Subscribe to {item.profiles?.name || 'this mentor'}'s library
            </Text>
            <CosmicButton
              label={`Unlock · ₹${item.mentor_profiles?.unlock_price || 299}/mo`}
              variant="nebula"
              size="compact"
              onPress={() => onLockPress(item)}
              style={s.lockBtn}
            />
          </View>
        </View>
      )}

      {showOverlays && (
        <>
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.18, 0.55, 1]}
            style={s.reelGradient}
            pointerEvents="none"
          />

          <ReelProfileRail
            item={item}
            onViewProfile={onViewProfile}
          />

          <ReelInfoDock
            item={item}
            onViewProfile={onViewProfile}
          />

          {isActive && !effectivePaused && duration > 0 ? (
            <ReelProgressBar
              progress={progress}
              duration={duration}
            />
          ) : null}
        </>
      )}

      {canPlay && isActive && buffering && (
        <View style={s.bufferingWrap} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {canPlay && isActive && paused && (
        <View style={s.pauseIcon} pointerEvents="none">
          <View style={s.pauseBackdrop}>
            <MaterialIcons name="play-arrow" size={48} color="#fff" style={s.pauseArrow} />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function VideosScreen({ navigation, route }) {
  const s = useThemedStyles(createVideosStyles);
  const { theme } = useTheme();
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(0);
  const metadataBottomInset = getFloatingTabBarContentInset(insets);
  const reelPageHeight = viewportHeight;

  const [videos, setVideos]         = useState([]);
  const [unlocksMap, setUnlocksMap] = useState(new Map());
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lockSheetVideo, setLockSheetVideo] = useState(null);

  const flatListRef = useRef(null);
  const pendingScrollIdRef = useRef(null);
  const startVideoId    = route?.params?.startVideoId;
  const filterMentorId  = route?.params?.filterMentorId;
  const [effectiveFilterMentorId, setEffectiveFilterMentorId] = useState(null);
  const [scrollTargetId, setScrollTargetId] = useState(null);

  const isOwnMentorVideo = useCallback(
    videoMentorId => isSameUserId(videoMentorId, user, profile),
    [user?.id, profile?.id],
  );

  const scrollToVideoIndex = useCallback((index) => {
    if (index < 0 || reelPageHeight <= 0) return;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: reelPageHeight * index,
        animated: false,
      });
      setActiveIndex(index);
    });
  }, [reelPageHeight]);

  const isFocused = useIsFocused();
  const [tabFocused, setTabFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const allowPlayback = (isFocused || tabFocused) && appActive && lockSheetVideo === null;

  useEffect(() => {
    if (filterMentorId != null && filterMentorId !== '') {
      setEffectiveFilterMentorId(String(filterMentorId));
    }
  }, [filterMentorId]);

  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      const pending = consumePendingLearnerVideo();
      if (pending?.mentorId) {
        setEffectiveFilterMentorId(pending.mentorId);
      }
      if (pending?.videoId) {
        pendingScrollIdRef.current = pending.videoId;
        setScrollTargetId(pending.videoId);
      }
      return () => setTabFocused(false);
    }, []),
  );

  useEffect(() => {
    if (startVideoId != null && startVideoId !== '') {
      const id = String(startVideoId);
      pendingScrollIdRef.current = id;
      setScrollTargetId(id);
    }
  }, [startVideoId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  // Scroll to top (latest video) when user taps the tab directly
  useEffect(() => {
    const unsubscribe = navigation?.addListener('tabPress', () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      setActiveIndex(0);
    });
    return unsubscribe;
  }, [navigation]);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    const primary = viewableItems.find(v => v.isViewable) ?? viewableItems[0];
    if (primary?.index == null) return;
    setActiveIndex(primary.index);
  }, []);

  const onViewableItemsChangedRef = useRef(onViewableItemsChanged);
  onViewableItemsChangedRef.current = onViewableItemsChanged;

  const viewabilityPairsRef = useRef([
    {
      viewabilityConfig: {
        itemVisiblePercentThreshold: 51,
        minimumViewTime: 0,
      },
      onViewableItemsChanged: info => onViewableItemsChangedRef.current(info),
    },
  ]);

  const syncActiveIndexFromOffset = useCallback((offsetY) => {
    if (reelPageHeight <= 0 || videos.length === 0) return;
    const index = Math.round(offsetY / reelPageHeight);
    const clamped = Math.max(0, Math.min(index, videos.length - 1));
    setActiveIndex(clamped);
  }, [reelPageHeight, videos.length]);

  useEffect(() => {
    loadFeed(false, user?.id);
  }, [user?.id, effectiveFilterMentorId]);

  useEffect(() => {
    const targetId = scrollTargetId || pendingScrollIdRef.current;
    if (!targetId || loading || videos.length === 0) return;

    const idx = videos.findIndex(v => String(v.id) === String(targetId));
    if (idx < 0) return;

    let cancelled = false;
    let attempts = 0;

    const finishScroll = () => {
      pendingScrollIdRef.current = null;
      setScrollTargetId(null);
      navigation?.setParams?.({ startVideoId: undefined });
    };

    const tryScroll = () => {
      if (cancelled) return;
      attempts += 1;
      if (reelPageHeight <= 0) {
        if (attempts < 40) setTimeout(tryScroll, 50);
        return;
      }
      scrollToVideoIndex(idx);
      finishScroll();
    };

    const timer = setTimeout(tryScroll, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scrollTargetId, loading, videos, reelPageHeight, scrollToVideoIndex, navigation]);

  const loadFeed = async (isRefresh = false, userId = user?.id) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const mentorFilterId = effectiveFilterMentorId ? String(effectiveFilterMentorId) : null;

      const [vids, unlocks, homeResult, mentorVidsRaw] = await Promise.all([
        videoApi.getAllPublicVideos({ excludeMentorId: null }),
        userId ? videoApi.getLearnerUnlocks(userId) : Promise.resolve(new Map()),
        homeApi.getVideos().catch(() => ({ sessions: [] })),
        mentorFilterId ? videoApi.getMentorVideos(mentorFilterId).catch(() => []) : Promise.resolve([]),
      ]);

      // Normalize admin videos to match ShortCard's expected shape
      const adminVids = (homeResult.sessions || []).map(v => ({
        ...v,
        is_free: true,
        mentor_id: null,
        profiles: { name: 'Connectiqo', avatar_url: null },
        mentor_profiles: { unlock_price: 0, specialization: 'Featured' },
      }));

      let allVids = [...adminVids, ...vids];

      if (mentorFilterId && Array.isArray(mentorVidsRaw) && mentorVidsRaw.length > 0) {
        const template = allVids.find(v => v.mentor_id != null && String(v.mentor_id) === mentorFilterId);
        const mentorVidsEnriched = mentorVidsRaw.map(v => ({
          ...v,
          mentor_id: mentorFilterId,
          profiles: template?.profiles || { name: 'Mentor', avatar_url: null },
          mentor_profiles: template?.mentor_profiles || { specialization: '', unlock_price: 299 },
        }));
        const seen = new Set(allVids.map(v => String(v.id)));
        mentorVidsEnriched.forEach(v => {
          if (!seen.has(String(v.id))) {
            allVids.push(v);
            seen.add(String(v.id));
          }
        });
      }

      const filterId = mentorFilterId;

      setVideos(filterId
        ? [
          ...allVids.filter(v => v.mentor_id != null && String(v.mentor_id) === filterId),
          ...allVids.filter(v => v.mentor_id == null || String(v.mentor_id) !== filterId),
        ]
        : allVids);
      setUnlocksMap(unlocks);
    } catch (e) {
      Toast.show('Failed to load videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnlocked = useCallback((mentorId) => {
    setUnlocksMap(prev => {
      const next = new Map(prev);
      next.set(mentorId, { expiresAt: null });
      return next;
    });
  }, []);

  const handleViewProfile = useCallback((mentorId) => {
    navigation?.navigate(SCREEN_NAMES.MentorProfile, { mentorId });
  }, [navigation]);

  const onReelViewportLayout = useCallback((e) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setViewportHeight(h);
  }, []);

  return (
    <View style={s.root}>
      {loading ? (
        <View style={s.reelWrap} onLayout={onReelViewportLayout}>
          <VideosSkeleton />
        </View>
      ) : videos.length === 0 ? (
        <View style={[s.center, { paddingHorizontal: T.spacing.lg, paddingBottom: metadataBottomInset }]}>
          <View style={s.emptyPanel}>
            <View style={s.emptyIconRing}>
              <MaterialIcons name="videocam-off" size={40} color={PURPLE_LINK} />
            </View>
            <Text style={s.emptyTitle}>No videos here</Text>
            <Text style={s.emptySubtitle}>Mentors will post short videos here</Text>
          </View>
        </View>
      ) : reelPageHeight > 0 ? (
        <View style={s.reelWrap} onLayout={onReelViewportLayout}>
          <FlatList
            ref={flatListRef}
            style={s.reelList}
            data={videos}
            keyExtractor={v => v.id}
            pagingEnabled={Platform.OS === 'ios'}
            snapToInterval={reelPageHeight}
            snapToAlignment="start"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={1}
            removeClippedSubviews={Platform.OS === 'android'}
            onMomentumScrollEnd={e => syncActiveIndexFromOffset(e.nativeEvent.contentOffset.y)}
            onScrollEndDrag={e => syncActiveIndexFromOffset(e.nativeEvent.contentOffset.y)}
            onScrollToIndexFailed={({ index }) => scrollToVideoIndex(index)}
            renderItem={({ item, index }) => (
              <ShortCard
                item={item}
                height={reelPageHeight}
                isActive={index === activeIndex}
                isUnlocked={unlocksMap.has(item.mentor_id) || isOwnMentorVideo(item.mentor_id)}
                onLockPress={item => {
                  if (isOwnMentorVideo(item.mentor_id)) return;
                  setLockSheetVideo(item);
                }}
                onViewProfile={handleViewProfile}
                forcePaused={lockSheetVideo !== null}
                allowPlayback={allowPlayback}
              />
            )}
            viewabilityConfigCallbackPairs={viewabilityPairsRef.current}
            getItemLayout={(_, index) => ({
              length: reelPageHeight,
              offset: reelPageHeight * index,
              index,
            })}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFeed(true, user?.id)}
                tintColor={TEAL}
              />
            }
          />
        </View>
      ) : (
        <View style={s.reelWrap} onLayout={onReelViewportLayout} />
      )}

      <UnlockSheet
        video={lockSheetVideo}
        onClose={() => setLockSheetVideo(null)}
        onUnlocked={handleUnlocked}
      />
    </View>
  );
}

function createVideosStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.md,
    backgroundColor: C.primary.void,
  },
  emptyPanel: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: T.spacing.xxxl,
    paddingHorizontal: T.spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: softFill(theme),
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: softBorder(theme),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: T.spacing.lg,
  },
  emptyTitle: {
    color: C.text.primary,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: T.spacing.sm,
  },
  emptySubtitle: {
    color: C.text.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  reelWrap: {
    flex: 1,
  },
  reelList: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ── Short card internals ──────────────────────────────────────────────────
  reelGradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  tapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3,
  },
  bufferingWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
    paddingHorizontal: T.spacing.xl,
  },
  lockCard: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: T.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 80,
  },
  lockIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: softFill(theme),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.md,
  },
  lockTitle: {
    color: C.text.primary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: T.spacing.xs,
  },
  lockSub: {
    color: C.text.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: T.spacing.lg,
  },
  lockBtn: {
    width: '100%',
    marginVertical: 0,
  },

  pauseIcon: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  pauseBackdrop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseArrow: {
    marginLeft: 4,
  },

  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: REEL_PROGRESS_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 9,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },

  actionRail: {
    position: 'absolute',
    right: T.spacing.md,
    bottom: REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT + 4,
    alignItems: 'center',
    gap: 16,
    zIndex: 8,
    elevation: 8,
  },
  railBtn: {
    alignItems: 'center',
  },
  railAvatarFrame: {
    borderWidth: 2,
  },
  railAvatarFallback: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 8,
    elevation: 8,
    paddingHorizontal: T.spacing.md,
    paddingBottom: REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT,
    paddingTop: 0,
  },
  reelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  reelMentorTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '85%',
  },
  reelInlineAvatarFrame: {
    borderWidth: 1.5,
  },
  reelInlineAvatarFallback: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelMentorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelMentorSpec: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelVideoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelDescBlock: {
    marginTop: 2,
  },
  reelMoreBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 2,
    paddingRight: 8,
  },
  reelMoreBtnPressed: {
    opacity: 0.65,
  },
  reelVideoDesc: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelMoreText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.72,
  },
});
}

function createVideosSkeletonStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const B = C.buttons;
  const S = C.surface;
  const PURPLE_LINK = B.nebulaGradient[0];
  const GOLD = C.accent.primary;
  const TEAL = C.accent.secondary;
  const PANEL_BG = C.surface.panel;
  const INPUT_BG = C.surface.sheet;
  const SHEET_BG = C.surface.sheet;
  const GLASS_BORDER = C.border.light;
  const SCREEN_BG = C.primary.void;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bone: {
    backgroundColor: softFillStrong(theme),
    borderRadius: 8,
  },
  shimmerVideo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  shimmerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  shimmerRail: {
    position: 'absolute',
    right: T.spacing.md,
    bottom: REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT + 4,
    alignItems: 'center',
    gap: 14,
  },
  shimmerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  shimmerDock: {
    position: 'absolute',
    left: T.spacing.md,
    right: 100,
    bottom: 0,
    paddingBottom: REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT,
    gap: 6,
  },
  shimmerName: {
    width: 120,
    height: 14,
    borderRadius: 7,
  },
  shimmerTitle: {
    width: '80%',
    height: 16,
    borderRadius: 8,
  },
  shimmerDesc: {
    width: '60%',
    height: 12,
    borderRadius: 6,
  },
  shimmerProgress: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: REEL_PROGRESS_HEIGHT,
    borderRadius: 0,
  },
});
}
