import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PhraseCard from '../../components/PhraseCard';
import { Icon } from '../../components/ui';
import { buildTranslatedCustomPhrase } from '../../services';
import { theme, withAlpha } from '../../theme/theme';
import { languageMetadata } from '../../types/language';

import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';

type AddPhraseModalProps = {
  visible: boolean;
  language: LanguageCode;
  helperLanguage: LanguageCode;
  isFavorite: (phraseId: string, language?: LanguageCode) => boolean;
  onAddPhrase: (phrase: Phrase) => void;
  onClose: () => void;
  onOpenPhrase: (phraseId: string) => void;
  phrases: Phrase[];
};

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function findPhraseByQuery(query: string, phrases: Phrase[]) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return null;
  }

  return (
    phrases.find(phrase =>
      Object.values(phrase.translations).some(translation => {
        if (!translation) {
          return false;
        }

        return normalizeLookupValue(translation.text) === normalizedQuery;
      }),
    ) ?? null
  );
}

function AddPhraseModal({
  visible,
  language,
  helperLanguage,
  isFavorite,
  onAddPhrase,
  onClose,
  onOpenPhrase,
  phrases,
}: AddPhraseModalProps) {
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Phrase | null>(null);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSource, setLookupSource] = useState<'api' | 'data' | null>(null);

  const isFoundPhraseSaved = useMemo(
    () => (lookupResult ? isFavorite(lookupResult.id, language) : false),
    [isFavorite, language, lookupResult],
  );

  const handleClose = () => {
    setLookupQuery('');
    setLookupResult(null);
    setLookupFeedback(null);
    onClose();
  };

  const handleLookup = async () => {
    const trimmedQuery = lookupQuery.trim();

    if (!trimmedQuery) {
      setLookupResult(null);
      setLookupFeedback('Type a word or phrase first.');
      return;
    }

    const phraseMatch = findPhraseByQuery(trimmedQuery, phrases);

    if (phraseMatch) {
      setLookupResult(phraseMatch);
      setLookupFeedback(null);
      setLookupSource('data');
      return;
    }

    setIsLookingUp(true);

    try {
      const translatedPhrase = await buildTranslatedCustomPhrase({
        destinationLanguage: language,
        text: trimmedQuery,
      });

      setLookupResult(translatedPhrase);
      setLookupFeedback(null);
      setLookupSource('api');
    } catch (error) {
      setLookupResult(null);
      setLookupSource(null);
      setLookupFeedback(
        error instanceof Error
          ? error.message
          : 'Could not translate that phrase right now.',
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAddPhrase = () => {
    if (!lookupResult || isFoundPhraseSaved) {
      return;
    }

    onAddPhrase(lookupResult);
    handleClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <Pressable onPress={handleClose} style={styles.modalBackdrop} />

        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add phrase</Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Icon color={theme.colors.mutedText} name="close" size={18} />
            </Pressable>
          </View>

          <Text style={styles.lookupHint}>
            Type a phrase that already exists in your app data and add its{' '}
            {languageMetadata[language].label} version to favourites.
          </Text>

          <TextInput
            autoCapitalize="sentences"
            onChangeText={text => {
              setLookupQuery(text);
              if (lookupFeedback) {
                setLookupFeedback(null);
              }
              if (lookupSource) {
                setLookupSource(null);
              }
            }}
            onSubmitEditing={handleLookup}
            placeholder="Try: Behind you!"
            placeholderTextColor={theme.colors.mutedText}
            style={styles.lookupInput}
            value={lookupQuery}
          />

          <Pressable
            onPress={handleLookup}
            style={({ pressed }) => [
              styles.lookupAction,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.lookupActionText}>
              {isLookingUp ? 'Checking...' : 'Find'}
            </Text>
          </Pressable>

          {lookupFeedback ? (
            <Text style={styles.lookupFeedback}>{lookupFeedback}</Text>
          ) : null}

          {lookupResult ? (
            <View style={styles.lookupResult}>
              <Text style={styles.lookupResultLabel}>Found in your data</Text>
              {lookupSource === 'api' ? (
                <Text style={styles.lookupApiLabel}>Translated with API</Text>
              ) : null}
              <PhraseCard
                helperLanguage={helperLanguage}
                isFavorite={isFoundPhraseSaved}
                item={lookupResult}
                language={language}
                onPress={() => onOpenPhrase(lookupResult.id)}
                onToggleFavorite={() => {
                  if (!isFoundPhraseSaved) {
                    onAddPhrase(lookupResult);
                  }
                }}
              />

              <Pressable
                disabled={isFoundPhraseSaved}
                onPress={handleAddPhrase}
                style={({ pressed }) => [
                  styles.addResultButton,
                  isFoundPhraseSaved && styles.addResultButtonDisabled,
                  pressed && !isFoundPhraseSaved && styles.buttonPressed,
                ]}
              >
                <Text style={styles.addResultButtonText}>
                  {isFoundPhraseSaved ? 'Already added' : 'Add to favourites'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalBackdrop: {
    backgroundColor: withAlpha(theme.colors.text, 0.18),
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    maxWidth: 520,
    padding: theme.spacing.lg,
    width: '100%',
    ...theme.shadows.card,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  lookupHint: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.sm,
  },
  lookupInput: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  lookupAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  lookupActionText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700',
  },
  lookupFeedback: {
    color: theme.colors.mutedText,
    fontSize: 13,
    marginTop: theme.spacing.sm,
  },
  lookupResult: {
    marginTop: theme.spacing.md,
  },
  lookupResultLabel: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  lookupApiLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    marginBottom: theme.spacing.sm,
  },
  addResultButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  addResultButtonDisabled: {
    backgroundColor: withAlpha(theme.colors.accent, 0.2),
  },
  addResultButtonText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AddPhraseModal;
