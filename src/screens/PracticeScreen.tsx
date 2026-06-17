import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  ScrollView,
  StyleSheet,
  Text,
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
  const chipLayoutsRef = useRef<
    Partial<Record<CategoryFilter, { width: number; x: number }>>
  >({});
  const [showScrollToTopButton, setShowScrollToTopButton] = useState(false);
  const isScrollToTopButtonVisibleRef = useRef(false);

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

  const filteredPhrases = useMemo(
    () =>
      selectedCategory === 'all'
        ? phrases
        : phrases.filter(item => item.category === selectedCategory),
    [phrases, selectedCategory],
  );
  const phraseSections = useMemo<PhraseSection[]>(
    () =>
      availableCategories.map(category => ({
        data: phrases.filter(item => item.category === category),
        key: category,
        title: categoryMetadata[category].title,
      })),
    [availableCategories, phrases],
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

  const showPhraseInList = (phrase: Phrase) => {
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
              filteredPhrases.length === 1
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
        <Text style={styles.filterLabel}>Category</Text>
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
      </View>
    </View>
  );

  const emptyState = (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No phrases</Text>
      <Text style={styles.emptyText}>Try another category.</Text>
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
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.content}
          data={filteredPhrases}
          keyExtractor={item => item.id}
          ListEmptyComponent={emptyState}
          ListHeaderComponent={listHeader}
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
  filterBlock: {
    marginBottom: theme.spacing.md,
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
    opacity: 0.88,
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
    opacity: 0.9,
  },
  languageTriggerValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  languageTextWrap: {
    flex: 1,
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
    opacity: 0.85,
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
    opacity: 0.85,
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
