import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BackButton from '../components/BackButton';
import PhraseCard from '../components/PhraseCard';
import ScreenContainer from '../components/ScreenContainer';
import SearchBar from '../components/SearchBar';
import {
  categoryDescriptions,
  categoryTitles,
  phrases,
} from '../data/phrases';

import type { PhraseCategory } from '../types/phrase';

type PhraseListScreenProps = {
  category: PhraseCategory;
  favoriteIds: string[];
  onBack: () => void;
  onOpenPhrase: (phraseId: string) => void;
  onToggleFavorite: (phraseId: string) => void;
};

function PhraseListScreen({
  category,
  favoriteIds,
  onBack,
  onOpenPhrase,
  onToggleFavorite,
}: PhraseListScreenProps) {
  const [query, setQuery] = useState('');

  const filteredPhrases = useMemo(() => {
    const categoryItems = phrases.filter(item => item.category === category);
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return categoryItems;
    }

    return categoryItems.filter(item => {
      return (
        item.phrase.toLowerCase().includes(normalizedQuery) ||
        item.meaning.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, query]);

  return (
    <ScreenContainer>
      <BackButton onPress={onBack} />
      <Text style={styles.title}>{categoryTitles[category]}</Text>
      <Text style={styles.subtitle}>{categoryDescriptions[category]}</Text>

      <SearchBar value={query} onChangeText={setQuery} />

      {filteredPhrases.length ? (
        filteredPhrases.map(item => (
          <PhraseCard
            key={item.id}
            isFavorite={favoriteIds.includes(item.id)}
            item={item}
            onPress={() => onOpenPhrase(item.id)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptyText}>Try a different phrase or keyword.</Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyState: {
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});

export default PhraseListScreen;
