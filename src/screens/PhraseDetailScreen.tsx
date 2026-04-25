import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import BackButton from '../components/BackButton';
import ScreenContainer from '../components/ScreenContainer';
import {
  languageLabels,
  supportedLanguageCodes,
} from '../types/language';

import type { Phrase } from '../types/phrase';

type PhraseDetailScreenProps = {
  phrase: Phrase;
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
  const english = phrase.translations.en;

  return (
    <ScreenContainer>
      <BackButton onPress={onBack} />
      <View style={styles.header}>
        <Text style={styles.title}>{english.text}</Text>
        <Pressable onPress={onToggleFavorite}>
          <Text style={styles.favoriteAction}>
            {isFavorite ? 'Saved to favorites' : 'Add to favorites'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Meaning</Text>
        <Text style={styles.body}>{english.meaning}</Text>
      </View>

      {phrase.tags?.length ? (
        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
          <Text style={styles.body}>{phrase.tags.join(' • ')}</Text>
        </View>
      ) : null}

      {phrase.saferAlternative ? (
        <View style={styles.section}>
          <Text style={styles.label}>Safer Alternative</Text>
          <Text style={styles.body}>{phrase.saferAlternative}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.label}>Translations</Text>
        {supportedLanguageCodes.map(code => {
          const translation = phrase.translations[code];

          return (
            <View key={code} style={styles.translationBlock}>
              <Text style={styles.translationLanguage}>{languageLabels[code]}</Text>
              <Text style={styles.translationText}>{translation.text}</Text>
              <Text style={styles.translationMeaning}>{translation.meaning}</Text>
              {translation.pronunciation ? (
                <Text style={styles.pronunciation}>
                  Pronunciation: {translation.pronunciation}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
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
  translationBlock: {
    borderBottomColor: '#24304f',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  translationLanguage: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  translationText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  translationMeaning: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  pronunciation: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
  },
});

export default PhraseDetailScreen;
