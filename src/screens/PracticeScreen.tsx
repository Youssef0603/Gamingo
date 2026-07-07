import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  Alert,
  Animated,
  Pressable,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PhraseCard from '../components/PhraseCard';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { Icon, Screen } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import { categoryMetadata, categoryOrder } from '../data/categories';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import {
  showAdBeforeRandomPractice,
  showAdOnItemClick,
} from '../features/ads/mobileAds';
import AddPhraseModal from '../features/phrases/AddPhraseModal';
import PracticeModal from '../features/practice/PracticeModal';
import RandomPracticeModal from '../features/practice/RandomPracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';
import { getPhraseDisplayTranslations } from '../utils/phraseDisplay';
import { phraseMatchesSearch } from '../utils/phraseSearch';

import type { LanguageCode } from '../types/language';
import type { Phrase, PhraseCategory } from '../types/phrase';

type CategoryFilter = PhraseCategory | 'all';
type PhraseSection = {
  data: Phrase[];
  key: PhraseCategory;
  title: string;
};

const INLINE_BANNER_FREQUENCY = 10;
const RANDOM_PRACTICE_COUNT = 10;
const SCROLL_TO_TOP_BUTTON_THRESHOLD = 420;

type FilterChipProps = {
  label: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  selected: boolean;
  onPress: () => void;
};

type RandomPracticeSession = {
  id: number;
  phrases: Phrase[];
};

function canUsePhraseInRandomPractice(
  phrase: Phrase,
  nativeLanguage: LanguageCode,
  learningLanguage: LanguageCode,
) {
  if (phrase.category === 'custom') {
    return (
      phrase.customLanguages?.native === nativeLanguage &&
      phrase.customLanguages.learning === learningLanguage &&
      Boolean(phrase.translations[learningLanguage])
    );
  }

  return Boolean(phrase.translations[learningLanguage]);
}

function getRandomPhraseSet(phraseList: Phrase[], count: number) {
  const shuffledPhrases = [...phraseList];

  for (let index = shuffledPhrases.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentPhrase = shuffledPhrases[index];

    shuffledPhrases[index] = shuffledPhrases[randomIndex];
    shuffledPhrases[randomIndex] = currentPhrase;
  }

  return shuffledPhrases.slice(0, Math.min(count, shuffledPhrases.length));
}

function FilterChip({ label, onLayout, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PracticeScreen() {
  const {
    addCustomPhrase,
    deleteCustomPhrase,
    isFavorite,
    nativeLanguage,
    openLanguagePicker,
    phrases,
    selectedLanguage,
    toggleFavorite,
  } = useAppState();
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);
  const [isLookupModalVisible, setIsLookupModalVisible] = useState(false);
  const [categoryViewportWidth, setCategoryViewportWidth] = useState(0);
  const [pendingScrollPhraseId, setPendingScrollPhraseId] = useState<
    string | null
  >(null);
  const [pendingOpenPhraseId, setPendingOpenPhraseId] = useState<string | null>(
    null,
  );
  const [randomPracticeSession, setRandomPracticeSession] =
    useState<RandomPracticeSession | null>(null);
  const listRef = useRef<FlatList<Phrase>>(null);
  const sectionListRef = useRef<SectionList<Phrase, PhraseSection>>(null);
  const categoryScrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const chipLayoutsRef = useRef<
    Partial<Record<CategoryFilter, { width: number; x: number }>>
  >({});
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);
  const isScrollToTopButtonVisibleRef = useRef(false);
  const searchRevealAnimation = useRef(new Animated.Value(0)).current;
  const [
    isToxicCategoryDisclosureDismissed,
    setIsToxicCategoryDisclosureDismissed,
  ] = useState(false);

  const availableCategories = useMemo(() => {
    const availableCategorySet = new Set(phrases.map(item => item.category));

    return categoryOrder.filter(category => availableCategorySet.has(category));
  }, [phrases]);
  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    const nonCustomCategories = availableCategories.filter(
      category => category !== 'custom',
    );

    return availableCategories.includes('custom')
      ? ['all', 'custom', ...nonCustomCategories]
      : ['all', ...nonCustomCategories];
  }, [availableCategories]);

  const searchMatchedPhrases = useMemo(
    () =>
      phrases.filter(phrase =>
        phraseMatchesSearch(
          phrase,
          searchQuery,
          nativeLanguage,
          selectedLanguage,
        ),
      ),
    [nativeLanguage, phrases, searchQuery, selectedLanguage],
  );
  const filteredPhrases = useMemo(
    () =>
      selectedCategory === 'all'
        ? searchMatchedPhrases
        : searchMatchedPhrases.filter(
            item => item.category === selectedCategory,
          ),
    [searchMatchedPhrases, selectedCategory],
  );
  const phraseSections = useMemo<PhraseSection[]>(
    () =>
      availableCategories
        .map(category => ({
          data: searchMatchedPhrases.filter(item => item.category === category),
          key: category,
          title: categoryMetadata[category].title,
        }))
        .filter(section => section.data.length > 0),
    [availableCategories, searchMatchedPhrases],
  );
  const sectionedPhraseIndexById = useMemo(() => {
    const nextValue: Record<string, number> = {};
    let nextIndex = 0;

    phraseSections.forEach(section => {
      section.data.forEach(phrase => {
        nextValue[phrase.id] = nextIndex;
        nextIndex += 1;
      });
    });

    return nextValue;
  }, [phraseSections]);
  const sectionedPhraseCount = useMemo(
    () =>
      phraseSections.reduce(
        (totalCount, section) => totalCount + section.data.length,
        0,
      ),
    [phraseSections],
  );
  const activePhrase = useMemo(
    () => phrases.find(item => item.id === activePhraseId) ?? null,
    [activePhraseId, phrases],
  );
  const randomPracticePool = useMemo(
    () =>
      phrases.filter(phrase =>
        canUsePhraseInRandomPractice(
          phrase,
          nativeLanguage,
          selectedLanguage,
        ),
      ),
    [nativeLanguage, phrases, selectedLanguage],
  );

  useEffect(() => {
    if (
      activePhrase &&
      selectedCategory !== 'all' &&
      activePhrase.category !== selectedCategory
    ) {
      setActivePhraseId(null);
    }
  }, [activePhrase, selectedCategory]);

  useEffect(() => {
    if (
      selectedCategory !== 'all' &&
      !availableCategories.includes(selectedCategory)
    ) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    if (!pendingScrollPhraseId) {
      return;
    }

    const targetIndex = filteredPhrases.findIndex(
      item => item.id === pendingScrollPhraseId,
    );

    if (targetIndex === -1) {
      return;
    }

    const timeoutId = setTimeout(() => {
      listRef.current?.scrollToIndex({
        animated: true,
        index: targetIndex,
        viewPosition: 0.2,
      });

      if (pendingOpenPhraseId === pendingScrollPhraseId) {
        setActivePhraseId(pendingOpenPhraseId);
        setPendingOpenPhraseId(null);
      }

      setPendingScrollPhraseId(null);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [filteredPhrases, pendingOpenPhraseId, pendingScrollPhraseId]);

  useEffect(() => {
    Animated.timing(searchRevealAnimation, {
      duration: 220,
      toValue: isSearchVisible ? 1 : 0,
      useNativeDriver: false,
    }).start();

    if (isSearchVisible) {
      const timeoutId = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 120);

      return () => clearTimeout(timeoutId);
    }

    searchInputRef.current?.blur();
  }, [isSearchVisible, searchRevealAnimation]);

  useEffect(() => {
    const selectedChipLayout = chipLayoutsRef.current[selectedCategory];

    if (!selectedChipLayout) {
      return;
    }

    const viewportWidth = categoryViewportWidth;
    const centeredOffset =
      selectedChipLayout.x -
      Math.max(0, (viewportWidth - selectedChipLayout.width) / 2);
    const targetOffset =
      selectedCategory === 'all' ? 0 : Math.max(0, centeredOffset);

    const timeoutId = setTimeout(() => {
      categoryScrollRef.current?.scrollTo({
        animated: true,
        x: targetOffset,
        y: 0,
      });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [categoryViewportWidth, selectedCategory]);

  const nativeLanguageOption = languageMetadata[nativeLanguage];
  const selectedLanguageOption = languageMetadata[selectedLanguage];
  const shouldMaskToxicCategoryContent =
    selectedCategory === 'toxic' && !isToxicCategoryDisclosureDismissed;
  const shouldShowToxicListOverlay =
    shouldMaskToxicCategoryContent && filteredPhrases.length > 0;
  const handleCategoryChipLayout =
    (category: CategoryFilter) => (event: LayoutChangeEvent) => {
      chipLayoutsRef.current[category] = event.nativeEvent.layout;

      if (category !== selectedCategory) {
        return;
      }

      const viewportWidth = categoryViewportWidth;
      const { width, x } = event.nativeEvent.layout;
      const centeredOffset = x - Math.max(0, (viewportWidth - width) / 2);

      categoryScrollRef.current?.scrollTo({
        animated: true,
        x: category === 'all' ? 0 : Math.max(0, centeredOffset),
        y: 0,
      });
    };
  const openPhrase = (phraseId: string) => {
    showAdOnItemClick(() => {
      setActivePhraseId(phraseId);
    });
  };

  const hideSearch = () => {
    setSearchQuery('');
    setIsSearchVisible(false);
  };

  const toggleSearch = () => {
    if (isSearchVisible) {
      hideSearch();
      return;
    }

    setIsSearchVisible(true);
  };

  const acknowledgeToxicCategoryDisclosure = () => {
    setIsToxicCategoryDisclosureDismissed(true);
  };

  useEffect(() => {
    if (selectedCategory !== 'toxic') {
      setIsToxicCategoryDisclosureDismissed(false);
    }
  }, [selectedCategory]);

  const showPhraseInList = (phrase: Phrase) => {
    setSearchQuery('');
    setIsSearchVisible(false);
    setSelectedCategory(phrase.category);
    setPendingScrollPhraseId(phrase.id);
    setPendingOpenPhraseId(phrase.id);
  };

  const showNoWordsReadyAlert = () => {
    Alert.alert(
      'No words ready yet',
      'Switch languages or add custom words for this language pair first.',
    );
  };

  const openRandomPracticeSession = () => {
    setRandomPracticeSession({
      id: Date.now() + Math.random(),
      phrases: getRandomPhraseSet(randomPracticePool, RANDOM_PRACTICE_COUNT),
    });
  };

  const beginRandomPracticeSession = () => {
    if (randomPracticePool.length === 0) {
      showNoWordsReadyAlert();
      return;
    }

    openRandomPracticeSession();
  };

  const startRandomPracticeSession = () => {
    if (randomPracticePool.length === 0) {
      showNoWordsReadyAlert();
      return;
    }

    showAdBeforeRandomPractice(() => {
      openRandomPracticeSession();
    });
  };

  const confirmDeletePhrase = (phrase: Phrase) => {
    const { helperTranslation } = getPhraseDisplayTranslations(
      phrase,
      nativeLanguage,
      selectedLanguage,
    );
    const phraseLabel = helperTranslation.text;

    Alert.alert(
      'Delete custom word?',
      `Remove "${phraseLabel}" from Custom?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (
              selectedCategory === 'custom' &&
              phrases.filter(item => item.category === 'custom').length === 1
            ) {
              setSelectedCategory('all');
            }

            deleteCustomPhrase(phrase.id);
          },
        },
      ],
    );
  };

  const handleListScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const shouldShowButton =
      event.nativeEvent.contentOffset.y > SCROLL_TO_TOP_BUTTON_THRESHOLD;

    if (isScrollToTopButtonVisibleRef.current === shouldShowButton) {
      return;
    }

    isScrollToTopButtonVisibleRef.current = shouldShowButton;
    setShowScrollToTopButton(shouldShowButton);
  };

  const scrollToTop = () => {
    isScrollToTopButtonVisibleRef.current = false;
    setShowScrollToTopButton(false);

    if (selectedCategory === 'all') {
      if (phraseSections.length > 0) {
        sectionListRef.current?.scrollToLocation({
          animated: true,
          itemIndex: 0,
          sectionIndex: 0,
          viewOffset: 0,
          viewPosition: 0,
        });
      }

      return;
    }

    listRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.headingRow}>
        <View style={styles.heading}>
          <Text style={styles.title}>Practice</Text>
        </View>

        <Pressable
          onPress={() => setIsLookupModalVisible(true)}
          style={({ pressed }) => [
            styles.lookupToggle,
            pressed && styles.lookupTogglePressed,
          ]}
        >
          <Text style={styles.lookupPlus}>+</Text>
          <Text style={styles.lookupToggleText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.filterLabel}>Languages</Text>
        <View style={styles.languageRow}>
          <Pressable
            onPress={() => openLanguagePicker('native')}
            style={({ pressed }) => [
              styles.languageTrigger,
              styles.languageTriggerHalf,
              pressed && styles.languageTriggerPressed,
            ]}
          >
            <View style={styles.languageTriggerCopy}>
              <Text style={styles.languageFlag}>{nativeLanguageOption.flag}</Text>
              <View style={styles.languageTextWrap}>
                <Text style={styles.languageTriggerLabel}>Native</Text>
                <Text
                  numberOfLines={1}
                  style={styles.languageTriggerValue}
                >
                  {nativeLanguageOption.label}
                </Text>
              </View>
            </View>

            <Icon
              color={theme.colors.mutedText}
              name="chevron-down"
              size={18}
            />
          </Pressable>

          <Pressable
            onPress={() => openLanguagePicker('learning')}
            style={({ pressed }) => [
              styles.languageTrigger,
              styles.languageTriggerHalf,
              pressed && styles.languageTriggerPressed,
            ]}
          >
            <View style={styles.languageTriggerCopy}>
              <Text style={styles.languageFlag}>
                {selectedLanguageOption.flag}
              </Text>
              <View style={styles.languageTextWrap}>
                <Text style={styles.languageTriggerLabel}>Learning</Text>
                <Text
                  numberOfLines={1}
                  style={styles.languageTriggerValue}
                >
                  {selectedLanguageOption.label}
                </Text>
              </View>
            </View>

            <Icon
              color={theme.colors.mutedText}
              name="chevron-down"
              size={18}
            />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={startRandomPracticeSession}
        style={({ pressed }) => [
          styles.randomPracticeCard,
          pressed && styles.randomPracticeCardPressed,
        ]}
      >
        <View style={styles.randomPracticeIconWrap}>
          <Icon color={theme.colors.primary} name="play-circle" size={18} />
        </View>
        <Text style={styles.randomPracticeText}>Practice random words</Text>
      </Pressable>

      <View style={styles.filterBlock}>
        <View style={styles.filterHeaderRow}>
          <Text style={[styles.filterLabel, styles.filterHeaderLabel]}>
            Category
          </Text>
          <Pressable
            accessibilityLabel={
              isSearchVisible ? 'Close search' : 'Open search'
            }
            hitSlop={8}
            onPress={toggleSearch}
            style={({ pressed }) => [
              styles.searchToggleButton,
              isSearchVisible && styles.searchToggleButtonActive,
              pressed && styles.searchToggleButtonPressed,
            ]}
          >
            <Icon
              color={
                isSearchVisible ? theme.colors.primary : theme.colors.mutedText
              }
              name="search"
              size={18}
            />
          </Pressable>
        </View>
        <ScrollView
          onLayout={event =>
            setCategoryViewportWidth(event.nativeEvent.layout.width)
          }
          ref={categoryScrollRef}
          contentContainerStyle={styles.chipRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {categoryOptions.map(category => (
            <FilterChip
              key={category}
              label={
                category === 'all' ? 'All' : categoryMetadata[category].title
              }
              onLayout={handleCategoryChipLayout(category)}
              onPress={() => setSelectedCategory(category)}
              selected={category === selectedCategory}
            />
          ))}
        </ScrollView>

        <Animated.View
          pointerEvents={isSearchVisible ? 'auto' : 'none'}
          style={[
            styles.searchReveal,
            {
              height: searchRevealAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 56],
              }),
              opacity: searchRevealAnimation,
              transform: [
                {
                  translateY: searchRevealAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.searchBar, styles.categorySearchBar]}>
            <Icon color={theme.colors.mutedText} name="search" size={20} />
            <TextInput
              ref={searchInputRef}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Search words"
              placeholderTextColor={theme.colors.mutedText}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            <Pressable
              accessibilityLabel="Close search"
              hitSlop={10}
              onPress={hideSearch}
              style={({ pressed }) => [
                styles.clearSearchButton,
                pressed && styles.clearSearchButtonPressed,
              ]}
            >
              <Icon color={theme.colors.mutedText} name="close" size={18} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );

  const emptyState = (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>
        {searchQuery.trim() ? 'No words found' : 'No phrases'}
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery.trim()
          ? `No results for "${searchQuery.trim()}".`
          : 'Try another category.'}
      </Text>
    </View>
  );

  const renderPhraseItem = (item: Phrase, index: number, totalCount: number) => {
    const shouldShowBanner =
      (index + 1) % INLINE_BANNER_FREQUENCY === 0 && index < totalCount - 1;

    return (
      <View>
        <PhraseCard
          helperLanguage={nativeLanguage}
          isFavorite={isFavorite(item.id)}
          item={item}
          language={selectedLanguage}
          onDelete={
            item.category === 'custom'
              ? () => confirmDeletePhrase(item)
              : undefined
          }
          onPress={() => openPhrase(item.id)}
          onToggleFavorite={() => toggleFavorite(item.id)}
        />
        {shouldShowBanner ? <InlineBannerAd /> : null}
      </View>
    );
  };

  return (
    <Screen padded={false} edges={['top']}>
      {selectedCategory === 'all' ? (
        <SectionList
          ref={sectionListRef}
          contentContainerStyle={styles.content}
          keyExtractor={item => item.id}
          ListEmptyComponent={emptyState}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          onScroll={handleListScroll}
          renderItem={({ item, index }) =>
            renderPhraseItem(
              item,
              sectionedPhraseIndexById[item.id] ?? index,
              sectionedPhraseCount,
            )
          }
          scrollEventThrottle={16}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
          sections={phraseSections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <View style={styles.filteredCategoryWrap}>
          {shouldShowToxicListOverlay ? (
            <View style={styles.filteredCategoryHeaderWrap}>{listHeader}</View>
          ) : null}
          {shouldShowToxicListOverlay ? (
            <View style={styles.filteredListWrap}>
              <View style={styles.toxicListOverlay}>
                <BlurView
                  intensity={42}
                  style={StyleSheet.absoluteFill}
                  tint="dark"
                />
                <View style={styles.toxicListOverlayTint} />
                <View style={styles.toxicDisclosureCard}>
                  <View style={styles.toxicDisclosureIconWrap}>
                    <Icon
                      color={theme.colors.primary}
                      name="alert-circle"
                      size={22}
                    />
                  </View>
                  <Text style={styles.toxicDisclosureTitle}>
                    Toxic content warning
                  </Text>
                  <Text style={styles.toxicDisclosureText}>
                    This category includes abusive and toxic phrases. Use it
                    only to recognize harmful language, and do not use these
                    phrases in a real game.
                  </Text>
                  <Pressable
                    accessibilityLabel="See toxic phrases"
                    onPress={acknowledgeToxicCategoryDisclosure}
                    style={({ pressed }) => [
                      styles.toxicDisclosureButton,
                      pressed && styles.toxicDisclosureButtonPressed,
                    ]}
                  >
                    <Text style={styles.toxicDisclosureButtonText}>See</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.filteredListWrap}>
              <FlatList
                ref={listRef}
                contentContainerStyle={styles.content}
                data={filteredPhrases}
                keyExtractor={item => item.id}
                ListEmptyComponent={emptyState}
                ListHeaderComponent={listHeader}
                keyboardShouldPersistTaps="handled"
                onScroll={handleListScroll}
                onScrollToIndexFailed={({ averageItemLength, index }) => {
                  listRef.current?.scrollToOffset({
                    animated: true,
                    offset: averageItemLength * index,
                  });

                  setTimeout(() => {
                    listRef.current?.scrollToIndex({
                      animated: true,
                      index,
                      viewPosition: 0.2,
                    });
                  }, 120);
                }}
                renderItem={({ item, index }) =>
                  renderPhraseItem(item, index, filteredPhrases.length)
                }
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      )}

      <ScrollToTopButton
        onPress={scrollToTop}
        visible={showScrollToTopButton}
      />

      <PracticeModal
        isFavorite={activePhrase ? isFavorite(activePhrase.id) : false}
        helperLanguage={nativeLanguage}
        language={selectedLanguage}
        onClose={() => setActivePhraseId(null)}
        onToggleFavorite={() => {
          if (activePhrase) {
            toggleFavorite(activePhrase.id);
          }
        }}
        phrase={activePhrase}
        visible={Boolean(activePhrase)}
      />
      <AddPhraseModal
        inputLanguage={nativeLanguage}
        language={selectedLanguage}
        mode="custom"
        onClose={() => setIsLookupModalVisible(false)}
        onCreatePhrase={(nativeText, learningText) =>
          addCustomPhrase(
            nativeText,
            learningText,
            nativeLanguage,
            selectedLanguage,
          )
        }
        onSeePhrase={phrase => {
          showPhraseInList(phrase);
        }}
        phrases={phrases}
        visible={isLookupModalVisible}
      />
      <RandomPracticeModal
        helperLanguage={nativeLanguage}
        isFavorite={isFavorite}
        language={selectedLanguage}
        onClose={() => setRandomPracticeSession(null)}
        onRestart={beginRandomPracticeSession}
        onToggleFavorite={phraseId => toggleFavorite(phraseId)}
        phrases={randomPracticeSession?.phrases ?? []}
        sessionId={randomPracticeSession?.id ?? 0}
        visible={Boolean(randomPracticeSession)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  contentWithoutHeader: {
    paddingTop: 0,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  headingRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  heading: {
    flex: 1,
  },
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xs,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  categorySearchBar: {
    marginBottom: 0,
    marginTop: theme.spacing.sm,
  },
  searchInput: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  clearSearchButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  clearSearchButtonPressed: {
    opacity: 0.6,
  },
  filterBlock: {
    marginBottom: theme.spacing.md,
  },
  filterHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  randomPracticeCard: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  randomPracticeCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  randomPracticeIconWrap: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderRadius: theme.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  randomPracticeText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  filterHeaderLabel: {
    marginBottom: 0,
  },
  languageFlag: {
    fontSize: 20,
  },
  languageRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  languageTrigger: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  languageTriggerCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  languageTriggerHalf: {
    flex: 1,
  },
  languageTriggerLabel: {
    color: theme.colors.mutedText,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
  },
  languageTriggerPressed: {
    transform: [{ scale: 0.99 }],
  },
  languageTriggerValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  languageTextWrap: {
    flex: 1,
  },
  searchReveal: {
    overflow: 'hidden',
  },
  searchToggleButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  searchToggleButtonActive: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
  },
  searchToggleButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  chipRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  chip: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipPressed: {
    transform: [{ scale: 0.97 }],
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  lookupToggle: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lookupTogglePressed: {
    transform: [{ scale: 0.97 }],
  },
  lookupPlus: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  lookupToggleText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  sectionHeaderText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  filteredCategoryWrap: {
    flex: 1,
  },
  filteredCategoryHeaderWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  filteredListWrap: {
    flex: 1,
    position: 'relative',
  },
  toxicListOverlay: {
    alignItems: 'center',
    flex: 1,
    elevation: 20,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    width: '100%',
    zIndex: 20,
  },
  toxicListOverlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
  },
  toxicDisclosureCard: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.card, 0.88),
    borderColor: withAlpha(theme.colors.primary, 0.2),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 21,
    maxWidth: 520,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    width: '100%',
    zIndex: 21,
  },
  toxicDisclosureIconWrap: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderRadius: theme.radius.pill,
    height: 48,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    width: 48,
  },
  toxicDisclosureTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  toxicDisclosureText: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  toxicDisclosureButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 24,
  },
  toxicDisclosureButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  toxicDisclosureButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
});

export default PracticeScreen;
