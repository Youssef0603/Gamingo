import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CardPressable, Icon } from './ui';
import { categoryMetadata } from '../data/categories';
import { theme, withAlpha } from '../theme/theme';
import { languageMetadata } from '../types/language';
import { getPhraseDisplayLanguages, getPhraseDisplayTranslations } from '../utils/phraseDisplay';

import type { LanguageCode } from '../types/language';
import type { Phrase } from '../types/phrase';

const androidCardTextStyle = Platform.select({
  android: {
    includeFontPadding: true,
  },
  default: {},
});

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
    <CardPressable
      containerStyle={styles.cardShell}
      contentStyle={styles.card}
      onPress={onPress}
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
    </CardPressable>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.lg,
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
    ...androidCardTextStyle,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: Platform.OS === 'android' ? 28 : 24,
    marginBottom: theme.spacing.xs,
  },
  translation: {
    ...theme.typography.caption,
    ...androidCardTextStyle,
    color: theme.colors.mutedText,
    lineHeight: Platform.OS === 'android' ? 20 : theme.typography.caption.lineHeight,
  },
  languageSummary: {
    ...androidCardTextStyle,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: Platform.OS === 'android' ? 18 : 16,
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
    transform: [{ scale: 0.96 }],
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
