import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-simple-toast';
import { SafeScreen } from '../../components/SafeScreen';
import StackScreenHeader from '../../components/StackScreenHeader';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import CosmicButton from '../../components/CosmicButton';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { reviewsApi } from '../../api/reviewsApi';
import { bookingApi } from '../../api/bookingApi';
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

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const QUICK_TAGS = ['Clear explanations', 'Very helpful', 'Great listener', 'On time', 'Would recommend'];

function firstRow(obj) {
  if (obj == null) return null;
  return Array.isArray(obj) ? obj[0] : obj;
}

function formatSessionDate(booking) {
  const slot = firstRow(booking?.availability_slots);
  if (!slot?.date) return null;
  const parts = String(slot.date).split('-').map(Number);
  if (parts.length < 3) return slot.date;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SectionHeader({ icon, title, accent = PURPLE_LINK, accentBg = S.accentViolet }) {
  return (
    <View style={sec.row}>
      <View style={[sec.badge, { backgroundColor: accentBg }]}>
        <MaterialIcons name={icon} size={13} color={accent} />
      </View>
      <Text style={[sec.title, { color: accent }]}>{title}</Text>
      <View style={sec.line} />
    </View>
  );
}

const sec = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.spacing.sm,
    gap: T.spacing.sm,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: GLASS_BORDER,
  },
});

function FadeInBlock({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 82,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 88,
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

function PressableScale({
  children,
  onPress,
  style,
  disabled,
  scaleTo = 0.94,
  hitSlop,
  showGlow = false,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: scaleTo,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={style}
        hitSlop={hitSlop}
      >
        {showGlow ? (
          <Animated.View
            pointerEvents="none"
            style={[pressFx.glow, { opacity: glowOpacity }]}
          />
        ) : null}
        {children}
      </Pressable>
    </Animated.View>
  );
}

const pressFx = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: PURPLE_LINK,
  },
});

function ScreenHeader({ title, subtitle, onBack }) {
  return (
    <StackScreenHeader insetTop={STACK_OVERLAY_LAYOUT.headerInsetTop}>
    <View style={styles.screenHeader}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.8}>
        <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.headerBtnSpacer} />
    </View>
    </StackScreenHeader>
  );
}

function AvatarPulseRing({ children }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });

  return (
    <View style={avatarFx.wrap}>
      <Animated.View
        style={[avatarFx.halo, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      {children}
    </View>
  );
}

const avatarFx = StyleSheet.create({
  wrap: { position: 'relative' },
  halo: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: TEAL,
    top: -6,
    left: -6,
  },
});

function SubmittedBadge() {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <Animated.View style={[styles.submittedPill, { opacity, transform: [{ scale }] }]}>
      <MaterialIcons name="check-circle" size={14} color={C.accent.success} />
      <Text style={styles.submittedTxt}>Review submitted</Text>
    </Animated.View>
  );
}

function AnimatedQuickTag({ label, selected, onPress, delayIndex }) {
  return (
    <FadeInBlock delay={160 + delayIndex * 45} style={styles.quickTagWrap}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.92}
        showGlow={selected}
        style={[styles.quickTag, selected && styles.quickTagSelected]}
      >
        {selected ? (
          <MaterialIcons name="check" size={12} color={GOLD} style={styles.quickTagIcon} />
        ) : null}
        <Text style={[styles.quickTagTxt, selected && styles.quickTagTxtSelected]}>{label}</Text>
      </PressableScale>
    </FadeInBlock>
  );
}

function AnimatedInputShell({ focused, readOnly, children }) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused && !readOnly ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [focusAnim, focused, readOnly]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.08)', 'rgba(167,139,250,0.55)'],
  });
  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.inputGlow, { opacity: shadowOpacity }]}
      />
      {children}
    </Animated.View>
  );
}

function StarRatingPicker({ rating, onSelect, readOnly = false }) {
  const starScales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;
  const starPressScales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelScale = useRef(new Animated.Value(0.9)).current;
  const rowGlow = useRef(new Animated.Value(0)).current;
  const prevRating = useRef(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelOpacity, {
        toValue: rating > 0 ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(labelScale, {
        toValue: rating > 0 ? 1 : 0.9,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(rowGlow, {
        toValue: rating > 0 ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [labelOpacity, labelScale, rating, rowGlow]);

  useEffect(() => {
    if (readOnly || rating <= 0 || rating === prevRating.current) {
      prevRating.current = rating;
      return;
    }
    for (let i = 0; i < rating; i += 1) {
      const idx = i;
      Animated.sequence([
        Animated.delay(idx * 45),
        Animated.spring(starScales[idx], {
          toValue: 1.22,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(starScales[idx], {
          toValue: 1,
          friction: 5,
          tension: 130,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevRating.current = rating;
  }, [rating, readOnly, starScales]);

  const handleStarPress = (value) => {
    if (readOnly) return;
    onSelect(value);
  };

  const handleStarPressIn = (index) => {
    if (readOnly) return;
    Animated.spring(starPressScales[index], {
      toValue: 0.88,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleStarPressOut = (index) => {
    Animated.spring(starPressScales[index], {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const glowOpacity = rowGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={starStyles.wrap}>
      <Animated.View style={[starStyles.glowBg, { opacity: glowOpacity }]} pointerEvents="none" />
      <View style={starStyles.row}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= rating;
          const idx = i - 1;
          return (
            <Animated.View
              key={i}
              style={{
                transform: [
                  { scale: Animated.multiply(starScales[idx], starPressScales[idx]) },
                ],
              }}
            >
              <Pressable
                onPress={() => handleStarPress(i)}
                onPressIn={() => handleStarPressIn(idx)}
                onPressOut={() => handleStarPressOut(idx)}
                disabled={readOnly}
                style={starStyles.hit}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${i} star${i > 1 ? 's' : ''}`}
                accessibilityState={{ selected: filled }}
              >
                <MaterialIcons
                  name={filled ? 'star' : 'star-border'}
                  size={42}
                  color={filled ? GOLD : C.text.muted}
                />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <Animated.Text
        style={[
          starStyles.label,
          { opacity: labelOpacity, transform: [{ scale: labelScale }] },
        ]}
      >
        {RATING_LABELS[rating] || 'Tap a star to rate'}
      </Animated.Text>
    </View>
  );
}

const starStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: T.spacing.sm, position: 'relative' },
  glowBg: {
    position: 'absolute',
    top: 0,
    left: '8%',
    right: '8%',
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(240,216,117,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,216,117,0.2)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  hit: {
    padding: 6,
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.2,
    minHeight: 22,
  },
});

export default function ReviewScreen({ navigation, route }) {
  const bookingId = route.params?.bookingId;
  const paramMentorId = route.params?.mentorId;
  const paramMentorName = route.params?.mentorName?.trim?.() || '';
  const { profile } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mentorId, setMentorId] = useState(paramMentorId || null);
  const [mentorName, setMentorName] = useState(paramMentorName || 'Mentor');
  const [mentorAvatar, setMentorAvatar] = useState(null);
  const [sessionDate, setSessionDate] = useState(null);
  const [sessionTopic, setSessionTopic] = useState('');
  const [existingReview, setExistingReview] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);

  const loadContext = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [existing, booking] = await Promise.all([
        reviewsApi.getReviewForBooking(bookingId).catch(() => null),
        bookingApi.getBooking(bookingId).catch(() => null),
      ]);

      if (existing) {
        setExistingReview(existing);
        setRating(existing.rating || 0);
        setComment(existing.comment || '');
      }

      const resolvedMentorId = paramMentorId || booking?.mentor_id || null;
      setMentorId(resolvedMentorId);
      setSessionDate(formatSessionDate(booking));
      setSessionTopic((booking?.message && String(booking.message).trim()) || '1-on-1 session');

      if (resolvedMentorId) {
        const mentorProfile = await profileApi.getProfile(resolvedMentorId).catch(() => null);
        if (mentorProfile?.name) setMentorName(mentorProfile.name);
        else if (paramMentorName) setMentorName(paramMentorName);
        if (mentorProfile?.avatar_url) setMentorAvatar(mentorProfile.avatar_url);
      }
    } catch {
      Toast.show('Could not load session details');
    } finally {
      setLoading(false);
    }
  }, [bookingId, paramMentorId, paramMentorName]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const appendQuickTag = (tag) => {
    if (existingReview) return;
    setComment((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.includes(tag)) return prev;
      return `${trimmed} · ${tag}`;
    });
  };

  const handleSubmit = async () => {
    if (existingReview) {
      navigation.goBack();
      return;
    }
    if (!bookingId || !mentorId || !profile?.id) {
      Toast.show('Missing session information');
      return;
    }
    if (rating === 0) {
      Toast.show('Please select a star rating');
      return;
    }
    try {
      setSubmitting(true);
      await reviewsApi.submitReview({
        bookingId,
        mentorId,
        learnerId: profile.id,
        rating,
        comment: comment.trim(),
      });
      Toast.show('Thank you — your review was submitted!');
      navigation.goBack();
    } catch (err) {
      Toast.show(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = Boolean(existingReview);
  const canSubmit = !isReadOnly && rating > 0 && !submitting;

  if (!bookingId) {
    return (
      <SafeScreen scrollable={false} hasBottomTabs={false} padding={0} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
        <View style={styles.root}>
          <ScreenHeader title="Rate session" onBack={() => navigation.goBack()} />
          <View style={styles.centerFill}>
            <MaterialIcons name="error-outline" size={40} color={C.accent.error} />
            <Text style={styles.emptyTitle}>Session not found</Text>
            <Text style={styles.emptySub}>This review link is invalid or expired.</Text>
            <CosmicButton label="Go back" variant="secondary" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen scrollable={false} hasBottomTabs={false} padding={0} includeTopInset={STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title={isReadOnly ? 'Your review' : 'Rate session'}
          subtitle={
            isReadOnly
              ? 'Already submitted for this session'
              : 'Help others choose great mentors'
          }
          onBack={() => navigation.goBack()}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInBlock delay={60} style={styles.panelPad}>
            <LinearGradient
              colors={['rgba(124,58,237,0.18)', 'rgba(94,234,212,0.08)', 'rgba(22,20,50,0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mentorCard}
            >
              <View style={styles.mentorCardInner}>
                <AvatarPulseRing>
                  {mentorAvatar ? (
                    <Image source={{ uri: mentorAvatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPh]}>
                      <MaterialIcons name="person" size={28} color={PURPLE_LINK} />
                    </View>
                  )}
                </AvatarPulseRing>
                <View style={styles.mentorMeta}>
                  <Text style={styles.mentorLabel}>Session with</Text>
                  <Text style={styles.mentorName} numberOfLines={1}>{mentorName}</Text>
                  {sessionDate ? (
                    <View style={styles.sessionMetaRow}>
                      <MaterialIcons name="event" size={13} color={TEAL} />
                      <Text style={styles.sessionMetaTxt}>{sessionDate}</Text>
                    </View>
                  ) : null}
                  {sessionTopic ? (
                    <Text style={styles.sessionTopic} numberOfLines={2}>{sessionTopic}</Text>
                  ) : null}
                </View>
              </View>
              {isReadOnly ? <SubmittedBadge /> : null}
            </LinearGradient>
          </FadeInBlock>

          <FadeInBlock delay={120} style={styles.panelPad}>
            <View style={styles.glassPanel}>
              <SectionHeader icon="star" title="Your rating" accent={GOLD} accentBg="rgba(240,216,117,0.15)" />
              <StarRatingPicker
                rating={rating}
                onSelect={setRating}
                readOnly={isReadOnly}
              />
            </View>
          </FadeInBlock>

          <FadeInBlock delay={180} style={styles.panelPad}>
            <View style={styles.glassPanel}>
              <SectionHeader icon="rate-review" title="Written feedback" accent={TEAL} accentBg="rgba(94,234,212,0.12)" />
              <Text style={styles.fieldHint}>
                {isReadOnly
                  ? 'This is what you shared with the mentor.'
                  : 'Optional — describe what went well or what could improve.'}
              </Text>
              <AnimatedInputShell focused={inputFocused} readOnly={isReadOnly}>
                <TextInput
                  style={styles.input}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share your experience…"
                  placeholderTextColor={C.text.muted}
                  multiline
                  maxLength={300}
                  editable={!isReadOnly}
                  autoCorrect
                  spellCheck
                  autoCapitalize="sentences"
                  textAlignVertical="top"
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                />
                <Text style={styles.charCount}>{comment.length}/300</Text>
              </AnimatedInputShell>

              {!isReadOnly && (
                <View style={styles.quickTags}>
                  {QUICK_TAGS.map((tag, idx) => (
                    <AnimatedQuickTag
                      key={tag}
                      label={tag}
                      delayIndex={idx}
                      selected={comment.includes(tag)}
                      onPress={() => appendQuickTag(tag)}
                    />
                  ))}
                </View>
              )}
            </View>
          </FadeInBlock>

          <FadeInBlock delay={240} style={styles.panelPad}>
            <View style={styles.noteRow}>
              <MaterialIcons name="info-outline" size={16} color={C.text.muted} />
              <Text style={styles.noteTxt}>
                Reviews are shared publicly to help the community find quality mentors.
              </Text>
            </View>

            <CosmicButton
              label={isReadOnly ? 'Done' : submitting ? 'Submitting…' : 'Submit review'}
              variant={isReadOnly ? 'secondary' : 'nebula'}
              icon={isReadOnly ? 'check' : 'star'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={!isReadOnly && !canSubmit}
              pressScale
              style={styles.submitBtn}
            />
          </FadeInBlock>
        </ScrollView>
      </KeyboardAvoidingView>

      <LoadingOverlay visible={loading} message="Loading session…" />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.xl,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.md,
    paddingHorizontal: T.spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text.primary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: T.spacing.sm,
  },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.md,
    paddingVertical: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    backgroundColor: INPUT_BG,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: T.borderRadius.md,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnSpacer: { width: 40 },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: T.spacing.sm },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 17,
  },

  panelPad: { marginBottom: T.spacing.md },

  mentorCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    padding: T.spacing.lg,
  },
  mentorCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: INPUT_BG,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorMeta: { flex: 1, minWidth: 0 },
  mentorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  mentorName: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text.primary,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  sessionMetaTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: TEAL,
  },
  sessionTopic: {
    marginTop: 6,
    fontSize: 13,
    color: C.text.secondary,
    lineHeight: 18,
  },
  submittedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: T.spacing.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  submittedTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent.success,
  },

  glassPanel: {
    backgroundColor: PANEL_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: T.spacing.lg,
  },
  fieldHint: {
    fontSize: 13,
    color: C.text.muted,
    lineHeight: 19,
    marginBottom: T.spacing.md,
  },
  inputWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    padding: T.spacing.md,
    minHeight: 120,
    overflow: 'hidden',
  },
  inputGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  input: {
    color: C.text.primary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 88,
    padding: 0,
  },
  charCount: {
    fontSize: 11,
    color: C.text.muted,
    textAlign: 'right',
    marginTop: T.spacing.xs,
  },
  quickTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: T.spacing.md,
  },
  quickTagWrap: {},
  quickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  quickTagSelected: {
    backgroundColor: 'rgba(240,216,117,0.14)',
    borderColor: 'rgba(240,216,117,0.45)',
  },
  quickTagIcon: { marginRight: 4 },
  quickTagTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: PURPLE_LINK,
  },
  quickTagTxtSelected: {
    color: GOLD,
  },

  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: T.spacing.lg,
    paddingHorizontal: 2,
  },
  noteTxt: {
    flex: 1,
    fontSize: 12,
    color: C.text.muted,
    lineHeight: 17,
  },
  submitBtn: {
    marginBottom: T.spacing.sm,
  },
});
