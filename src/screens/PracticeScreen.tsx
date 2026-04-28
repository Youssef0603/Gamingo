import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { phrases } from '../data/phrases';
import InlineBannerAd from '../features/ads/InlineBannerAd';
import { showInterstitialBefore } from '../features/ads/mobileAds';
import AddPhraseModal from '../features/phrases/AddPhraseModal';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';

import type { PhraseCategory } from '../types/phrase';

type CategoryFilter = PhraseCategory | 'all';

const INLINE_AD_FREQUENCY = 3;

const availableCategories = Array.from(
  new Set(phrases.map(item => item.category)),
) as PhraseCategory[];
const categoryOptions: CategoryFilter[] = ['all', ...availableCategories];

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
    isFavorite,
    nativeLanguage,
    openLanguagePicker,
    selectedLanguage,
    toggleFavorite,
  } = useAppState();
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>('all');
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);
  const [isLookupModalVisible, setIsLookupModalVisible] = useState(false);

  const filteredPhrases = useMemo(
    () =>
      selectedCategory === 'all'
        ? phrases
        : phrases.filter(item => item.category === selectedCategory),
    [selectedCategory],
  );
  const activePhrase = useMemo(
    () => phrases.find(item => item.id === activePhraseId) ?? null,
    [activePhraseId],
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

  const nativeLanguageOption = languageMetadata[nativeLanguage];
  const selectedLanguageOption = languageMetadata[selectedLanguage];
  const openPhrase = (phraseId: string) => {
    showInterstitialBefore(() => {
      setActivePhraseId(phraseId);
    });
  };

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
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
            <View style={styles.heading}>
              <Text style={styles.title}>Practice</Text>
              <Text style={styles.subtitle}>
                Pick a language and a category.
              </Text>
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

            <View style={styles.lookupHeader}>
              <Text style={styles.filterLabel}>Add from your data</Text>
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
          </View>
        }
        renderItem={({ item, index }) => (
          <View>
            <PhraseCard
              helperLanguage={nativeLanguage}
              isFavorite={isFavorite(item.id)}
              item={item}
              language={selectedLanguage}
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
        helperLanguage={nativeLanguage}
        isFavorite={isFavorite}
        language={selectedLanguage}
        onAddPhrase={phraseId => toggleFavorite(phraseId)}
        onClose={() => setIsLookupModalVisible(false)}
        onOpenPhrase={openPhrase}
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
  heading: {
    marginBottom: theme.spacing.lg,
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
  lookupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
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
