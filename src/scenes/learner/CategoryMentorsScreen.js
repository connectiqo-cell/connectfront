import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
  useWindowDimensions,
  Platform,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-simple-toast';
import CosmicBackground from '../../components/CosmicBackground';
import { SearchBar } from '../../components/SearchBar';
import { MentorImageCard } from '../../components/MentorImageCard';
import { MentorDetailSheet } from '../../components/MentorDetailSheet';
import { UNIFIED_THEME } from '../../unifiedTheme';
import { mentorApi } from '../../api/mentorApi';
import { useAuth } from '../../hooks/useAuth';
import { SCREEN_NAMES } from '../../navigators/screenNames';

const T = UNIFIED_THEME;
const C = T.colors;
const B = C.buttons;
const S = C.surface;

const PURPLE_LINK = B.nebulaGradient[0];
const TEAL = C.accent.secondary;

const PAGE_SIZE = 12;
const GRID_COLS = 3;

const SORT_OPTIONS = [
  { key: 'rating', label: 'Top Rated', icon: 'star' },
  { key: 'price_asc', label: 'Price: Low', icon: 'arrow-upward' },
  { key: 'price_desc', label: 'Price: High', icon: 'arrow-downward' },
  { key: 'experience', label: 'Experience', icon: 'workspace-premium' },
];

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return anim;
}

function SkeletonBone({ style }) {
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[
        skeletonStyles.bone,
        style,
        { opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }) },
      ]}
    />
  );
}

function SkeletonGrid({ cardWidth, cardHeight }) {
  return (
    <View style={skeletonStyles.grid}>
      {Array.from({ length: GRID_COLS * 3 }).map((_, i) => (
        <SkeletonBone
          key={i}
          style={[skeletonStyles.card, { width: cardWidth, height: cardHeight }]}
        />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    gap: T.spacing.sm,
  },
  card: {
    borderRadius: 16,
  },
  bone: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
});

function PressScale({ onPress, style, hitSlop, children, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function FadeSlideIn({ children, delay = 0, style, offsetY = 12 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offsetY)).current;

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
        tension: 90,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, offsetY, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function SortChip({ opt, active, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.sortChip, active && styles.sortChipActive]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <MaterialIcons
          name={opt.icon}
          size={13}
          color={active ? PURPLE_LINK : C.text.muted}
        />
        <Text style={[styles.sortChipTxt, active && styles.sortChipTxtActive]}>
          {opt.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function applySortFn(arr, sortBy) {
  const copy = [...arr];
  switch (sortBy) {
    case 'price_asc':
      return copy.sort((a, b) => (a.price_per_hour ?? 0) - (b.price_per_hour ?? 0));
    case 'price_desc':
      return copy.sort((a, b) => (b.price_per_hour ?? 0) - (a.price_per_hour ?? 0));
    case 'experience':
      return copy.sort((a, b) => (b.experience_years ?? 0) - (a.experience_years ?? 0));
    case 'rating':
    default:
      return copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
}

export default function CategoryMentorsScreen({ route, navigation }) {
  const { category } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('rating');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef(null);

  const cardGap = T.spacing.sm;
  const hPad = T.spacing.lg * 2;
  const cardWidth = Math.floor((screenWidth - hPad - cardGap * (GRID_COLS - 1)) / GRID_COLS);
  const cardHeight = Math.floor(cardWidth * 1.42);

  useEffect(() => {
    loadInitial();
  }, [category]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      setPage(0);
      setHasMore(true);
      const data = await mentorApi.getMentorsByCategoryName(category, 0, PAGE_SIZE);
      const filtered = (data || []).filter(m => m.id !== profile?.id);
      setMentors(filtered);
      setPage(1);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      Toast.show('Failed to load mentors');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const data = await mentorApi.getMentorsByCategoryName(category, page, PAGE_SIZE);
      const filtered = (data || []).filter(m => m.id !== profile?.id);
      setMentors(prev => [...prev, ...filtered]);
      setPage(p => p + 1);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      Toast.show('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, category, profile?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  };

  const handleBookMentor = useCallback(
    mentor => {
      const go = () => {
        navigation.navigate(SCREEN_NAMES.Booking, {
          mentorId: mentor.id,
          mentorName: mentor.profiles?.name || 'Mentor',
        });
      };
      if (Platform.OS === 'ios') {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(go, 320);
        });
      } else {
        go();
      }
    },
    [navigation],
  );

  const handleViewProfile = mentor => {
    navigation.navigate(SCREEN_NAMES.MentorProfile, { mentorId: mentor.id });
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
        const term = text.replace(/^@/, '').trim();
        const results = await mentorApi.searchMentors(term);
        const inCategory = (results || []).filter(m => {
          if (m.id === profile?.id) return false;
          return (m.category || '').toLowerCase().trim() === category.toLowerCase().trim();
        });
        setSearchResults(inCategory);
      } catch {
        Toast.show('Search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, [category, profile?.id]);

  const isSearching = searchQuery.trim().length > 0;
  const displayMentors = searchResults !== null ? searchResults : mentors;
  const sortedMentors = useMemo(
    () => applySortFn(displayMentors, sortBy),
    [displayMentors, sortBy],
  );
  const showInitialLoading = loading;
  const showSearchLoading = isSearching && searchLoading;

  const ListHeader = (
    <View style={styles.listHeader}>
      <FadeSlideIn delay={60}>
        <Text style={styles.pageSubtitle}>
          {isSearching
            ? 'Mentors matching your search'
            : 'Browse mentors in this category'}
        </Text>
      </FadeSlideIn>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortBar}
      >
        {SORT_OPTIONS.map((opt, index) => (
          <FadeSlideIn key={opt.key} delay={100 + index * 45}>
            <SortChip
              opt={opt}
              active={sortBy === opt.key}
              onPress={() => setSortBy(opt.key)}
            />
          </FadeSlideIn>
        ))}
      </ScrollView>
    </View>
  );

  const renderFooter = () => {
    if (isSearching || !hasMore || sortedMentors.length === 0) return null;
    const content = loadingMore ? (
      <ActivityIndicator size="small" color={TEAL} />
    ) : (
      <>
        <MaterialIcons name="expand-more" size={20} color={PURPLE_LINK} />
        <Text style={styles.loadMoreTxt}>Load more</Text>
      </>
    );

    if (loadingMore) {
      return (
        <View style={[styles.loadMoreWrap, styles.loadMoreBtn]}>
          {content}
        </View>
      );
    }

    return (
      <PressScale
        onPress={loadMore}
        style={styles.loadMoreWrap}
        accessibilityLabel="Load more mentors"
      >
        <View style={styles.loadMoreBtn}>{content}</View>
      </PressScale>
    );
  };

  const renderMentor = useCallback(
    ({ item, index }) => (
      <MentorImageCard
        mentor={item}
        onPress={setSelectedMentor}
        style={{ width: cardWidth, height: cardHeight }}
        entranceDelay={Math.min(index, 14) * 40}
      />
    ),
    [cardWidth, cardHeight],
  );

  return (
    <CosmicBackground>
      <SafeAreaView
        style={styles.safe}
        edges={Platform.OS === 'ios' ? ['top', 'bottom'] : ['bottom']}
      >
        <View
          style={[
            styles.topBar,
            {
              paddingTop:
                Platform.OS === 'ios' ? T.spacing.sm : insets.top + T.spacing.sm,
            },
          ]}
        >
          <PressScale
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <View style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color={C.text.primary} />
            </View>
          </PressScale>
          <FadeSlideIn style={styles.topBarTitleWrap} offsetY={-6}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {category}
            </Text>
          </FadeSlideIn>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.searchWrap}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search by name, @username or skill"
            containerStyle={styles.searchBar}
          />
        </View>

        {showInitialLoading || showSearchLoading ? (
          <SkeletonGrid cardWidth={cardWidth} cardHeight={cardHeight} />
        ) : (
          <FlatList
            style={styles.list}
            data={sortedMentors}
            keyExtractor={item => item.id}
            numColumns={GRID_COLS}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              <FadeSlideIn delay={80}>
                <View style={styles.emptyPanel}>
                  <View style={styles.emptyIconRing}>
                    <MaterialIcons
                      name={isSearching ? 'travel-explore' : 'person-search'}
                      size={40}
                      color={PURPLE_LINK}
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {isSearching ? 'No mentors found' : 'No mentors in this category'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {isSearching
                      ? 'Try a different keyword or clear the search.'
                      : 'Pull down to refresh or try another category.'}
                  </Text>
                </View>
              </FadeSlideIn>
            }
            ListFooterComponent={renderFooter}
            renderItem={renderMentor}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={TEAL}
              />
            }
          />
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
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.22)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  topBarTitleWrap: {
    flex: 1,
    marginHorizontal: T.spacing.sm,
  },
  topBarTitle: {
    fontSize: 17,
    color: C.text.primary,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  topBarSpacer: {
    width: 40,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: T.spacing.lg,
    paddingBottom: T.spacing.xxxl,
  },
  listHeader: {
    marginBottom: T.spacing.sm,
  },
  searchWrap: {
    paddingHorizontal: T.spacing.lg,
    paddingTop: T.spacing.md,
    paddingBottom: T.spacing.sm,
  },
  searchBar: {
    marginBottom: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: C.text.muted,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: T.spacing.md,
  },
  sortBar: {
    gap: T.spacing.sm,
    paddingBottom: T.spacing.md,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: T.spacing.md,
    paddingVertical: 8,
    borderRadius: T.borderRadius.chip,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sortChipActive: {
    backgroundColor: S.accentViolet,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  sortChipTxt: {
    fontSize: 12,
    color: C.text.muted,
    fontWeight: '600',
  },
  sortChipTxtActive: {
    color: PURPLE_LINK,
    fontWeight: '800',
  },
  row: {
    gap: T.spacing.sm,
    marginBottom: T.spacing.sm,
  },
  loadMoreWrap: {
    marginTop: T.spacing.sm,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.spacing.sm,
    paddingVertical: T.spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  loadMoreTxt: {
    fontSize: 13,
    color: PURPLE_LINK,
    fontWeight: '700',
  },
  emptyPanel: {
    alignItems: 'center',
    paddingVertical: T.spacing.xxxl,
    paddingHorizontal: T.spacing.lg,
    marginTop: T.spacing.lg,
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
