import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useAppState } from '../context/AppStateContext';
import { categoryMetadata } from '../data/categories';
import { phrases } from '../data/phrases';
import { GameButton, GameCard, Screen, Badge } from '../components/ui';
import { theme } from '../theme/theme';

import type { RootTabParamList, HomeScreenProps } from '../types/navigation';
import type { PhraseCategory } from '../types/phrase';

function HomeScreen({ navigation }: HomeScreenProps) {
  const { favoriteIds, selectedLanguage } = useAppState();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<RootTabParamList>>();

  const categories = (Object.keys(categoryMetadata) as PhraseCategory[]).map(
    category => ({
      category,
      metadata: categoryMetadata[category],
      phraseCount: phrases.filter(item => item.category === category).length,
    }),
  );

  return (
    <Screen scrollable>
      <GameCard glow="primary" style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge label="Gaming Phrase Lab" tone="primary" />
          <Badge label={`${favoriteIds.length} Saved`} tone="accent" />
        </View>

        <Text style={styles.title}>PlayCall</Text>
        <Text style={styles.subtitle}>
          Build sharp multiplayer comms with short callouts, strategy lines, and
          practice drills across 10 languages.
        </Text>

        <View style={styles.heroActionRow}>
          <View style={styles.heroAction}>
            <GameButton
              fullWidth
              onPress={() => tabNavigation?.navigate('PracticeTab')}
              title="Start Practice"
            />
          </View>
          <View style={styles.heroAction}>
            <GameButton
              fullWidth
              onPress={() => tabNavigation?.navigate('SettingsTab')}
              title={selectedLanguage.toUpperCase()}
              variant="secondary"
            />
          </View>
        </View>
      </GameCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Category Grid</Text>
        <Text style={styles.sectionSubtitle}>
          Open a phrase pack or scout upcoming content drops.
        </Text>
      </View>

      <View style={styles.grid}>
        {categories.map(({ category, metadata, phraseCount }, index) => {
          const isAvailable = phraseCount > 0;

          return (
            <View key={category} style={styles.gridCell}>
              <GameCard
                disabled={!isAvailable}
                glow={index % 2 === 0 ? 'primary' : 'secondary'}
                onPress={() =>
                  isAvailable
                    ? navigation.navigate('PhraseList', { category })
                    : undefined
                }
                style={styles.categoryCard}
                subtitle={metadata.description}
                title={metadata.title}
              >
                <View style={styles.categoryTopRow}>
                  <Text style={styles.categoryIcon}>{metadata.icon}</Text>
                  <Badge
                    label={
                      isAvailable ? `${phraseCount} Phrases` : 'Coming Soon'
                    }
                    tone={isAvailable ? 'accent' : 'neutral'}
                  />
                </View>
              </GameCard>
            </View>
          );
        })}
      </View>
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
    marginBottom: theme.spacing.lg,
  },
  title: {
    ...theme.typography.title,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  heroActionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  heroAction: {
    flex: 1,
  },
  sectionHeader: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    ...theme.typography.caption,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCell: {
    marginBottom: theme.spacing.lg,
    width: '48%',
  },
  categoryCard: {
    minHeight: 196,
  },
  categoryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryIcon: {
    color: theme.colors.textPrimary,
    fontSize: 30,
  },
});

export default HomeScreen;
