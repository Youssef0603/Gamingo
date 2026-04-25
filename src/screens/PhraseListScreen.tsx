import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import { phrases } from '../data/phrases';
import { languageLabels } from '../types/language';
import { Badge, GameButton, GameCard, Screen } from '../components/ui';
import { theme } from '../theme/theme';

import type { PhraseListScreenProps } from '../types/navigation';

function PhraseListScreen({ navigation, route }: PhraseListScreenProps) {
  const { favoriteIds, selectedLanguage, toggleFavorite } = useAppState();
  const { category } = route.params;
  const metadata = categoryMetadata[category];
  const categoryPhrases = phrases.filter(item => item.category === category);

  return (
    <Screen edges={['right', 'bottom', 'left']} scrollable>
      <GameCard glow="secondary" style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label={metadata.title} tone="secondary" />
          <Badge label={languageLabels[selectedLanguage]} tone="primary" />
          <Badge label={`${categoryPhrases.length} Lines`} tone="accent" />
        </View>

        <Text style={styles.heroIcon}>{metadata.icon}</Text>
        <Text style={styles.heroTitle}>{metadata.title}</Text>
        <Text style={styles.heroSubtitle}>{metadata.description}</Text>

        <GameButton
          fullWidth
          onPress={() => navigation.navigate('Practice', { category })}
          title="Practice Category"
        />
      </GameCard>

      {categoryPhrases.map(item => {
        const translation = item.translations[selectedLanguage];
        const english = item.translations.en;
        const isFavorite = favoriteIds.includes(item.id);

        return (
          <GameCard
            key={item.id}
            glow={item.isToxic ? 'secondary' : 'primary'}
            style={styles.phraseCard}
            subtitle={selectedLanguage === 'en' ? english.meaning : english.text}
            title={translation.text}
          >
            <View style={styles.cardBadgeRow}>
              <Badge
                label={languageLabels[selectedLanguage]}
                tone={selectedLanguage === 'en' ? 'neutral' : 'primary'}
              />
              {item.isToxic ? <Badge label="Toxic" tone="danger" /> : null}
              {item.tags?.[0] ? (
                <Badge label={item.tags[0]} tone="accent" />
              ) : null}
            </View>

            <Text style={styles.meaning}>{translation.meaning}</Text>

            {selectedLanguage !== 'en' ? (
              <Text style={styles.supportLine}>English call: {english.text}</Text>
            ) : null}

            {translation.pronunciation ? (
              <Text style={styles.supportLine}>
                Pronunciation: {translation.pronunciation}
              </Text>
            ) : null}

            {item.saferAlternative ? (
              <View style={styles.altBox}>
                <Text style={styles.altLabel}>Safer Alternative</Text>
                <Text style={styles.altText}>{item.saferAlternative}</Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <View style={styles.actionCell}>
                <GameButton
                  fullWidth
                  onPress={() =>
                    navigation.navigate('Practice', {
                      category,
                      phraseId: item.id,
                    })
                  }
                  title="Practice"
                />
              </View>
              <View style={styles.actionCell}>
                <GameButton
                  fullWidth
                  onPress={() => toggleFavorite(item.id)}
                  title={isFavorite ? 'Saved' : 'Save'}
                  variant={isFavorite ? 'secondary' : 'danger'}
                />
              </View>
            </View>
          </GameCard>
        );
      })}

      {!categoryPhrases.length ? (
        <GameCard glow="secondary" title="No Phrases Yet">
          <Text style={styles.emptyText}>
            This category is mapped in the data model, but the live phrase pack
            has not been filled yet.
          </Text>
        </GameCard>
      ) : null}
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
  heroIcon: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  heroTitle: {
    ...theme.typography.title,
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
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
    marginBottom: theme.spacing.sm,
  },
  supportLine: {
    ...theme.typography.caption,
    marginBottom: theme.spacing.xs,
  },
  altBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  altLabel: {
    ...theme.typography.badgeLabel,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
  },
  altText: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
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
});

export default PhraseListScreen;
