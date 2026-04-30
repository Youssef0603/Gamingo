import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PhraseCard from '../components/PhraseCard';
import { Icon, Screen } from '../components/ui';
import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import { showInterstitialBefore } from '../features/ads/mobileAds';
import AddPhraseModal from '../features/phrases/AddPhraseModal';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';

import type { Phrase, PhraseCategory } from '../types/phrase';

type CategoryFilter = PhraseCategory | 'all';

const INLINE_AD_FREQUENCY = 3;

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <Pressable
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
  const [pendingScrollPhraseId, setPendingScrollPhraseId] = useState<
    string | null
  >(null);
  const [pendingOpenPhraseId, setPendingOpenPhraseId] = useState<string | null>(
    null,
  );
  const listRef = useRef<FlatList<Phrase>>(null);

  const availableCategories = useMemo(
    () => Array.from(new Set(phrases.map(item => item.category))),
    [phrases],
  ) as PhraseCategory[];
  const categoryOptions = useMemo<CategoryFilter[]>(
    () => ['all', ...availableCategories],
    [availableCategories],
  );

  const filteredPhrases = useMemo(
    () =>
      selectedCategory === 'all'
        ? phrases
        : phrases.filter(item => item.category === selectedCategory),
    [phrases, selectedCategory],
  );
  const activePhrase = useMemo(
    () => phrases.find(item => item.id === activePhraseId) ?? null,
    [activePhraseId, phrases],
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
        openPhrase(pendingOpenPhraseId);
        setPendingOpenPhraseId(null);
      }

      setPendingScrollPhraseId(null);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [filteredPhrases, pendingOpenPhraseId, pendingScrollPhraseId]);

  const nativeLanguageOption = languageMetadata[nativeLanguage];
  const selectedLanguageOption = languageMetadata[selectedLanguage];
  const openPhrase = (phraseId: string) => {
    showInterstitialBefore(() => {
      setActivePhraseId(phraseId);
    });
  };

  const showPhraseInList = (phrase: Phrase) => {
    setSelectedCategory(phrase.category);
    setPendingScrollPhraseId(phrase.id);
    setPendingOpenPhraseId(phrase.id);
  };

  const confirmDeletePhrase = (phrase: Phrase) => {
    const phraseLabel =
      (phrase.translations[nativeLanguage] ?? phrase.translations.en).text;

    Alert.alert(
      'Delete custom word?',
      `Remove "${phraseLabel}" from Custom?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCustomPhrase(phrase.id);
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.content}
        data={filteredPhrases}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No phrases</Text>
            <Text style={styles.emptyText}>Try another category.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingRow}>
              <View style={styles.heading}>
                <Text style={styles.title}>Practice</Text>
                <Text style={styles.subtitle}>
                  Pick a language and a category.
                </Text>
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
                    <Text style={styles.languageFlag}>
                      {nativeLanguageOption.flag}
                    </Text>
                    <View style={styles.languageTextWrap}>
                      <Text style={styles.languageTriggerLabel}>
                        Native
                      </Text>
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
                      <Text style={styles.languageTriggerLabel}>
                        Learning
                      </Text>
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

            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Category</Text>
              <ScrollView
                contentContainerStyle={styles.chipRow}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {categoryOptions.map(category => (
                  <FilterChip
                    key={category}
                    label={
                      category === 'all'
                        ? 'All'
                        : categoryMetadata[category].title
                    }
                    onPress={() => setSelectedCategory(category)}
                    selected={category === selectedCategory}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {filteredPhrases.length} phrases
              </Text>
            </View>
          </View>
        }
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
        renderItem={({ item, index }) => (
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
            {(index + 1) % INLINE_AD_FREQUENCY === 0 &&
            index < filteredPhrases.length - 1 ? (
              <InlineBannerAd />
            ) : null}
          </View>
        )}
        showsVerticalScrollIndicator={false}
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
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  filterBlock: {
    marginBottom: theme.spacing.md,
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  languageFlag: {
    fontSize: 24,
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
    paddingVertical: 12,
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
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  languageTriggerPressed: {
    opacity: 0.9,
  },
  languageTriggerValue: {
    color: theme.colors.text,
    fontSize: 15,
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
  countBadge: {
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
  countText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
