import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './ui';
import { categoryMetadata } from '../data/categories';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';
import { getPhraseDisplayLanguages, getPhraseDisplayTranslations } from '../utils/phraseDisplay';

import type { LanguageCode } from '../types/language';
import type { Phrase } from '../types/phrase';

type PhraseCardProps = {
  helperLanguage: LanguageCode;
  item: Phrase;
  language: LanguageCode;
  isFavorite: boolean;
  onDelete?: () => void;
  onPress: () => void;
  onToggleFavorite: () => void;
};

function PhraseCard({
  helperLanguage,
  item,
  language,
  isFavorite,
  onDelete,
  onPress,
  onToggleFavorite,
}: PhraseCardProps) {
  const { helperLanguage: resolvedHelperLanguage, helperTranslation, translation } =
    getPhraseDisplayTranslations(item, helperLanguage, language);
  const { learning: savedLearningLanguage, native: savedNativeLanguage } =
    getPhraseDisplayLanguages(item, helperLanguage, language);
  const helperLanguageLabel = languageMetadata[resolvedHelperLanguage].label;
  const category = categoryMetadata[item.category];
  const showCustomLanguages =
    item.category === 'custom' && Boolean(item.customLanguages);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.textWrap}>
          <Text style={styles.phrase}>{translation.text}</Text>
          {showCustomLanguages ? (
            <Text style={styles.languageSummary}>
              {languageMetadata[savedNativeLanguage].label} {'->'}{' '}
              {languageMetadata[savedLearningLanguage].label}
            </Text>
          ) : null}
          <Text style={styles.translation}>
            {helperLanguageLabel}: {helperTranslation.text}
          </Text>
        </View>
        <View style={styles.actionRow}>
          {onDelete ? (
            <Pressable
              hitSlop={10}
              onPress={event => {
                event.stopPropagation();
                onDelete();
              }}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.favoriteButtonPressed,
              ]}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ) : null}

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
            <Icon
              color={isFavorite ? theme.colors.accent : theme.colors.primary}
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
            />
          </Pressable>
        </View>
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
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
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
  languageSummary: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  favoriteButton: {
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  favoriteButtonOn: {
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
    borderColor: withAlpha(theme.colors.accent, 0.24),
  },
  favoriteButtonPressed: {
    opacity: 0.85,
  },
  deleteButton: {
    backgroundColor: withAlpha(theme.colors.danger ?? '#D14D4D', 0.08),
    borderColor: withAlpha(theme.colors.danger ?? '#D14D4D', 0.2),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteText: {
    color: theme.colors.danger ?? '#D14D4D',
    fontSize: 12,
    fontWeight: '600',
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
