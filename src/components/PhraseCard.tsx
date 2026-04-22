import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PhraseItem } from '../types/phrase';

type PhraseCardProps = {
  item: PhraseItem;
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
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.phrase}>{item.phrase}</Text>
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
      <Text style={styles.meaning}>{item.meaning}</Text>
      {item.betterResponse ? (
        <View style={styles.responseBox}>
          <Text style={styles.responseLabel}>Better response</Text>
          <Text style={styles.responseText}>{item.betterResponse}</Text>
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
