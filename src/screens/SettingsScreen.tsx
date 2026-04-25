import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../context/AppStateContext';
import { phrases } from '../data/phrases';
import { languageLabels, supportedLanguageCodes } from '../types/language';
import { Badge, GameCard, Screen } from '../components/ui';
import { theme } from '../theme/theme';

function SettingsScreen() {
  const { selectedLanguage, setSelectedLanguage } = useAppState();
  const previewPhrase = phrases[0];

  return (
    <Screen scrollable>
      <GameCard glow="secondary" style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label="Settings" tone="secondary" />
          <Badge label={`Current: ${selectedLanguage.toUpperCase()}`} tone="primary" />
        </View>

        <Text style={styles.title}>Language Loadout</Text>
        <Text style={styles.subtitle}>
          Choose the language used in phrase lists, favorites, and the practice
          arena.
        </Text>
      </GameCard>

      {supportedLanguageCodes.map(code => {
        const isSelected = code === selectedLanguage;
        const preview = previewPhrase.translations[code];

        return (
          <GameCard
            key={code}
            glow={isSelected ? 'primary' : 'secondary'}
            onPress={() => setSelectedLanguage(code)}
            style={styles.languageCard}
            subtitle={code.toUpperCase()}
            title={languageLabels[code]}
          >
            <View style={styles.cardBadgeRow}>
              <Badge
                label={isSelected ? 'Active' : 'Tap to Select'}
                tone={isSelected ? 'accent' : 'neutral'}
              />
            </View>

            <Text style={styles.previewText}>{preview.text}</Text>
            <Text style={styles.previewMeaning}>{preview.meaning}</Text>
          </GameCard>
        );
      })}
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
  languageCard: {
    marginBottom: theme.spacing.lg,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  previewText: {
    ...theme.typography.cardTitle,
    marginBottom: theme.spacing.xs,
  },
  previewMeaning: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
});

export default SettingsScreen;
