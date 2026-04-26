import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryMetadata } from '../data/categories';
import { theme, withAlpha } from '../theme/theme';

import type { LanguageCode } from '../types/language';
import type { Phrase } from '../types/phrase';

type PhraseCardProps = {
  item: Phrase;
  language: LanguageCode;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

function PhraseCard({
  item,
  language,
  isFavorite,
  onPress,
  onToggleFavorite,
}: PhraseCardProps) {
  const translation = item.translations[language];
  const english = item.translations.en;
  const category = categoryMetadata[item.category];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.topRow}>
        <View style={styles.textWrap}>
          <Text style={styles.phrase}>{translation.text}</Text>
          <Text style={styles.translation}>English: {english.text}</Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={event => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={({ pressed }) => [
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonOn,
            pressed && styles.favoriteButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.favoriteText,
              isFavorite && styles.favoriteTextOn,
            ]}
          >
            {isFavorite ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {category.icon} {category.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  cardPressed: {
    backgroundColor: withAlpha(theme.colors.primary, 0.03),
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  phrase: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  translation: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  favoriteButton: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  favoriteButtonOn: {
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
    borderColor: withAlpha(theme.colors.accent, 0.24),
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  favoriteText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  favoriteTextOn: {
    color: theme.colors.accent,
  },
  bottomRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default PhraseCard;
