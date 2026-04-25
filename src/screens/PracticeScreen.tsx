import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import { phrases } from '../data/phrases';
import {
  SpeakingCard,
  getPracticeLevelProgress,
  resolvePracticeLocale,
} from '../features/practice';
import { languageLabels } from '../types/language';
import {
  Badge,
  GameButton,
  GameCard,
  ProgressBar,
  Screen,
} from '../components/ui';
import { theme } from '../theme/theme';

import type {
  PracticeStackScreenProps,
  PracticeTabScreenProps,
} from '../types/navigation';

type PracticeScreenProps =
  | PracticeStackScreenProps
  | PracticeTabScreenProps;

type PracticeScreenVariant = 'stack' | 'tab';

type Props = PracticeScreenProps & {
  variant: PracticeScreenVariant;
};

function PracticeScreen({ route, variant }: Props) {
  const {
    favoriteIds,
    practiceStats,
    recordPracticeAttempt,
    selectedLanguage,
    toggleFavorite,
  } = useAppState();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scopedCategory = route.params?.category;
  const scopedPhraseId = route.params?.phraseId;

  const practicePool = useMemo(() => {
    if (scopedCategory) {
      return phrases.filter(item => item.category === scopedCategory);
    }

    if (scopedPhraseId) {
      const scopedPhrase = phrases.find(item => item.id === scopedPhraseId);

      if (!scopedPhrase) {
        return phrases;
      }

      return phrases.filter(item => item.category === scopedPhrase.category);
    }

    return phrases;
  }, [scopedCategory, scopedPhraseId]);

  useEffect(() => {
    const nextIndex = practicePool.findIndex(item => item.id === scopedPhraseId);

    setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [practicePool, scopedPhraseId]);

  const currentPhrase = practicePool[currentIndex] ?? phrases[0];
  const translation = currentPhrase.translations[selectedLanguage];
  const english = currentPhrase.translations.en;
  const metadata = categoryMetadata[currentPhrase.category];
  const isFavorite = favoriteIds.includes(currentPhrase.id);
  const locale = resolvePracticeLocale(selectedLanguage);
  const levelProgress = getPracticeLevelProgress(practiceStats.xp);
  const sessionTitle = scopedCategory
    ? `${categoryMetadata[scopedCategory].title} Drill`
    : 'Practice Arena';

  const advancePractice = () => {
    setCurrentIndex(current =>
      current + 1 >= practicePool.length ? 0 : current + 1,
    );
  };

  return (
    <Screen
      edges={variant === 'stack' ? ['right', 'bottom', 'left'] : undefined}
      scrollable
    >
      {variant === 'tab' ? (
        <View style={styles.topSection}>
          <Text style={styles.screenTitle}>Practice</Text>
          <Text style={styles.screenSubtitle}>
            Repeat lines out loud, reveal the meaning, then roll into the next
            speaking rep.
          </Text>
        </View>
      ) : null}

      <GameCard glow="primary" style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label={sessionTitle} tone="primary" />
          <Badge label={languageLabels[selectedLanguage]} tone="secondary" />
          <Badge
            label={`${currentIndex + 1}/${practicePool.length}`}
            tone="accent"
          />
        </View>

        <Text style={styles.heroTitle}>{metadata.title}</Text>
        <Text style={styles.heroSubtitle}>
          {metadata.description} Keep the rhythm quick and the delivery clean.
        </Text>
      </GameCard>

      <GameCard glow="secondary" style={styles.phraseCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label={metadata.title} tone="secondary" />
          {currentPhrase.isToxic ? <Badge label="Toxic" tone="danger" /> : null}
          {isFavorite ? <Badge label="Saved" tone="accent" /> : null}
        </View>

        <Text style={styles.practiceLine}>{translation.text}</Text>

        {selectedLanguage !== 'en' ? (
          <Text style={styles.referenceLine}>English call: {english.text}</Text>
        ) : null}

        {translation.pronunciation ? (
          <Text style={styles.pronunciation}>
            Pronunciation: {translation.pronunciation}
          </Text>
        ) : null}
      </GameCard>

      <GameCard
        glow="primary"
        style={styles.progressCard}
        subtitle={`${levelProgress.xpToNextLevel} XP to Level ${levelProgress.level + 1}`}
        title="Rank Progress"
      >
        <View style={styles.progressHeader}>
          <View style={styles.progressStat}>
            <Text style={styles.progressValue}>LV {levelProgress.level}</Text>
            <Text style={styles.progressLabel}>Current Level</Text>
          </View>
          <View style={styles.progressStat}>
            <Text style={styles.progressValue}>{practiceStats.xp} XP</Text>
            <Text style={styles.progressLabel}>Total XP</Text>
          </View>
        </View>

        <ProgressBar progress={levelProgress.progress} />

        <Text style={styles.progressCopy}>
          {levelProgress.currentLevelXp}/{levelProgress.xpRequiredForNextLevel} XP
          in this level
        </Text>

        <View style={styles.sessionStatsRow}>
          <View style={styles.sessionStatCard}>
            <Text style={styles.sessionStatValue}>
              {practiceStats.correctPronunciations}
            </Text>
            <Text style={styles.sessionStatLabel}>Correct</Text>
          </View>
          <View style={styles.sessionStatCard}>
            <Text style={styles.sessionStatValue}>{practiceStats.streak}</Text>
            <Text style={styles.sessionStatLabel}>Streak</Text>
          </View>
          <View style={styles.sessionStatCard}>
            <Text style={styles.sessionStatValue}>
              {practiceStats.totalPracticed}
            </Text>
            <Text style={styles.sessionStatLabel}>Practiced</Text>
          </View>
        </View>
      </GameCard>

      <SpeakingCard
        locale={locale}
        meaning={translation.meaning}
        onAttemptComplete={feedback => recordPracticeAttempt(feedback.label)}
        phrase={translation.text}
        pronunciation={translation.pronunciation}
      />

      {currentPhrase.saferAlternative ? (
        <GameCard glow="secondary" subtitle="Safer comms option" title="Meaning Intel">
          <Text style={styles.meaningText}>{currentPhrase.saferAlternative}</Text>
        </GameCard>
      ) : null}

      <GameCard glow="primary" subtitle="Focus cues for this line" title="Coach Notes">
        <View style={styles.tagRow}>
          {currentPhrase.tags?.map(tag => (
            <Badge key={tag} label={tag} tone="neutral" />
          ))}
        </View>
      </GameCard>

      <View style={styles.actionRow}>
        <View style={styles.actionCell}>
          <GameButton
            fullWidth
            onPress={() => toggleFavorite(currentPhrase.id)}
            title={isFavorite ? 'Saved' : 'Save'}
            variant={isFavorite ? 'secondary' : 'primary'}
          />
        </View>
        <View style={styles.actionCell}>
          <GameButton
            fullWidth
            onPress={advancePractice}
            title="Next Phrase"
            variant="secondary"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topSection: {
    marginBottom: theme.spacing.xl,
  },
  screenTitle: {
    ...theme.typography.title,
    marginBottom: theme.spacing.xs,
  },
  screenSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  heroCard: {
    marginBottom: theme.spacing.lg,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  heroTitle: {
    ...theme.typography.title,
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  phraseCard: {
    marginBottom: theme.spacing.lg,
  },
  progressCard: {
    marginBottom: theme.spacing.lg,
  },
  practiceLine: {
    ...theme.typography.title,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: theme.spacing.md,
  },
  referenceLine: {
    ...theme.typography.caption,
    marginBottom: theme.spacing.xs,
  },
  pronunciation: {
    ...theme.typography.caption,
    color: theme.colors.accent,
  },
  progressHeader: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  progressStat: {
    flex: 1,
  },
  progressValue: {
    ...theme.typography.title,
    fontSize: 22,
    marginBottom: theme.spacing.xs,
  },
  progressLabel: {
    ...theme.typography.caption,
  },
  progressCopy: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  sessionStatCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    padding: theme.spacing.md,
  },
  sessionStatValue: {
    ...theme.typography.sectionTitle,
    color: theme.colors.accent,
    fontSize: 18,
    marginBottom: theme.spacing.xs,
  },
  sessionStatLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  meaningText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  actionCell: {
    flex: 1,
  },
});

export default PracticeScreen;
