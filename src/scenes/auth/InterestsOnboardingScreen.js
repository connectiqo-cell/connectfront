import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong } from '../../theme/surfaceStyles';
import { fetchActiveCategories } from '../../api/contentApi';
import { MENTOR_CATEGORIES } from '../../constants/mentorCategories';
import { getCategoryInterestMeta } from '../../constants/categoryInterestMeta';
import { profileApi } from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';
import {
  MAX_LEARNER_INTERESTS,
  MIN_LEARNER_INTERESTS,
  toggleMentorCategory,
} from '../../utils/mentorCategories';

const GRID_GAP = 10;
const COLS = 3;

function ProgressDots({ activeIndex = 0, total = 3 }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const purple = theme.colors.buttons.nebulaGradient[0];
  const teal = theme.colors.accent.secondary;

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === activeIndex;
        if (active) {
          return (
            <LinearGradient
              key={i}
              colors={[purple, teal]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.progressPill}
            />
          );
        }
        return <View key={i} style={styles.progressDot} />;
      })}
    </View>
  );
}

function SelectionDots({ count, max }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const purple = theme.colors.buttons.nebulaGradient[0];
  const teal = theme.colors.accent.secondary;

  return (
    <View style={styles.selectionDots}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < count;
        if (filled) {
          return (
            <LinearGradient
              key={i}
              colors={[purple, teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.selectionDotFilled}
            />
          );
        }
        return <View key={i} style={styles.selectionDotEmpty} />;
      })}
    </View>
  );
}

function CategoryCard({ category, icon, description, selected, onPress, width }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const purple = C.buttons.nebulaGradient[0];
  const teal = C.accent.secondary;

  const inner = (
    <View style={[styles.cardInner, selected && styles.cardInnerSelected]}>
      <View style={[styles.addBadge, selected && styles.addBadgeSelected]}>
        <MaterialIcons
          name={selected ? 'check' : 'add'}
          size={14}
          color={selected ? '#fff' : C.text.muted}
        />
      </View>

      <LinearGradient
        colors={
          selected
            ? [purple, teal]
            : ['rgba(167,139,250,0.55)', 'rgba(94,234,212,0.45)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconWell}
      >
        <View style={styles.iconWellInner}>
          <MaterialIcons
            name={icon || 'category'}
            size={26}
            color={selected ? purple : teal}
          />
        </View>
      </LinearGradient>

      <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]} numberOfLines={2}>
        {category}
      </Text>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {description}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={[styles.cardPress, { width }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${category}${selected ? ', selected' : ''}`}
    >
      {selected ? (
        <LinearGradient
          colors={[purple, teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardBorder}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={styles.cardBorderIdle}>{inner}</View>
      )}
    </Pressable>
  );
}

/**
 * First-run screen: learner picks exactly 5 interested categories.
 * @param {{ onComplete?: () => void }} props
 */
export default function InterestsOnboardingScreen({ onComplete }) {
  const styles = useThemedStyles(createThemedStyles);
  const { theme } = useTheme();
  const C = theme.colors;
  const purple = C.buttons.nebulaGradient[0];
  const teal = C.accent.secondary;
  const { user } = useAuth();
  const { width: winW } = useWindowDimensions();

  const [categories, setCategories] = useState(
    MENTOR_CATEGORIES.map(name => ({ name, icon: null })),
  );
  const [selected, setSelected] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const cardWidth = useMemo(() => {
    const sidePad = theme.spacing.lg * 2;
    return Math.floor((winW - sidePad - GRID_GAP * (COLS - 1)) / COLS);
  }, [theme.spacing.lg, winW]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchActiveCategories();
        if (cancelled) return;
        if (rows?.length) {
          setCategories(
            rows.map(r => ({
              name: r.name,
              icon: r.icon || null,
            })),
          );
        }
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = selected.length;
  const canContinue = count === MAX_LEARNER_INTERESTS;

  const handleToggle = category => {
    setSelected(prev => {
      const next = toggleMentorCategory(prev, category);
      const alreadySelected = prev.some(
        c => c.toLowerCase() === String(category).trim().toLowerCase(),
      );
      if (!alreadySelected && next.length > MAX_LEARNER_INTERESTS) {
        Toast.show(`Select ${MAX_LEARNER_INTERESTS} categories`);
        return prev;
      }
      return next;
    });
  };

  const handleContinue = async () => {
    if (!canContinue || !user?.id) return;
    setSaving(true);
    try {
      const existing = await profileApi.getLearnerProfile(user.id).catch(() => null);
      await profileApi.updateLearnerProfile({
        userId: user.id,
        bio: existing?.bio || '',
        interests: selected,
      });
      Toast.show('Interests saved');
      onComplete?.();
    } catch (error) {
      Toast.show(error?.message || 'Could not save interests');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CosmicBackground style={styles.background}>
      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.topPad}>
          <ProgressDots activeIndex={0} total={3} />

          <Text style={styles.title}>
            Choose{' '}
            <Text style={styles.titleAccent}>{MIN_LEARNER_INTERESTS} categories</Text>
          </Text>
          <Text style={styles.subtitle}>
            Select {MIN_LEARNER_INTERESTS} categories you're most interested in mentors.
          </Text>
        </View>

        {loadingCategories ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={purple} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {categories.map(item => {
                const meta = getCategoryInterestMeta(item.name, item.icon);
                const isSelected = selected.some(
                  c => c.toLowerCase() === item.name.toLowerCase(),
                );
                return (
                  <CategoryCard
                    key={item.name}
                    category={item.name}
                    icon={meta.icon}
                    description={meta.description}
                    selected={isSelected}
                    onPress={() => handleToggle(item.name)}
                    width={cardWidth}
                  />
                );
              })}
            </View>
          </ScrollView>
        )}

        <View style={styles.footerDock}>
          <View style={styles.footerMeta}>
            <Text style={styles.footerCount}>
              {count} / {MAX_LEARNER_INTERESTS} selected
            </Text>
            <SelectionDots count={count} max={MAX_LEARNER_INTERESTS} />
          </View>

          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || saving}
            style={({ pressed }) => [
              styles.continuePress,
              (!canContinue || saving) && styles.continueDisabled,
              pressed && canContinue && !saving && styles.continuePressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <LinearGradient
              colors={
                canContinue && !saving
                  ? [purple, teal]
                  : ['rgba(120,120,140,0.45)', 'rgba(100,100,120,0.4)']
              }
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueLabel}>
                {saving ? 'Saving…' : 'Continue'}
              </Text>
              {!saving ? (
                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              ) : null}
            </LinearGradient>
          </Pressable>

          <Text style={styles.footerHint}>You can change this later</Text>
        </View>
      </SafeAreaView>
      <LoadingOverlay visible={saving} />
    </CosmicBackground>
  );
}

function createThemedStyles(theme) {
  const T = theme;
  const C = theme.colors;
  const isLight = theme.mode === 'light';

  return StyleSheet.create({
    background: { flex: 1 },
    overlay: { flex: 1 },
    topPad: {
      paddingHorizontal: T.spacing.lg,
      paddingTop: T.spacing.sm,
      marginBottom: T.spacing.md,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: T.spacing.lg,
    },
    progressPill: {
      width: 28,
      height: 6,
      borderRadius: 3,
    },
    progressDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isLight ? 'rgba(109,74,255,0.22)' : 'rgba(255,255,255,0.22)',
    },
    title: {
      ...T.typography.headingLg,
      color: C.text.primary,
      fontWeight: '800',
      marginBottom: T.spacing.sm,
      letterSpacing: -0.4,
    },
    titleAccent: {
      color: C.buttons.nebulaGradient[0],
      fontWeight: '800',
    },
    subtitle: {
      ...T.typography.bodyMd,
      color: C.text.muted,
      lineHeight: 21,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: T.spacing.lg,
      paddingBottom: T.spacing.lg,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    cardPress: {
      marginBottom: 2,
    },
    cardBorder: {
      borderRadius: 18,
      padding: 1.5,
    },
    cardBorderIdle: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: softBorder(theme),
      overflow: 'hidden',
    },
    cardInner: {
      borderRadius: 16.5,
      backgroundColor: isLight ? C.surface.sheet : softFill(theme),
      paddingTop: T.spacing.md,
      paddingBottom: T.spacing.sm,
      paddingHorizontal: T.spacing.sm,
      minHeight: 148,
      alignItems: 'center',
      overflow: 'hidden',
    },
    cardInnerSelected: {
      backgroundColor: isLight ? C.surface.sheet : softFillStrong(theme),
    },
    addBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isLight ? 'rgba(109,74,255,0.08)' : 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: softBorder(theme),
      zIndex: 2,
    },
    addBadgeSelected: {
      backgroundColor: C.buttons.nebulaGradient[0],
      borderColor: C.buttons.nebulaGradient[0],
    },
    iconWell: {
      width: 52,
      height: 52,
      borderRadius: 16,
      padding: 1.5,
      marginBottom: T.spacing.sm,
      marginTop: 4,
    },
    iconWellInner: {
      flex: 1,
      borderRadius: 14.5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isLight ? '#ffffff' : C.surface.sheet,
    },
    cardTitle: {
      ...T.typography.labelMd,
      fontWeight: '800',
      color: C.text.primary,
      textAlign: 'center',
      marginBottom: 3,
      paddingHorizontal: 2,
    },
    cardTitleSelected: {
      color: C.buttons.nebulaGradient[0],
    },
    cardDesc: {
      ...T.typography.bodyXs,
      color: C.text.muted,
      textAlign: 'center',
      lineHeight: 14,
      paddingHorizontal: 2,
    },
    footerDock: {
      paddingHorizontal: T.spacing.lg,
      paddingTop: T.spacing.md,
      paddingBottom: T.spacing.lg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: isLight ? C.surface.sheet : 'rgba(18,16,40,0.92)',
      borderTopWidth: 1,
      borderColor: softBorder(theme),
    },
    footerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: T.spacing.md,
    },
    footerCount: {
      ...T.typography.labelMd,
      color: C.text.secondary,
      fontWeight: '700',
    },
    selectionDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    selectionDotFilled: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    selectionDotEmpty: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: isLight ? 'rgba(109,74,255,0.3)' : 'rgba(255,255,255,0.28)',
    },
    continuePress: {
      borderRadius: 999,
      overflow: 'hidden',
    },
    continuePressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    continueDisabled: {
      opacity: 0.72,
    },
    continueBtn: {
      minHeight: 52,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: T.spacing.xl,
    },
    continueLabel: {
      ...T.typography.labelLg,
      color: '#ffffff',
      fontWeight: '800',
    },
    footerHint: {
      ...T.typography.bodySm,
      color: C.text.muted,
      textAlign: 'center',
      marginTop: T.spacing.sm,
    },
  });
}
