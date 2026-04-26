import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { theme, withAlpha } from '../../theme/theme';
import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';
import { resolvePracticeLocale } from './practiceUtils';
import SpeakingCard from './SpeakingCard';

type PracticeModalProps = {
  visible: boolean;
  phrase: Phrase | null;
  language: LanguageCode;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
};

function PracticeModal({
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

  const translation = phrase.translations[language];
  const english = phrase.translations.en;

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
            englishText={english.text}
            isFavorite={isFavorite}
            locale={resolvePracticeLocale(language)}
            onClose={onClose}
            onToggleFavorite={onToggleFavorite}
            phrase={translation.text}
            pronunciation={translation.pronunciation}
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
