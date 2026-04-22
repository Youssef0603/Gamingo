import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BackButton from '../components/BackButton';
import ScreenContainer from '../components/ScreenContainer';

import type { PhraseItem } from '../types/phrase';

type PhraseDetailScreenProps = {
  phrase: PhraseItem;
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
};

function PhraseDetailScreen({
  phrase,
  isFavorite,
  onBack,
  onToggleFavorite,
}: PhraseDetailScreenProps) {
  return (
    <ScreenContainer>
      <BackButton onPress={onBack} />
      <View style={styles.header}>
        <Text style={styles.title}>{phrase.phrase}</Text>
        <Pressable onPress={onToggleFavorite}>
          <Text style={styles.favoriteAction}>
            {isFavorite ? 'Saved to favorites' : 'Add to favorites'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Meaning</Text>
        <Text style={styles.body}>{phrase.meaning}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>When to use it</Text>
        <Text style={styles.body}>{phrase.whenToUse}</Text>
      </View>

      {phrase.betterResponse ? (
        <View style={styles.section}>
          <Text style={styles.label}>Better response</Text>
          <Text style={styles.body}>{phrase.betterResponse}</Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  favoriteAction: {
    color: '#7dd3fc',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  label: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  body: {
    color: '#e2e8f0',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default PhraseDetailScreen;
