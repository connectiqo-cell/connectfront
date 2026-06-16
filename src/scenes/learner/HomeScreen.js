import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-simple-toast';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeScreen } from '../../components/SafeScreen';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { SearchBar } from '../../components/SearchBar';
import { MentorImageCard } from '../../components/MentorImageCard';
import { MentorDetailSheet } from '../../components/MentorDetailSheet';
import { mentorApi } from '../../api/mentorApi';
import { fetchActiveCategories } from '../../api/contentApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;

const CATEGORY_ICONS_FALLBACK = {
  technology:   'computer',
  programming:  'code',
  software:     'code',
  design:       'palette',
  business:     'business-center',
  marketing:    'campaign',
  finance:      'account-balance',
  data:         'bar-chart',
  science:      'biotech',
  language:     'translate',
  music:        'music-note',
  art:          'brush',
  photography:  'camera-alt',
  fitness:      'fitness-center',
  health:       'favorite',
  law:          'gavel',
  legal:        'gavel',
  education:    'school',
  leadership:   'groups',
  writing:      'edit-note',
  career:       'work',
  cloud:        'cloud',
  security:     'security',
  sales:        'point-of-sale',
  others:       'auto-awesome',
};

function normalizeMaterialIcon(icon = '') {
  // MaterialIcons expects lowercase with hyphens: "account_balance" → "account-balance"
  return icon.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
}

function getCategoryIcon(category = '', dbIconMap = {}) {
  const name = category.toLowerCase().trim();
  if (dbIconMap[name]) return normalizeMaterialIcon(dbIconMap[name]);
  for (const [k, v] of Object.entries(CATEGORY_ICONS_FALLBACK)) {
    if (name.includes(k)) return v;
  }
  return 'auto-awesome';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonBone({ style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  return <Animated.View style={[sk.bone, style, { opacity }]} />;
}

function SkeletonImageCard() {
  return <SkeletonBone style={sk.imageCard} />;
}

function SkeletonCategoryRow() {
  return (
    <View style={sk.section}>
      <View style={sk.headerRow}>
        <View style={sk.headerLeft}>
          <SkeletonBone style={sk.iconBox} />
          <SkeletonBone style={sk.sectionTitle} />
        </View>
        <SkeletonBone style={sk.seeAll} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sk.row}>
        {[0, 1, 2, 3].map(i => <SkeletonImageCard key={i} />)}
      </ScrollView>
    </View>
  );
}

function HomeScreenSkeleton() {
  return (
    <>
      <SkeletonCategoryRow />
      <SkeletonCategoryRow />
    </>
  );
}

const sk = StyleSheet.create({
  bone: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: T.borderRadius.lg },
  imageCard: {
    width: 120,
    height: 172,
    borderRadius: 16,
  },
  section: { marginBottom: T.spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.sm, flex: 1 },
  iconBox: { width: 26, height: 26, borderRadius: 8 },
  sectionTitle: { height: 14, width: 110, borderRadius: T.borderRadius.sm },
  seeAll: { height: 14, width: 56, borderRadius: T.borderRadius.sm },
  row: { gap: 10, paddingBottom: T.spacing.sm },
});

function SectionHeader({ title, icon, onSeeAll }) {
  const scale = useRef(new Animated.Value(1)).current;
  const chevronX = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.94,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(chevronX, {
        toValue: 4,
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
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(chevronX, {
        toValue: 0,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.secHdrRow}>
      <View style={styles.secHdrLeft}>
        {icon ? (
          <View style={styles.categoryIconBox}>
            <MaterialIcons name={icon} size={14} color={PURPLE_LINK} />
          </View>
        ) : null}
        <Text style={styles.secHdrTitle} numberOfLines={1}>{title}</Text>
      </View>
      {onSeeAll ? (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            style={styles.seeAllBtn}
            onPress={onSeeAll}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.seeAllTxt}>See all</Text>
            <Animated.View style={{ transform: [{ translateX: chevronX }] }}>
              <MaterialIcons name="chevron-right" size={18} color={PURPLE_LINK} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

function AnimatedPageHeader({ isSearching }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.pageHeader, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.pageTitle}>
        {isSearching ? 'Search results' : 'Discover'}
      </Text>
      <Text style={styles.pageSubtitle}>
        {isSearching
          ? 'Mentors matching your search'
          : 'Browse mentors by skill and category'}
      </Text>
    </Animated.View>
  );
}

function AnimatedCategorySection({ sectionIndex, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const delay = sectionIndex * 70;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
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
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[styles.section, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export default function LearnerHomeScreen({ navigation }) {
  const { profile } = useAuth();
  const [mentorsByCategory, setMentorsByCategory] = useState({});
  const [categoryIconMap, setCategoryIconMap] = useState({});
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const searchDebounce = useRef(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearchQuery('');
        setSearchResults(null);
        setSearchLoading(false);
        if (searchDebounce.current) {
          clearTimeout(searchDebounce.current);
          searchDebounce.current = null;
        }
      };
    }, []),
  );

  useEffect(() => {
    loadMentors();
  }, []);

  const loadMentors = async () => {
    try {
      setLoading(true);
      const [grouped, dbCategories] = await Promise.all([
        mentorApi.getMentorsByCategory(),
        fetchActiveCategories(),
      ]);
      const iconMap = {};
      (dbCategories || []).forEach(c => {
        if (c.name && c.icon) iconMap[c.name.toLowerCase().trim()] = c.icon;
      });
      setCategoryIconMap(iconMap);
      const filtered = {};
      Object.entries(grouped).forEach(([category, mentors]) => {
        const withoutSelf = mentors.filter(m => m.id !== profile?.id);
        if (withoutSelf.length > 0) filtered[category] = withoutSelf;
      });
      setMentorsByCategory(filtered);
    } catch {
      Toast.show('Failed to load mentors');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMentors();
    setRefreshing(false);
  };

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (!text.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await mentorApi.searchMentors(text.replace(/^@/, ''));
        const withoutSelf = results.filter(m => m.id !== profile?.id);
        setSearchResults(withoutSelf);
      } catch {
        Toast.show('Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, [profile?.id]);

  const getFilteredMentors = () => {
    if (searchResults !== null) return null; // using flat search results instead
    return mentorsByCategory;
  };

  const handleBookMentor = mentor => {
    navigation.navigate('Booking_Screen', {
      mentorId: mentor.id,
      mentorName: mentor.profiles?.name || 'Mentor',
    });
  };

  const handleViewProfile = mentor => {
    navigation.navigate(SCREEN_NAMES.MentorProfile, { mentorId: mentor.id });
  };

  const isSearching = searchQuery.trim().length > 0;
  const groupedMentors = getFilteredMentors();
  const filteredCategories = groupedMentors ? Object.keys(groupedMentors).sort() : [];

  const renderCategorySection = (category, mentors, isSearch = false, sectionIndex = 0) => (
    <AnimatedCategorySection
      key={isSearch ? `search-${searchQuery.trim()}` : category}
      sectionIndex={sectionIndex}
    >
      <SectionHeader
        title={isSearch ? 'Results' : category}
        icon={isSearch ? 'search' : getCategoryIcon(category, categoryIconMap)}
        onSeeAll={
          isSearch
            ? null
            : () => navigation.navigate(SCREEN_NAMES.CategoryMentors, { category })
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mentorsRow}
      >
        {mentors.map((mentor, cardIndex) => (
          <MentorImageCard
            key={mentor.id}
            mentor={mentor}
            onPress={setSelectedMentor}
            entranceDelay={sectionIndex * 70 + cardIndex * 55}
          />
        ))}
      </ScrollView>
    </AnimatedCategorySection>
  );

  return (
    <SafeScreen
      scrollable={true}
      padding={T.spacing.lg}
      hasBottomTabs={false}
      includeTopInset={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TEAL}
        />
      }
    >
      <AnimatedPageHeader isSearching={isSearching} />

      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder="Search by name, @username or skill"
        containerStyle={styles.searchBar}
      />

      {loading ? (
        <HomeScreenSkeleton />
      ) : isSearching ? (
        searchLoading ? (
          <HomeScreenSkeleton />
        ) : searchResults && searchResults.length > 0 ? (
          <View style={styles.content}>
            {renderCategorySection('Search Results', searchResults, true, 0)}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <View style={styles.emptyIconRing}>
              <MaterialIcons name="travel-explore" size={40} color={PURPLE_LINK} />
            </View>
            <Text style={styles.emptyTitle}>No mentors found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different keyword or clear the search to browse all categories.
            </Text>
          </View>
        )
      ) : filteredCategories.length > 0 ? (
        <View style={styles.content}>
          {filteredCategories.map((category, index) =>
            renderCategorySection(category, groupedMentors[category], false, index),
          )}
        </View>
      ) : (
        <View style={styles.emptyPanel}>
          <View style={styles.emptyIconRing}>
            <MaterialIcons name="travel-explore" size={40} color={PURPLE_LINK} />
          </View>
          <Text style={styles.emptyTitle}>No mentors available</Text>
          <Text style={styles.emptySubtitle}>
            Pull down to refresh or check back later.
          </Text>
        </View>
      )}

      <MentorDetailSheet
        mentor={selectedMentor}
        visible={selectedMentor !== null}
        onClose={() => setSelectedMentor(null)}
        onBook={mentor => {
          setSelectedMentor(null);
          handleBookMentor(mentor);
        }}
        onViewProfile={mentor => {
          setSelectedMentor(null);
          handleViewProfile(mentor);
        }}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginBottom: T.spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: C.text.muted,
    fontWeight: '600',
    lineHeight: 18,
  },
  searchBar: {
    marginBottom: T.spacing.lg,
  },

  content: {
    paddingBottom: T.spacing.xxxl,
  },
  section: {
    marginBottom: T.spacing.xl,
  },
  secHdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: T.spacing.sm,
  },
  secHdrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  categoryIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secHdrTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.text.primary,
    flexShrink: 1,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: T.spacing.sm,
    marginLeft: T.spacing.xs,
  },
  seeAllTxt: {
    fontSize: 13,
    color: PURPLE_LINK,
    fontWeight: '700',
  },

  mentorsRow: {
    gap: 10,
    paddingRight: T.spacing.lg,
    paddingBottom: T.spacing.xs,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxxl,
    paddingHorizontal: T.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  emptyIconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: S.accentViolet,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: T.spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.text.primary,
    textAlign: 'center',
    marginBottom: T.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
