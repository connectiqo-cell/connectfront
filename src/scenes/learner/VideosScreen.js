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
import { useAuth } from '../../hooks/useAuth';
import { isSameUserId } from '../../utils/mentorOwnership';
import ReportUserSheet from '../../components/ReportUserSheet';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { consumePendingLearnerVideo } from '../../navigators/pendingVideoNavigation';
import {
  CONTENT_VIDEO_AUDIO_PROPS,
  FEED_BUFFER_CONFIG,
  isAppForegroundForMedia,
} from '../../utils/videoPlayback';
const PAGE_SIZE = 20;
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

function ReelProfileRail({
  item,
  likeCount = 0,
  dislikeCount = 0,
  myReaction = null,
  onReact,
  onReport,
}) {
  const s = useThemedStyles(createVideosStyles);
  const liked = myReaction === 'like';
  const disliked = myReaction === 'dislike';

  return (
    <View style={s.actionRail}>
      <TouchableOpacity
        style={s.reactBtn}
        onPress={() => onReact?.(item.id, 'like')}
        activeOpacity={0.85}
        accessibilityLabel={liked ? 'Remove like' : 'Like'}
      >
        <View style={[s.reactIconWrap, liked && s.reactIconWrapLike]}>
          <MaterialIcons
            name={liked ? 'thumb-up' : 'thumb-up-off-alt'}
            size={22}
            color="#fff"
          />
        </View>
        <Text style={s.reactCount}>{likeCount}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.reactBtn}
        onPress={() => onReact?.(item.id, 'dislike')}
        activeOpacity={0.85}
        accessibilityLabel={disliked ? 'Remove dislike' : 'Dislike'}
      >
        <View style={[s.reactIconWrap, disliked && s.reactIconWrapDislike]}>
          <MaterialIcons
            name={disliked ? 'thumb-down' : 'thumb-down-off-alt'}
            size={22}
            color="#fff"
          />
        </View>
        <Text style={s.reactCount}>{dislikeCount}</Text>
      </TouchableOpacity>

      {onReport ? (
        <TouchableOpacity
          style={s.reactBtn}
          onPress={onReport}
          activeOpacity={0.85}
          accessibilityLabel="Report video"
        >
          <View style={s.reactIconWrap}>
            <MaterialIcons name="flag" size={22} color="#fff" />
          </View>
          <Text style={s.reactCount}>Report</Text>
        </TouchableOpacity>
      ) : null}
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
      pointerEvents="box-none"
      style={[
        s.infoDock,
        { right: REEL_RAIL_RESERVE },
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

// ─── Membership gate (no in-app purchase; no external checkout links) ─────────
// Store-safe reader pattern: honour website memberships, do not sell or steer
// users to buy outside the app from this sheet.
function UnlockSheet({ video, onClose, onRefreshAccess }) {
  const u = useThemedStyles(createUnlockStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const B = C.buttons;
  const PURPLE_LINK = B.nebulaGradient[0];
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const mentorName = video?.profiles?.name || 'this creator';

  const handleRefreshAccess = async () => {
    if (!user?.id || !video?.mentor_id) {
      onClose();
      return;
    }
    setRefreshing(true);
    try {
      const unlocked = await videoApi.checkUnlocked({
        mentorId: video.mentor_id,
        learnerId: user.id,
      });
      if (unlocked) {
        onRefreshAccess?.(video.mentor_id);
        Toast.show('Access updated. You can watch this library.', Toast.SHORT);
        onClose();
      } else {
        Toast.show('No active membership found for this account yet.', Toast.SHORT);
      }
    } catch {
      Toast.show('Could not refresh access. Try again later.', Toast.SHORT);
    } finally {
      setRefreshing(false);
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
        </View>

        <View style={u.divider} />

        <Text style={u.title}>Membership required</Text>
        <Text style={u.sub}>
          This video is included with an active Connectiqo membership for this creator. If you
          already have access, sign in with that account, then refresh below.
        </Text>

        <View style={u.perks}>
          {[
            'No purchase is available in the app',
            'Live 1:1 session booking remains available here',
          ].map(p => (
            <View key={p} style={u.perkRow}>
              <MaterialIcons name="check-circle" size={16} color={C.accent.success} />
              <Text style={u.perkText}>{p}</Text>
            </View>
          ))}
        </View>

        <CosmicButton
          label="Refresh access"
          variant="nebula"
          onPress={handleRefreshAccess}
          loading={refreshing}
          disabled={refreshing}
          style={u.payBtn}
        />

        <CosmicButton
          label="Got it"
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
  isPreload = false,
  height,
  isUnlocked,
  onLockPress,
  onViewProfile,
  forcePaused,
  allowPlayback,
  likeCount = 0,
  dislikeCount = 0,
  myReaction = null,
  onReact,
  onReport,
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
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const canPlay = item.is_free || isUnlocked;

  const effectivePaused = !allowPlayback || !isActive || paused || forcePaused;
  const showOverlays = canPlay && allowPlayback;
  const tapBottomReserve = REEL_DOCK_RESERVE + REEL_META_BOTTOM + REEL_PROGRESS_HEIGHT;

  // The card stays mounted while preloading, so rewind when it takes focus.
  useEffect(() => {
    if (isActive) videoRef.current?.seek(0);
  }, [isActive]);

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

  const railProps = {
    item,
    likeCount,
    dislikeCount,
    myReaction,
    onReact,
    onReport,
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

        {(isActive || isPreload) && canPlay && (item.hls_url || item.video_url) ? (
          <Video
            ref={videoRef}
            source={{ uri: item.hls_url || item.video_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={effectivePaused}
            repeat
            controls={false}
            bufferConfig={FEED_BUFFER_CONFIG}
            onLoad={data => {
              setDuration(data.duration || 0);
              setBuffering(false);
            }}
            onProgress={data => setProgress(data.currentTime || 0)}
            onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
            onLoadStart={() => setBuffering(true)}
            {...CONTENT_VIDEO_AUDIO_PROPS}
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
        <View style={s.lockOverlay} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.18, 0.55, 1]}
            style={s.reelGradient}
            pointerEvents="none"
          />
          <ReelInfoDock
            item={item}
            onViewProfile={onViewProfile}
          />
          <View style={s.lockCard} pointerEvents="box-none">
            <View style={s.lockIconWrap}>
              <MaterialIcons name="lock" size={28} color="#fff" />
            </View>
            <Text style={s.lockTitle}>Membership required</Text>
            <Text style={s.lockSub}>
              Sign in with an account that already has access to{' '}
              {item.profiles?.name || 'this creator'}'s library
            </Text>
            <CosmicButton
              label="Check access"
              variant="nebula"
              size="compact"
              onPress={() => onLockPress(item)}
              style={s.lockBtn}
            />
          </View>
          {/* Rail last so Report / reactions stay tappable above dock + lock card */}
          <ReelProfileRail {...railProps} />
        </View>
      )}

      {showOverlays && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.88)']}
            locations={[0, 0.18, 0.55, 1]}
            style={s.reelGradient}
            pointerEvents="none"
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

          {/* Rail last: must stay above info dock so flag/like taps are not stolen */}
          <ReelProfileRail {...railProps} />
        </View>
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
  const [reactionCounts, setReactionCounts] = useState(new Map());
  const [myReactions, setMyReactions] = useState(new Map());
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lockSheetVideo, setLockSheetVideo] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [feedPage, setFeedPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadingMoreRef = useRef(false);
  const loadSeqRef = useRef(0);

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
  const [appActive, setAppActive] = useState(
    isAppForegroundForMedia(AppState.currentState),
  );
  const allowPlayback = (isFocused || tabFocused) && appActive && lockSheetVideo === null;

  useEffect(() => {
    // undefined = param not passed (keep current); null/'' = caller cleared the mentor filter (Home).
    if (filterMentorId !== undefined) {
      setEffectiveFilterMentorId(filterMentorId ? String(filterMentorId) : null);
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
      setAppActive(isAppForegroundForMedia(state));
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
        minimumViewTime: 250,
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

  const prevStartVideoIdRef = useRef(startVideoId);
  useEffect(() => {
    // finishScroll clears startVideoId once the tapped video is on screen. Reloading on that
    // clear rebuilt the feed in default order and replaced the tapped video with the top one.
    const cleared = !!prevStartVideoIdRef.current && !startVideoId;
    prevStartVideoIdRef.current = startVideoId;
    if (cleared) return;
    loadFeed(false, user?.id);
  }, [user?.id, effectiveFilterMentorId, startVideoId]);

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

  const loadReactions = useCallback(async (videoIds, userId = user?.id) => {
    const ids = [...new Set((videoIds || []).map(id => String(id)).filter(Boolean))];
    if (!ids.length) return;
    try {
      const [counts, mine] = await Promise.all([
        videoApi.getVideoReactionCounts(ids).catch(() => new Map()),
        userId
          ? videoApi.getMyVideoReactions(String(userId), ids).catch(() => new Map())
          : Promise.resolve(new Map()),
      ]);
      setReactionCounts(prev => {
        const next = new Map(prev);
        counts.forEach((value, key) => next.set(String(key), value));
        return next;
      });
      setMyReactions(prev => {
        const next = new Map(prev);
        mine.forEach((value, key) => next.set(String(key), value));
        return next;
      });
    } catch (_) {
      // non-fatal — feed still works without counts
    }
  }, [user?.id]);

  const syncReactionForVideo = useCallback(async (videoId, userId = user?.id) => {
    const id = String(videoId);
    try {
      const [counts, mine] = await Promise.all([
        videoApi.getVideoReactionCounts([id]).catch(() => new Map()),
        userId
          ? videoApi.getMyVideoReactions(String(userId), [id]).catch(() => new Map())
          : Promise.resolve(new Map()),
      ]);
      setReactionCounts(prev => {
        const next = new Map(prev);
        const server = counts.get(id);
        if (server) next.set(id, server);
        return next;
      });
      setMyReactions(prev => {
        const next = new Map(prev);
        if (mine.has(id)) next.set(id, mine.get(id));
        else next.delete(id);
        return next;
      });
    } catch (_) {
      // ignore
    }
  }, [user?.id]);

  const loadFeed = async (isRefresh = false, userId = user?.id) => {
    // Overlapping loads (filter + deep link change together): only the latest may apply.
    const seq = ++loadSeqRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const mentorFilterId = effectiveFilterMentorId ? String(effectiveFilterMentorId) : null;
      const deepLinkId = startVideoId != null && startVideoId !== ''
        ? String(startVideoId)
        : (pendingScrollIdRef.current ? String(pendingScrollIdRef.current) : null);

      // Same algorithm as website /videos: mentor_videos only,
      // ordered is_promoted → promoted_at → created_at (server-side).
      const [vids, unlocks, mentorVidsRaw, deepLinkVideo] = await Promise.all([
        videoApi.getAllPublicVideos({ page: 0, pageSize: PAGE_SIZE }),
        userId ? videoApi.getLearnerUnlocks(userId) : Promise.resolve(new Map()),
        mentorFilterId ? videoApi.getMentorVideos(mentorFilterId).catch(() => []) : Promise.resolve([]),
        deepLinkId
          ? videoApi.getPublicVideoById(deepLinkId).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (seq !== loadSeqRef.current) return;

      let ordered = [...vids];

      if (deepLinkId) {
        const already = ordered.find(v => String(v.id) === deepLinkId);
        const target = already || deepLinkVideo;
        if (target) {
          ordered = [target, ...ordered.filter(v => String(v.id) !== String(target.id))];
        }
      }

      if (mentorFilterId && Array.isArray(mentorVidsRaw) && mentorVidsRaw.length > 0) {
        const template = ordered.find(v => v.mentor_id != null && String(v.mentor_id) === mentorFilterId);
        const mentorVidsEnriched = mentorVidsRaw.map(v => ({
          ...v,
          mentor_id: mentorFilterId,
          profiles: template?.profiles || { name: 'Creator', avatar_url: null },
          mentor_profiles: template?.mentor_profiles || { specialization: '', unlock_price: 299, category: null },
        }));
        const seen = new Set(ordered.map(v => String(v.id)));
        mentorVidsEnriched.forEach(v => {
          if (!seen.has(String(v.id))) {
            ordered.push(v);
            seen.add(String(v.id));
          }
        });
        ordered = [
          ...ordered.filter(v => v.mentor_id != null && String(v.mentor_id) === mentorFilterId),
          ...ordered.filter(v => v.mentor_id == null || String(v.mentor_id) !== mentorFilterId),
        ];
      }

      setVideos(ordered);
      setUnlocksMap(unlocks);
      setFeedPage(1);
      setHasMore(vids.length === PAGE_SIZE);
      setActiveIndex(0);
      setReactionCounts(new Map());
      setMyReactions(new Map());
      void loadReactions(ordered.map(v => v.id), userId);
    } catch (e) {
      if (seq === loadSeqRef.current) Toast.show('Failed to load videos');
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || loading || refreshing) return;
    if (effectiveFilterMentorId) return;
    loadingMoreRef.current = true;
    try {
      const rows = await videoApi.getAllPublicVideos({ page: feedPage, pageSize: PAGE_SIZE });
      let freshIds = [];
      setVideos(prev => {
        const seen = new Set(prev.map(v => String(v.id)));
        const fresh = rows.filter(v => !seen.has(String(v.id)));
        freshIds = fresh.map(v => v.id);
        return [...prev, ...fresh];
      });
      setFeedPage(p => p + 1);
      setHasMore(rows.length === PAGE_SIZE);
      if (freshIds.length) void loadReactions(freshIds);
    } catch (e) {
      // keep existing feed; user can pull to refresh
    } finally {
      loadingMoreRef.current = false;
    }
  }, [feedPage, hasMore, loading, refreshing, effectiveFilterMentorId, loadReactions]);

  const handleReact = useCallback((videoId, reaction) => {
    if (!user?.id) {
      Toast.show('Sign in to react');
      return;
    }

    const id = String(videoId);
    const current = myReactions.get(id) ?? null;
    const next = current === reaction ? null : reaction;

    setMyReactions(prev => {
      const copy = new Map(prev);
      if (next) copy.set(id, next);
      else copy.delete(id);
      return copy;
    });
    setReactionCounts(prev => {
      const copy = new Map(prev);
      const counts = copy.get(id) ?? { likeCount: 0, dislikeCount: 0 };
      const adjusted = { ...counts };
      if (current === 'like') adjusted.likeCount = Math.max(0, adjusted.likeCount - 1);
      if (current === 'dislike') adjusted.dislikeCount = Math.max(0, adjusted.dislikeCount - 1);
      if (next === 'like') adjusted.likeCount += 1;
      if (next === 'dislike') adjusted.dislikeCount += 1;
      copy.set(id, adjusted);
      return copy;
    });

    videoApi
      .setVideoReaction({ videoId: id, userId: user.id, reaction: next })
      .then(() => syncReactionForVideo(id, user.id))
      .catch(() => {
        setMyReactions(prev => {
          const copy = new Map(prev);
          if (current) copy.set(id, current);
          else copy.delete(id);
          return copy;
        });
        setReactionCounts(prev => {
          const copy = new Map(prev);
          const counts = copy.get(id) ?? { likeCount: 0, dislikeCount: 0 };
          const reverted = { ...counts };
          if (next === 'like') reverted.likeCount = Math.max(0, reverted.likeCount - 1);
          if (next === 'dislike') reverted.dislikeCount = Math.max(0, reverted.dislikeCount - 1);
          if (current === 'like') reverted.likeCount += 1;
          if (current === 'dislike') reverted.dislikeCount += 1;
          copy.set(id, reverted);
          return copy;
        });
        Toast.show('Could not save reaction');
      });
  }, [user?.id, myReactions, syncReactionForVideo]);

  const handleAccessGranted = useCallback((mentorId) => {
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
            <Text style={s.emptySubtitle}>Creators will post short videos here</Text>
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
            windowSize={5}
            maxToRenderPerBatch={3}
            initialNumToRender={1}
            removeClippedSubviews={false}
            onMomentumScrollEnd={e => syncActiveIndexFromOffset(e.nativeEvent.contentOffset.y)}
            onScrollEndDrag={e => syncActiveIndexFromOffset(e.nativeEvent.contentOffset.y)}
            onScrollToIndexFailed={({ index }) => scrollToVideoIndex(index)}
            renderItem={({ item, index }) => (
              <ShortCard
                item={item}
                height={reelPageHeight}
                isActive={index === activeIndex}
                isPreload={index === activeIndex + 1 || index === activeIndex + 2}
                isUnlocked={unlocksMap.has(item.mentor_id) || isOwnMentorVideo(item.mentor_id)}
                onLockPress={item => {
                  if (isOwnMentorVideo(item.mentor_id)) return;
                  setLockSheetVideo(item);
                }}
                onViewProfile={handleViewProfile}
                forcePaused={lockSheetVideo !== null || reportTarget !== null}
                allowPlayback={allowPlayback && reportTarget === null}
                likeCount={reactionCounts.get(String(item.id))?.likeCount ?? 0}
                dislikeCount={reactionCounts.get(String(item.id))?.dislikeCount ?? 0}
                myReaction={myReactions.get(String(item.id)) ?? null}
                onReact={handleReact}
                onReport={
                  !isOwnMentorVideo(item.mentor_id) && item.mentor_id && item.id
                    ? () =>
                        setReportTarget({
                          userId: item.mentor_id,
                          name: item.profiles?.name || 'Creator',
                          videoId: item.id,
                        })
                    : null
                }
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
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
          />
        </View>
      ) : (
        <View style={s.reelWrap} onLayout={onReelViewportLayout} />
      )}

      <UnlockSheet
        video={lockSheetVideo}
        onClose={() => setLockSheetVideo(null)}
        onRefreshAccess={handleAccessGranted}
      />
      <ReportUserSheet
        visible={!!reportTarget}
        reportedUserId={reportTarget?.userId}
        reportedUserName={reportTarget?.name || 'this user'}
        contextType="video"
        contextId={reportTarget?.videoId || null}
        onClose={() => setReportTarget(null)}
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
    zIndex: 12,
    elevation: 12,
  },
  railBtn: {
    alignItems: 'center',
  },
  reactBtn: {
    alignItems: 'center',
    gap: 2,
  },
  reactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactIconWrapLike: {
    backgroundColor: PURPLE_LINK,
  },
  reactIconWrapDislike: {
    backgroundColor: C.accent?.error || '#ef4444',
  },
  reactCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
