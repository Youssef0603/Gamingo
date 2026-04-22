import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CategoryCard from '../components/CategoryCard';
import ScreenContainer from '../components/ScreenContainer';
import { categoryDescriptions } from '../data/phrases';

import type { PhraseCategory } from '../types/phrase';

type HomeScreenProps = {
  onOpenCategory: (category: PhraseCategory) => void;
  onOpenFavorites: () => void;
};

function HomeScreen({ onOpenCategory, onOpenFavorites }: HomeScreenProps) {
  return (
    <ScreenContainer>
      <Text style={styles.title}>PlayCall</Text>
      <Text style={styles.subtitle}>Learn team communication for games</Text>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Quick practice</Text>
        <Text style={styles.heroTitle}>Short callouts. Better teamwork.</Text>
        <Text style={styles.heroText}>
          Browse a small set of phrases used in competitive matches and learn
          when to say them.
        </Text>
      </View>

      <CategoryCard
        title="Basic Phrases"
        description={categoryDescriptions.basic}
        onPress={() => onOpenCategory('basic')}
      />
      <CategoryCard
        title="Objectives"
        description={categoryDescriptions.objectives}
        onPress={() => onOpenCategory('objectives')}
      />
      <CategoryCard
        title="Toxic Phrases"
        description={categoryDescriptions.toxic}
        onPress={() => onOpenCategory('toxic')}
      />
      <CategoryCard
        title="Favorites"
        description="Review the phrases you saved for quick practice."
        onPress={onOpenFavorites}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#f8fafc',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 24,
  },
  hero: {
    backgroundColor: '#111a33',
    borderColor: '#24304f',
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 24,
    padding: 20,
  },
  heroEyebrow: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
});

export default HomeScreen;
