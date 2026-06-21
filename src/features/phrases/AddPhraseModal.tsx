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
import { categoryMetadata } from '../../data/categories';
import { showAdBeforeCustomWordAdd } from '../ads/mobileAds';
import {
  buildTranslatedCustomPhrase,
  findWordBankMatch,
  translateTextWithDetectedSource,
} from '../../services';
import { theme, withAlpha } from '../../theme/theme';
import { languageMetadata } from '../../types/language';
import {
  getPhraseDisplayLanguages,
  getPhraseDisplayTranslations,
} from '../../utils/phraseDisplay';

import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';

type SharedAddPhraseModalProps = {
  visible: boolean;
  phrases: Phrase[];
  language: LanguageCode;
  onClose: () => void;
};

type FavoritesAddPhraseModalProps = SharedAddPhraseModalProps & {
  mode: 'favorites';
  helperLanguage: LanguageCode;
  isFavorite: (phraseId: string, language?: LanguageCode) => boolean;
  onAddPhrase: (phrase: Phrase) => void;
  onOpenPhrase: (phraseId: string) => void;
};

type CustomAddPhraseModalProps = SharedAddPhraseModalProps & {
  mode: 'custom';
  inputLanguage: LanguageCode;
  onCreatePhrase: (nativeText: string, learningText: string) => Phrase;
  onSeePhrase: (phrase: Phrase) => void;
};

type AddPhraseModalProps =
  | FavoritesAddPhraseModalProps
  | CustomAddPhraseModalProps;

function normalizeLookupValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function findPhraseByAnyTranslation(query: string, phrases: Phrase[]) {
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

function findPhrasesByQuery(
  phraseList: Phrase[],
  query: string,
  language: LanguageCode,
) {
  const normalizedQuery = normalizeLookupValue(query);

  if (!normalizedQuery) {
    return [];
  }

  return phraseList.filter(phrase => {
    const translation = phrase.translations[language] ?? phrase.translations.en;

    return normalizeLookupValue(translation.text) === normalizedQuery;
  });
}

function findBlockingPhraseForCustomCreate(
  phraseList: Phrase[],
  query: string,
  inputLanguage: LanguageCode,
  learningLanguage: LanguageCode,
) {
  const phraseMatches = findPhrasesByQuery(phraseList, query, inputLanguage);

  if (phraseMatches.length === 0) {
    return null;
  }

  const nonCustomMatch =
    phraseMatches.find(phrase => phrase.category !== 'custom') ?? null;

  if (nonCustomMatch) {
    return nonCustomMatch;
  }

  const sameLanguageCustomMatch =
    phraseMatches.find(
      phrase =>
        phrase.category === 'custom' &&
        phrase.customLanguages?.native === inputLanguage &&
        phrase.customLanguages.learning === learningLanguage,
    ) ?? null;

  if (sameLanguageCustomMatch) {
    return sameLanguageCustomMatch;
  }

  const legacyCustomMatch =
    phraseMatches.find(
      phrase => phrase.category === 'custom' && !phrase.customLanguages,
    ) ?? null;

  if (legacyCustomMatch) {
    return legacyCustomMatch;
  }

  return null;
}

function AddPhraseModal(props: AddPhraseModalProps) {
  const { visible, phrases, language, onClose } = props;
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<Phrase | null>(null);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupSource, setLookupSource] = useState<'api' | 'data' | null>(null);
  const isFavoritesMode = props.mode === 'favorites';

  const isFoundPhraseSaved = useMemo(
    () =>
      isFavoritesMode && lookupResult
        ? props.isFavorite(lookupResult.id, language)
        : false,
    [isFavoritesMode, language, lookupResult, props],
  );

  const existingPhraseDisplay = useMemo(
    () =>
      !isFavoritesMode && lookupResult
        ? getPhraseDisplayTranslations(
            lookupResult,
            props.inputLanguage,
            language,
          )
        : null,
    [isFavoritesMode, language, lookupResult, props],
  );

  const resetState = () => {
    setLookupQuery('');
    setLookupResult(null);
    setLookupFeedback(null);
    setLookupSource(null);
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedQuery = lookupQuery.trim();

    if (!trimmedQuery) {
      setLookupResult(null);
      setLookupSource(null);
      setLookupFeedback(
        isFavoritesMode
          ? 'Type a word or phrase first.'
          : `Type a word in ${
              languageMetadata[props.inputLanguage].label
            } first.`,
      );
      return;
    }

    if (isFavoritesMode) {
      const phraseMatch = findPhraseByAnyTranslation(trimmedQuery, phrases);

      if (phraseMatch) {
        setLookupResult(phraseMatch);
        setLookupFeedback(null);
        setLookupSource('data');
        return;
      }

      setIsSubmitting(true);

      try {
        const translatedPhrase = await buildTranslatedCustomPhrase({
          destinationLanguage: language,
          sourceLanguage: props.helperLanguage,
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
        setIsSubmitting(false);
      }

      return;
    }

    const phraseMatch = findBlockingPhraseForCustomCreate(
      phrases,
      trimmedQuery,
      props.inputLanguage,
      language,
    );

    if (phraseMatch) {
      setLookupResult(phraseMatch);
      setLookupSource('data');
      setLookupFeedback(
        `This word already exists in ${
          categoryMetadata[phraseMatch.category].title
        }.`,
      );
      return;
    }

    const wordBankMatch = findWordBankMatch({
      destinationLanguage: language,
      sourceLanguage: props.inputLanguage,
      text: trimmedQuery,
    });

    if (wordBankMatch) {
      if (wordBankMatch.recommendedAction === 'block_do_not_translate') {
        setLookupResult(null);
        setLookupSource(null);
        setLookupFeedback(
          'This term is in the moderation word bank and is not translated automatically.',
        );
        return;
      }

      showAdBeforeCustomWordAdd(() => {
        const createdPhrase = props.onCreatePhrase(
          trimmedQuery,
          wordBankMatch.destinationText,
        );

        resetState();
        onClose();
        props.onSeePhrase(createdPhrase);
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setLookupFeedback(
        `Translating into ${languageMetadata[language].label}...`,
      );

      const translationResult = await translateTextWithDetectedSource({
        destinationLanguage: language,
        sourceLanguage: props.inputLanguage,
        text: trimmedQuery,
      });

      showAdBeforeCustomWordAdd(() => {
        const createdPhrase = props.onCreatePhrase(
          trimmedQuery,
          translationResult.destinationText,
        );

        resetState();
        onClose();
        props.onSeePhrase(createdPhrase);
      });
    } catch (error) {
      setLookupResult(null);
      setLookupSource(null);
      setLookupFeedback(
        error instanceof Error && error.name === 'AbortError'
          ? "Couldn't translate this word right now. The request timed out."
          : error instanceof Error
          ? `Couldn't translate this word right now. ${error.message}`
          : "Couldn't translate this word right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isFavoritesMode ? 'Add phrase' : 'Add word';
  const hint = isFavoritesMode
    ? `Type a phrase that already exists in your app data and add its ${languageMetadata[language].label} version to favourites.`
    : `Type a word in your native language (${
        languageMetadata[props.inputLanguage].label
      }).`;
  const placeholder = isFavoritesMode
    ? 'Try: Behind you!'
    : `Type a word in ${languageMetadata[props.inputLanguage].label}`;
  const buttonLabel = isFavoritesMode
    ? isSubmitting
      ? 'Checking...'
      : 'Find'
    : isSubmitting
    ? 'Translating...'
    : 'Add';

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
            <Text style={styles.modalTitle}>{title}</Text>
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

          <Text style={styles.lookupHint}>{hint}</Text>

          <TextInput
            autoCapitalize={isFavoritesMode ? 'sentences' : 'none'}
            editable={!isSubmitting}
            onChangeText={text => {
              if (isSubmitting) {
                return;
              }

              setLookupQuery(text);
              if (lookupResult) {
                setLookupResult(null);
              }
              if (lookupFeedback) {
                setLookupFeedback(null);
              }
              if (lookupSource) {
                setLookupSource(null);
              }
            }}
            onSubmitEditing={handleSubmit}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.mutedText}
            style={styles.lookupInput}
            value={lookupQuery}
          />

          <Pressable
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.lookupAction,
              isSubmitting && styles.lookupActionDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.lookupActionText}>{buttonLabel}</Text>
          </Pressable>

          {lookupFeedback ? (
            <Text
              style={[
                styles.lookupFeedback,
                !isFavoritesMode &&
                  lookupResult &&
                  styles.lookupFeedbackHighlight,
              ]}
            >
              {lookupFeedback}
            </Text>
          ) : null}

          {isFavoritesMode && lookupResult ? (
            <View style={styles.lookupResult}>
              <Text style={styles.lookupResultLabel}>
                {lookupSource === 'api'
                  ? 'Translated with API'
                  : 'Found in your data'}
              </Text>
              <PhraseCard
                helperLanguage={props.helperLanguage}
                isFavorite={isFoundPhraseSaved}
                item={lookupResult}
                language={language}
                onPress={() => {
                  if (lookupSource === 'data') {
                    props.onOpenPhrase(lookupResult.id);
                  }
                }}
                onToggleFavorite={() => {
                  if (!isFoundPhraseSaved) {
                    props.onAddPhrase(lookupResult);
                  }
                }}
              />

              <Pressable
                disabled={isFoundPhraseSaved}
                onPress={() => {
                  if (isFoundPhraseSaved) {
                    return;
                  }

                  props.onAddPhrase(lookupResult);
                  handleClose();
                }}
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

          {!isFavoritesMode && lookupResult && existingPhraseDisplay ? (
            <View style={styles.lookupResult}>
              <Text style={styles.lookupResultLabel}>Existing word</Text>
              <View style={styles.lookupResultCard}>
                <Text style={styles.lookupResultWord}>
                  {existingPhraseDisplay.helperTranslation.text}
                </Text>
                <Text style={styles.lookupResultCategory}>
                  {categoryMetadata[lookupResult.category].title}
                </Text>
                {lookupResult.category === 'custom' &&
                lookupResult.customLanguages ? (
                  <Text style={styles.lookupResultSavedLanguages}>
                    {
                      languageMetadata[
                        getPhraseDisplayLanguages(
                          lookupResult,
                          props.inputLanguage,
                          language,
                        ).native
                      ].label
                    }{' '}
                    {'->'}{' '}
                    {
                      languageMetadata[
                        getPhraseDisplayLanguages(
                          lookupResult,
                          props.inputLanguage,
                          language,
                        ).learning
                      ].label
                    }
                  </Text>
                ) : null}
                <Text style={styles.lookupResultHelper}>
                  {
                    languageMetadata[existingPhraseDisplay.learningLanguage]
                      .label
                  }
                  : {existingPhraseDisplay.translation.text}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  handleClose();
                  props.onSeePhrase(lookupResult);
                }}
                style={({ pressed }) => [
                  styles.addResultButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.addResultButtonText}>See it</Text>
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
    marginBottom: theme.spacing.md,
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
  lookupActionDisabled: {
    opacity: 0.7,
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
  lookupFeedbackHighlight: {
    color: theme.colors.primary,
  },
  lookupResult: {
    marginTop: theme.spacing.md,
  },
  lookupResultCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  lookupResultLabel: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  lookupResultWord: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  lookupResultCategory: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  lookupResultSavedLanguages: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  lookupResultHelper: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
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
    opacity: 0.55,
  },
  addResultButtonText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default AddPhraseModal;
