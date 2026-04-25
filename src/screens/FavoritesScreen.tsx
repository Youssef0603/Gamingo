import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import { phrases } from '../data/phrases';
import { languageLabels } from '../types/language';
import { Badge, GameButton, GameCard, Screen } from '../components/ui';
import { theme } from '../theme/theme';

import type { FavoritesScreenProps } from '../types/navigation';

function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const { favoriteIds, selectedLanguage, toggleFavorite } = useAppState();
  const savedPhrases = phrases.filter(item => favoriteIds.includes(item.id));

  return (
    <Screen scrollable>
      <GameCard glow="secondary" style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label="Favorites" tone="secondary" />
          <Badge label={languageLabels[selectedLanguage]} tone="primary" />
          <Badge label={`${savedPhrases.length} Saved`} tone="accent" />
        </View>

        <Text style={styles.title}>Favorites Loadout</Text>
        <Text style={styles.subtitle}>
          Keep a short list of phrases you want to drill again under pressure.
        </Text>
      </GameCard>

      {savedPhrases.length ? (
        savedPhrases.map(item => {
          const translation = item.translations[selectedLanguage];
          const english = item.translations.en;
          const metadata = categoryMetadata[item.category];

          return (
            <GameCard
              key={item.id}
              glow={item.isToxic ? 'secondary' : 'primary'}
              style={styles.phraseCard}
              subtitle={english.text}
              title={translation.text}
            >
              <View style={styles.cardBadgeRow}>
                <Badge label={metadata.title} tone="primary" />
                {item.isToxic ? <Badge label="Toxic" tone="danger" /> : null}
                <Badge label={languageLabels[selectedLanguage]} tone="neutral" />
              </View>

              <Text style={styles.meaning}>{translation.meaning}</Text>

              <View style={styles.actionRow}>
                <View style={styles.actionCell}>
                  <GameButton
                    fullWidth
                    onPress={() =>
                      navigation.navigate('PracticeTab', { phraseId: item.id })
                    }
                    title="Practice"
                  />
                </View>
                <View style={styles.actionCell}>
                  <GameButton
                    fullWidth
                    onPress={() => toggleFavorite(item.id)}
                    title="Remove"
                    variant="danger"
                  />
                </View>
              </View>
            </GameCard>
          );
        })
      ) : (
        <GameCard glow="secondary" title="No Saved Phrases">
          <Text style={styles.emptyText}>
            Save lines from any phrase pack, then come back here to build a
            compact practice routine.
          </Text>
          <View style={styles.emptyAction}>
            <GameButton
              onPress={() =>
                navigation.navigate('HomeTab', {
                  screen: 'Home',
                })
              }
              title="Browse Categories"
            />
          </View>
        </GameCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginBottom: theme.spacing.xl,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.title,
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  phraseCard: {
    marginBottom: theme.spacing.lg,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  meaning: {
    ...theme.typography.body,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  actionCell: {
    flex: 1,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  emptyAction: {
    marginTop: theme.spacing.lg,
  },
});

export default FavoritesScreen;
