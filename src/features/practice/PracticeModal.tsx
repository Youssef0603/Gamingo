import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

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
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />

        <View style={styles.cardWrap}>
          <SpeakingCard
            helperLabel={helperLabel}
            helperText={helperTranslation.text}
            isFavorite={isFavorite}
            locale={resolvePracticeLocale(learningLanguage)}
            onClose={onClose}
            onToggleFavorite={onToggleFavorite}
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
