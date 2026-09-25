import React, { useCallback, useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { stop as stopSpeechRecognition, stopSpeaking } from '../../services';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  getPhraseAnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { theme, withAlpha } from '../../theme/theme';
import { languageMetadata } from '../../types/language';
import { getPhraseDisplayTranslations } from '../../utils/phraseDisplay';
import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';
import { resolvePracticeLocale } from './practiceUtils';
import SpeakingCard from './SpeakingCard';

type PracticeModalProps = {
  helperLanguage: LanguageCode;
  visible: boolean;
  phrase: Phrase | null;
  language: LanguageCode;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
};

function PracticeModal({
  helperLanguage,
  visible,
  phrase,
  language,
  isFavorite,
  onClose,
  onToggleFavorite,
}: PracticeModalProps) {
  const handleClose = useCallback(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.PHRASE_MODAL_CLOSED, {
      ...getPhraseAnalyticsParams(phrase, helperLanguage, language),
      [ANALYTICS_PARAMS.MODAL]: 'practice_phrase',
      [ANALYTICS_PARAMS.PRACTICE_MODE]: 'single',
    }).catch(() => undefined);

    Promise.allSettled([
      stopSpeaking(),
      stopSpeechRecognition(),
    ]).finally(() => {
      onClose();
    });
  }, [helperLanguage, language, onClose, phrase]);

  useEffect(() => {
    if (!visible || !phrase) {
      return;
    }

    trackAnalyticsEvent(ANALYTICS_EVENTS.PHRASE_MODAL_OPENED, {
      ...getPhraseAnalyticsParams(phrase, helperLanguage, language),
      [ANALYTICS_PARAMS.IS_FAVORITE]: isFavorite ? 'true' : 'false',
      [ANALYTICS_PARAMS.MODAL]: 'practice_phrase',
      [ANALYTICS_PARAMS.PRACTICE_MODE]: 'single',
    }).catch(() => undefined);
  }, [helperLanguage, isFavorite, language, phrase, visible]);

  // Memoized so identity stays stable across re-renders that don't change
  // the underlying phrase (e.g. toggling favorite) — SpeakingCard's
  // auto-play effect depends on this transitively via usePractice, and an
  // unstable reference here would replay the phrase's audio on every
  // unrelated prop change.
  const analyticsContext = useMemo(
    () => ({
      ...getPhraseAnalyticsParams(phrase, helperLanguage, language),
      [ANALYTICS_PARAMS.MODAL]: 'practice_phrase',
      [ANALYTICS_PARAMS.PRACTICE_MODE]: 'single',
    }),
    [helperLanguage, language, phrase],
  );

  if (!phrase) {
    return null;
  }

  const {
    helperLanguage: resolvedHelperLanguage,
    helperTranslation,
    learningLanguage,
    translation,
  } = getPhraseDisplayTranslations(phrase, helperLanguage, language);
  const helperLabel = languageMetadata[resolvedHelperLanguage].label;

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={handleClose} style={styles.backdrop} />

        <View style={styles.cardWrap}>
          <SpeakingCard
            helperLabel={helperLabel}
            helperText={helperTranslation.text}
            isFavorite={isFavorite}
            key={phrase.id}
            languageCode={learningLanguage}
            locale={resolvePracticeLocale(learningLanguage)}
            analyticsContext={analyticsContext}
            onClose={handleClose}
            onToggleFavorite={onToggleFavorite}
            phraseId={phrase.category === 'custom' ? undefined : phrase.id}
            phrase={translation.text}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  backdrop: {
    backgroundColor: withAlpha(theme.colors.text, 0.18),
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardWrap: {
    maxWidth: 520,
    width: '100%',
  },
});

export default PracticeModal;
