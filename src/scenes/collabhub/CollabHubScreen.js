import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreen } from '../../components/SafeScreen';
import { getFloatingTabBarContentInset } from '../../components/CosmicBottomTabBar';
import StackScreenHeader from '../../components/StackScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { STACK_OVERLAY_LAYOUT } from '../../utils/platformLayout';
import { useTheme, useThemedStyles } from '../../hooks/useTheme';
import { softBorder, softFill, softFillStrong, cardFill } from '../../theme/surfaceStyles';
import { SCREEN_NAMES } from '../../navigators/screenNames';
import { useAuth } from '../../hooks/useAuth';
import { collabHubApi } from '../../api/collabHubApi';

const money = n => `₹${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const ALL = 'All';
const NEW_WITHIN_DAYS = 3;

/** "3 days left" reads faster than a date when you are deciding whether to bother. */
function deadlineLabel(iso) {
  if (!iso) return null;
  const days = moment(iso).endOf('day').diff(moment(), 'days');
  if (days < 0) return { text: 'Closed', urgent: true };
  if (days === 0) return { text: 'Last day', urgent: true };
  if (days === 1) return { text: '1 day left', urgent: true };
  return { text: `${days} days left`, urgent: days <= 3 };
}

const durationLabel = seconds => (seconds ? `1 video · ${seconds}s` : '1 video');

/** Where you stand on a campaign you already applied to. */
const APPLIED_CHIP = {
  pending: { label: 'Applied', tone: 'info' },
  shortlisted: { label: 'Shortlisted', tone: 'success' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Not selected', tone: 'muted' },
};

export default function CollabHubScreen({ navigation, route }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const C = theme.colors;

  // Same screen in two places: the bottom tab, and a stack push from
  // elsewhere. As a tab there is nothing to go back to, and the floating tab
  // bar has to be cleared from inside the ScrollView — padding on SafeScreen
  // is a strip the list can never scroll into. Same reasoning as Home.
  const isTab = route?.name === SCREEN_NAMES.CollabHubTab;
  const insets = useSafeAreaInsets();
  const tabBarInset = isTab ? getFloatingTabBarContentInset(insets) : 0;

  const [campaigns, setCampaigns] = useState([]);
  /** campaign id -> my application status, so a row can stop offering "Apply". */
  const [appliedBy, setAppliedBy] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);

  const load = useCallback(async () => {
    try {
      setError('');
      const [rows, mine] = await Promise.all([
        collabHubApi.getPublishedCampaigns(),
        user?.id ? collabHubApi.getMyApplications(user.id) : Promise.resolve([]),
      ]);
      setCampaigns(rows);
      setAppliedBy(
        Object.fromEntries(mine.map(a => [a.campaign_id, a.status])),
      );
    } catch (e) {
      setError(e?.message || 'Could not load campaigns');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Chips come from what brands actually posted, so an empty category is
  // never offered.
  const categories = useMemo(
    () => [ALL, ...new Set(campaigns.map(c => c.category).filter(Boolean))],
    [campaigns],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (category !== ALL && c.category !== category) return false;
      if (!q) return true;
      return [c.title, c.description, c.brand?.name, c.category]
        .filter(Boolean)
        .some(v => v.toLowerCase().includes(q));
    });
  }, [campaigns, query, category]);

  const chipColor = tone => ({
    success: C.accent.success,
    info: C.accent.info,
  }[tone] || C.text.muted);

  const openCampaign = id =>
    navigation.navigate(SCREEN_NAMES.CampaignDetail, { campaignId: id });

  return (
    <SafeScreen
      scrollable={false}
      padding={0}
      hasBottomTabs={false}
      includeTopInset={isTab ? false : STACK_OVERLAY_LAYOUT.safeScreenIncludeTopInset}
    >
      <StackScreenHeader insetTop={isTab ? true : STACK_OVERLAY_LAYOUT.headerInsetTop}>
        <View style={styles.header}>
          {isTab ? (
            <View style={styles.iconBtn} />
          ) : (
            <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={22} color={C.accent.primary} />
            </Pressable>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Collab Hub</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate(SCREEN_NAMES.MyCampaignApplications)}
            style={styles.iconBtn}
            accessibilityLabel="My applications"
          >
            <MaterialIcons name="assignment" size={21} color={C.accent.secondary} />
          </Pressable>
        </View>
      </StackScreenHeader>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: theme.spacing.lg + tabBarInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.accent.secondary}
          />
        }
      >
        <LinearGradient
          colors={C.buttons.premiumGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>Turn content{'\n'}into collabs</Text>
            <Text style={styles.bannerBody}>
              Pitch a brand, shoot the brief, get paid on approval.
            </Text>
            <Pressable
              style={styles.bannerBtn}
              onPress={() => navigation.navigate(SCREEN_NAMES.MyCampaignApplications)}
            >
              <MaterialIcons name="assignment" size={15} color={C.text.primary} />
              <Text style={styles.bannerBtnText}>My applications</Text>
              <MaterialIcons name="arrow-forward" size={15} color={C.text.primary} />
            </Pressable>
          </View>
          <MaterialIcons
            name="auto-awesome"
            size={86}
            color="rgba(255,255,255,0.18)"
            style={styles.bannerGlyph}
          />
        </LinearGradient>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search campaigns…"
        />

        {categories.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {categories.map((cat) => {
              const active = cat === category;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={C.accent.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <>
            <RowSkeleton styles={styles} />
            <RowSkeleton styles={styles} />
            <RowSkeleton styles={styles} />
          </>
        ) : visible.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="auto-awesome" size={26} color={C.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>
              {campaigns.length === 0 ? 'Nothing open right now' : 'No match'}
            </Text>
            <Text style={styles.emptyHint}>
              {campaigns.length === 0
                ? 'Pull down to refresh. New briefs show up here as brands post them.'
                : 'Try another category, or clear the search.'}
            </Text>
          </View>
        ) : (
          visible.map((c) => {
            const deadline = deadlineLabel(c.application_deadline);
            const applied = appliedBy[c.id];
            const chip = applied ? APPLIED_CHIP[applied] : null;
            // A button only where there is something to do: apply, or deliver
            // the video you were accepted for. "Applied" is a state, not an act.
            const cta = !applied
              ? 'Apply now'
              : ['shortlisted', 'accepted'].includes(applied)
                ? 'Submit your video'
                : null;
            const isNew = !applied && moment().diff(moment(c.created_at), 'days') <= NEW_WITHIN_DAYS;
            return (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => openCampaign(c.id)}
              >
                {c.cover_image_url ? (
                  <Image source={{ uri: c.cover_image_url }} style={styles.cover} resizeMode="cover" />
                ) : (
                  <LinearGradient
                    colors={C.buttons.premiumGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cover, styles.coverFallback]}
                  >
                    <MaterialIcons name="auto-awesome" size={28} color="rgba(255,255,255,0.5)" />
                  </LinearGradient>
                )}

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    {c.brand?.avatar_url ? (
                      <Image source={{ uri: c.brand.avatar_url }} style={styles.brandAvatar} />
                    ) : (
                      <View style={[styles.brandAvatar, styles.brandAvatarFallback]}>
                        <MaterialIcons name="business" size={11} color={C.text.muted} />
                      </View>
                    )}
                    <Text style={styles.brand} numberOfLines={1}>
                      {c.brand?.name || 'Brand'}
                    </Text>
                    {chip ? (
                      <View style={[styles.statusChip, { borderColor: chipColor(chip.tone) }]}>
                        <Text style={[styles.statusChipText, { color: chipColor(chip.tone) }]}>
                          {chip.label}
                        </Text>
                      </View>
                    ) : isNew ? (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.title} numberOfLines={2}>{c.title}</Text>

                  <Text style={styles.metaLine} numberOfLines={1}>
                    <Text style={styles.price}>{money(c.budget_per_winner)}</Text>
                    <Text style={styles.meta}>
                      {'  \u00b7  '}{durationLabel(c.video_duration_seconds)}{'  \u00b7  '}
                      {c.winner_count || 1} {c.winner_count === 1 ? 'winner' : 'winners'}
                    </Text>
                  </Text>

                  <View style={styles.tagRow}>
                    {c.category ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText} numberOfLines={1}>{c.category}</Text>
                      </View>
                    ) : null}
                    {deadline ? (
                      <View style={styles.deadlineRow}>
                        <MaterialIcons
                          name="schedule"
                          size={12}
                          color={deadline.urgent ? C.accent.warning : C.text.muted}
                        />
                        <Text style={[styles.deadline, deadline.urgent && styles.deadlineUrgent]}>
                          {deadline.text}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {cta ? (
                  <View style={styles.ctaBtn}>
                    <Text style={styles.ctaText}>{cta}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeScreen>
  );
}

function RowSkeleton({ styles }) {
  return (
    <View style={styles.row}>
      <View style={[styles.cover, styles.skel]} />
      <View style={styles.rowBody}>
        <View style={[styles.skelLine, styles.skel, { width: '40%' }]} />
        <View style={[styles.skelLine, styles.skel, { width: '85%', height: 13 }]} />
        <View style={[styles.skelLine, styles.skel, { width: '55%' }]} />
      </View>
    </View>
  );
}

const makeStyles = (theme) => {
  const C = theme.colors;
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { color: C.text.primary, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
    iconBtn: { padding: 8, minWidth: 38 },
    content: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm + 2 },

    banner: {
      borderRadius: 20,
      padding: theme.spacing.lg,
      overflow: 'hidden',
      justifyContent: 'center',
      minHeight: 150,
    },
    bannerTextWrap: { gap: 8, maxWidth: '78%' },
    bannerTitle: { color: '#fff', fontSize: 23, fontWeight: '900', lineHeight: 29 },
    bannerBody: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, lineHeight: 17 },
    bannerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginTop: 4,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: '#fff',
    },
    bannerBtnText: { color: C.text.primary, fontSize: 12.5, fontWeight: '800' },
    bannerGlyph: { position: 'absolute', right: -10, bottom: -14 },

    chipScroll: { gap: 7, paddingRight: theme.spacing.lg },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 15,
      paddingVertical: 8,
      backgroundColor: softFill(theme),
      borderWidth: 1,
      borderColor: softBorder(theme),
    },
    filterChipActive: { backgroundColor: C.component.button, borderColor: C.component.button },
    filterChipText: { color: C.text.secondary, fontSize: 12, fontWeight: '700' },
    filterChipTextActive: { color: '#fff' },

    row: {
      gap: theme.spacing.sm + 2,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: softBorder(theme),
      backgroundColor: cardFill(theme),
      padding: theme.spacing.md,
    },
    rowPressed: { opacity: 0.85 },

    // Covers are wide brand banners; a square crop ate them. Full-width 16:9.
    cover: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      backgroundColor: softFillStrong(theme),
    },
    coverFallback: { alignItems: 'center', justifyContent: 'center' },

    rowBody: { flex: 1, gap: 5 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    brandAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: softFill(theme) },
    brandAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
    brand: { flex: 1, color: C.text.primary, fontSize: 12, fontWeight: '800' },
    newBadge: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: softFill(theme),
    },
    newBadgeText: { color: C.accent.secondary, fontSize: 9.5, fontWeight: '800' },
    statusChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    statusChipText: { fontSize: 9.5, fontWeight: '800' },

    title: { color: C.text.primary, fontSize: 15, fontWeight: '700', lineHeight: 20 },
    metaLine: { marginTop: 1 },
    price: { color: C.accent.primary, fontSize: 14.5, fontWeight: '900' },
    meta: { color: C.text.secondary, fontSize: 11.5 },

    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    tag: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      backgroundColor: softFill(theme),
      maxWidth: '62%',
    },
    tagText: { color: C.text.secondary, fontSize: 10, fontWeight: '700' },
    deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    deadline: { color: C.text.muted, fontSize: 10.5, fontWeight: '700' },
    deadlineUrgent: { color: C.accent.warning },

    ctaBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: C.component.button,
    },
    ctaText: { color: '#fff', fontSize: 13, fontWeight: '800' },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 12,
      padding: theme.spacing.md,
      backgroundColor: softFill(theme),
    },
    errorText: { color: C.accent.error, fontSize: 12, flex: 1 },

    emptyBox: { alignItems: 'center', gap: 8, paddingVertical: theme.spacing.xl },
    emptyIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(theme),
    },
    emptyTitle: { color: C.text.primary, fontSize: 14, fontWeight: '700' },
    emptyHint: {
      color: C.text.muted,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: theme.spacing.lg,
    },

    skel: { backgroundColor: softFillStrong(theme) },
    skelLine: { height: 11, borderRadius: 6 },
  });
};
