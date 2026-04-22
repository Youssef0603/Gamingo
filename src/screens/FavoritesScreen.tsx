import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PhraseCard from '../components/PhraseCard';
import ScreenContainer from '../components/ScreenContainer';
import SearchBar from '../components/SearchBar';
import { phrases } from '../data/phrases';

type FavoritesScreenProps = {
  favoriteIds: string[];
  onOpenPhrase: (phraseId: string) => void;
  onToggleFavorite: (phraseId: string) => void;
};

function FavoritesScreen({
  favoriteIds,
  onOpenPhrase,
  onToggleFavorite,
}: FavoritesScreenProps) {
  const [query, setQuery] = useState('');

  const filteredFavorites = useMemo(() => {
    const favoriteItems = phrases.filter(item => favoriteIds.includes(item.id));
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return favoriteItems;
    }

    return favoriteItems.filter(item => {
      return (
        item.phrase.toLowerCase().includes(normalizedQuery) ||
        item.meaning.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [favoriteIds, query]);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Favorites</Text>
      <Text style={styles.subtitle}>
        Your saved phrases stay in local app state for this session.
      </Text>

      <SearchBar value={query} onChangeText={setQuery} />

      {filteredFavorites.length ? (
        filteredFavorites.map(item => (
          <PhraseCard
            key={item.id}
            isFavorite
            item={item}
            onPress={() => onOpenPhrase(item.id)}
            onToggleFavorite={() => onToggleFavorite(item.id)}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No saved phrases yet</Text>
          <Text style={styles.emptyText}>
            Save phrases from any list, then review them here.
          </Text>
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
    lineHeight: 20,
  },
});

export default FavoritesScreen;
