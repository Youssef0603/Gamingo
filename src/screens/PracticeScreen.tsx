import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import PhraseCard from '../components/PhraseCard';
import Screen from '../components/ui/Screen';
import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import { phrases } from '../data/phrases';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageLabels, supportedLanguageCodes } from '../types/language';

import type { PhraseCategory } from '../types/phrase';

type CategoryFilter = PhraseCategory | 'all';

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
    favoriteIds,
    selectedLanguage,
    setSelectedLanguage,
    toggleFavorite,
  } = useAppState();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);

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

  return (
    <Screen padded={false}>
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
              <Text style={styles.subtitle}>Pick a language and a category.</Text>
            </View>

            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Language</Text>
              <ScrollView
                contentContainerStyle={styles.chipRow}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {supportedLanguageCodes.map(language => (
                  <FilterChip
                    key={language}
                    label={languageLabels[language]}
                    onPress={() => setSelectedLanguage(language)}
                    selected={language === selectedLanguage}
                  />
                ))}
              </ScrollView>
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
              <Text style={styles.countText}>{filteredPhrases.length} phrases</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PhraseCard
            isFavorite={favoriteIds.includes(item.id)}
            item={item}
            language={selectedLanguage}
            onPress={() => setActivePhraseId(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <PracticeModal
        isFavorite={activePhrase ? favoriteIds.includes(activePhrase.id) : false}
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
