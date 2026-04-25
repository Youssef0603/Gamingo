import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Phrase } from '../types/phrase';

type PhraseCardProps = {
  item: Phrase;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

function PhraseCard({
  item,
  isFavorite,
  onPress,
  onToggleFavorite,
}: PhraseCardProps) {
  const english = item.translations.en;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.phrase}>{english.text}</Text>
        <Pressable
          hitSlop={10}
          onPress={event => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonOn]}
        >
          <Text style={styles.favoriteText}>{isFavorite ? 'Saved' : '+ Fav'}</Text>
        </Pressable>
      </View>

      {item.tags?.length ? (
        <Text style={styles.tags}>{item.tags.join(' • ')}</Text>
      ) : null}

      <Text style={styles.meaning}>{english.meaning}</Text>

      {item.saferAlternative ? (
        <View style={styles.responseBox}>
          <Text style={styles.responseLabel}>
            {item.isToxic ? 'Safer alternative' : 'Alternative'}
          </Text>
          <Text style={styles.responseText}>{item.saferAlternative}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141b34',
    borderColor: '#24304f',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    padding: 16,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  phrase: {
    color: '#f8fafc',
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    marginRight: 12,
    textTransform: 'capitalize',
  },
  favoriteButton: {
    backgroundColor: '#1d2746',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  favoriteButtonOn: {
    backgroundColor: '#0f766e',
  },
  favoriteText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
  },
  meaning: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  tags: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  responseBox: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    marginTop: 14,
    padding: 12,
  },
  responseLabel: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  responseText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
  },
});

export default PhraseCard;
