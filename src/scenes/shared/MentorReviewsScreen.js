import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Animated,
  Easing,
  RefreshControl,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { profileApi } from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const GOLD = C.accent.primary;
const TEAL = C.accent.secondary;
const PANEL_BG = 'rgba(22, 20, 50, 0.72)';
const INPUT_BG = '#0f0e2a';
const GLASS_BORDER = 'rgba(167,139,250,0.22)';

function firstRow(obj) {
  if (obj == null) return null;
  return Array.isArray(obj) ? obj[0] : obj;
}

function formatReviewDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildDistribution(reviews) {
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const n = Math.round(Number(r.rating) || 0);
    if (n >= 1 && n <= 5) counts[n - 1] += 1;
  });
  const total = reviews.length || 1;
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star - 1],
    pct: counts[star - 1] / total,
  }));
}

function GoldStarsRow({ rating, size = 14 }) {
  const filled = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <MaterialIcons
          key={i}
          name={i <= filled ? 'star' : 'star-border'}
          size={size}
          color={i <= filled ? GOLD : C.text.muted}
        />
      ))}
    </View>
  );
}

function FadeInBlock({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 85,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

function ReviewCard({ review, index }) {
  const learner = firstRow(review.profiles);
  const name = learner?.name || 'Learner';
  const avatar = learner?.avatar_url || null;
  const rating = Number(review.rating) || 0;
  const comment = (review.comment && String(review.comment).trim()) || null;
  const dateLabel = formatReviewDate(review.created_at);

  return (
    <FadeInBlock delay={120 + Math.min(index, 8) * 55} style={styles.cardWrap}>
      <View style={styles.reviewCard}>
        <View style={styles.cardTop}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.cardAvatar} />
          ) : (
            <View style={[styles.cardAvatar, styles.cardAvatarPh]}>
              <MaterialIcons name="person" size={20} color={PURPLE_LINK} />
            </View>
          )}
          <View style={styles.cardMeta}>
            <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
            {dateLabel ? <Text style={styles.cardDate}>{dateLabel}</Text> : null}
          </View>
          <View style={styles.cardRatingPill}>
            <MaterialIcons name="star" size={13} color={GOLD} />
            <Text style={styles.cardRatingTxt}>{rating.toFixed(1)}</Text>
          </View>
        </View>
        <GoldStarsRow rating={rating} size={13} />
        {comment ? (
          <Text style={styles.cardComment}>{comment}</Text>
        ) : (
          <Text style={styles.cardNoComment}>No written feedback</Text>
        )}
      </View>
    </FadeInBlock>
  );
}

function DistributionRow({ star, count, pct, maxCount }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: widthPct,
      duration: 520,
      delay: 80 + (5 - star) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [barAnim, star, widthPct]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.distRow}>
      <Text style={styles.distStar}>{star}</Text>
      <MaterialIcons name="star" size={11} color={GOLD} />
      <View style={styles.distTrack}>
        <Animated.View style={[styles.distFill, { width: barWidth }]} />
      </View>
      <Text style={styles.distCount}>{count}</Text>
    </View>
  );
}

export default function MentorReviewsScreen({ navigation, route }) {
  const { profile } = useAuth();
  const paramMentorId = route.params?.mentorId || profile?.id;
  const paramMentorName = route.params?.mentorName?.trim?.() || '';
  const isOwnReviews = Boolean(profile?.id && paramMentorId === profile.id);

  const [reviews, setReviews] = useState([]);
  const [mentorName, setMentorName] = useState(paramMentorName || 'Mentor');
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const distribution = useMemo(() => buildDistribution(reviews), [reviews]);
  const maxDistCount = useMemo(
    () => Math.max(...distribution.map((d) => d.count), 1),
    [distribution],
  );

  const loadReviews = useCallback(async (isRefresh = false) => {
    if (!paramMentorId) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [rows, mentorProfile, mentorProf] = await Promise.all([
        profileApi.getReviewsForMentor(paramMentorId).catch(() => []),
        profileApi.getMentorProfile(paramMentorId).catch(() => null),
        profileApi.getProfile(paramMentorId).catch(() => null),
      ]);
      setReviews(Array.isArray(rows) ? rows : []);
      setAvgRating(Number(mentorProfile?.rating) || 0);
      if (mentorProf?.name) setMentorName(mentorProf.name);
      else if (paramMentorName) setMentorName(paramMentorName);
    } catch {
      Toast.show('Could not load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paramMentorId, paramMentorName]);

  useEffect(() => {
    loadReviews(false);
  }, [loadReviews]);

  const renderHeader = () => (
    <>
      <FadeInBlock delay={0}>
        <LinearGradient
          colors={['rgba(124,58,237,0.2)', 'rgba(94,234,212,0.1)', 'rgba(22,20,50,0.55)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryTop}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryScore}>
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </Text>
              <GoldStarsRow rating={avgRating} size={16} />
              <Text style={styles.summaryCount}>
                {reviews.length} review{reviews.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.summaryIconWrap}>
              <MaterialIcons name="reviews" size={28} color={GOLD} />
            </View>
          </View>
          {reviews.length > 0 ? (
            <View style={styles.distBlock}>
              {distribution.map((d) => (
                <DistributionRow
                  key={d.star}
                  star={d.star}
                  count={d.count}
                  pct={d.pct}
                  maxCount={maxDistCount}
                />
              ))}
            </View>
          ) : null}
        </LinearGradient>
      </FadeInBlock>

      <FadeInBlock delay={60} style={styles.sectionHead}>
        <MaterialIcons name="forum" size={16} color={TEAL} />
        <Text style={styles.sectionTitle}>
          {isOwnReviews ? 'Feedback from learners' : `Reviews for ${mentorName}`}
        </Text>
      </FadeInBlock>
    </>
  );

  const renderEmpty = () => (
    !loading ? (
      <FadeInBlock delay={100} style={styles.emptyWrap}>
        <View style={styles.emptyRing}>
          <MaterialIcons name="rate-review" size={36} color={PURPLE_LINK} />
        </View>
        <Text style={styles.emptyTitle}>No reviews yet</Text>
        <Text style={styles.emptySub}>
          {isOwnReviews
            ? 'When learners rate their sessions, feedback will appear here.'
            : 'This mentor has not received any reviews yet.'}
        </Text>
      </FadeInBlock>
    ) : null
  );

  return (
    <SafeScreen scrollable={false} hasBottomTabs={false} padding={0}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Reviews</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.intro}>
          {isOwnReviews
            ? 'Feedback from learners on your sessions.'
            : `Reviews for ${mentorName}.`}
        </Text>

        <FlatList
          style={styles.list}
          data={reviews}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            reviews.length === 0 && !loading && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReviews(true)}
              tintColor={PURPLE_LINK}
              colors={[PURPLE_LINK]}
            />
          }
        />
      </View>

      <LoadingOverlay visible={loading && !refreshing} message="Loading reviews…" />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    backgroundColor: INPUT_BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
  },
  intro: {
    fontSize: 13,
    color: C.text.secondary,
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.sm,
    paddingBottom: T.spacing.xs,
    lineHeight: 19,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.xl,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
    marginBottom: T.spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: { gap: 6 },
  summaryScore: {
    fontSize: 40,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -1,
    lineHeight: 44,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text.muted,
    marginTop: 2,
  },
  summaryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(240,216,117,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distBlock: {
    marginTop: T.spacing.lg,
    gap: 8,
    paddingTop: T.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distStar: {
    width: 10,
    fontSize: 11,
    fontWeight: '700',
    color: C.text.secondary,
    textAlign: 'right',
  },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GOLD,
    minWidth: 4,
  },
  distCount: {
    width: 22,
    fontSize: 11,
    fontWeight: '700',
    color: C.text.muted,
    textAlign: 'right',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: T.spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
  },
  cardWrap: { marginBottom: T.spacing.sm },
  reviewCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.md,
    gap: T.spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
  },
  cardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cardAvatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flex: 1, minWidth: 0 },
  cardName: {
    fontSize: 14,
    fontWeight: '800',
    color: C.text.primary,
  },
  cardDate: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: C.text.muted,
  },
  cardRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(240,216,117,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.3)',
  },
  cardRatingTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: GOLD,
  },
  cardComment: {
    fontSize: 14,
    lineHeight: 21,
    color: C.text.secondary,
  },
  cardNoComment: {
    fontSize: 13,
    fontStyle: 'italic',
    color: C.text.muted,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxxl,
    paddingHorizontal: T.spacing.lg,
    gap: T.spacing.sm,
  },
  emptyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: T.spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
  },
  emptySub: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
