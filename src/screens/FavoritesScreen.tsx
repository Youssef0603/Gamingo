import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import PhraseCard from '../components/PhraseCard';
import Screen from '../components/ui/Screen';
import { useAppState } from '../context/AppStateContext';
import { phrases } from '../data/phrases';
import PracticeModal from '../features/practice/PracticeModal';
import { theme, withAlpha } from '../theme/theme';
import { languageLabels } from '../types/language';

function FavoritesScreen() {
  const { favoriteIds, selectedLanguage, toggleFavorite } = useAppState();
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);

  const savedPhrases = useMemo(
    () => phrases.filter(item => favoriteIds.includes(item.id)),
    [favoriteIds],
  );
  const activePhrase = useMemo(
    () => phrases.find(item => item.id === activePhraseId) ?? null,
    [activePhraseId],
  );

  useEffect(() => {
    if (activePhraseId && !favoriteIds.includes(activePhraseId)) {
      setActivePhraseId(null);
    }
  }, [activePhraseId, favoriteIds]);

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerStyle={styles.content}
        data={savedPhrases}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <Text style={styles.emptyText}>Save phrases from Practice.</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title}>Favourites</Text>
              <Text style={styles.subtitle}>Saved phrases only.</Text>
            </View>

            <View style={styles.languageBadge}>
              <Text style={styles.languageText}>
                {languageLabels[selectedLanguage]}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <PhraseCard
            isFavorite
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
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  languageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  languageText: {
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

export default FavoritesScreen;
