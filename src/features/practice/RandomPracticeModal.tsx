import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '../../components/ui';
import { theme, withAlpha } from '../../theme/theme';
import { languageMetadata } from '../../types/language';
import { getPhraseDisplayTranslations } from '../../utils/phraseDisplay';
import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';
import { resolvePracticeLocale } from './practiceUtils';
import SpeakingCard from './SpeakingCard';

const SUCCESS_ADVANCE_DELAY_MS = 950;

type RandomPracticeModalProps = {
  helperLanguage: LanguageCode;
  isFavorite: (phraseId: string) => boolean;
  language: LanguageCode;
  onClose: () => void;
  onRestart: () => void;
  onToggleFavorite: (phraseId: string) => void;
  phrases: Phrase[];
  sessionId: number;
  visible: boolean;
};

function RandomPracticeModal({
  helperLanguage,
  isFavorite,
  language,
  onClose,
  onRestart,
  onToggleFavorite,
  phrases,
  sessionId,
  visible,
}: RandomPracticeModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAdvanceTimeout = useCallback(() => {
    if (!advanceTimeoutRef.current) {
      return;
    }

    clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    clearAdvanceTimeout();
    setCurrentIndex(0);
  }, [clearAdvanceTimeout, sessionId, visible]);

  useEffect(() => () => {
    clearAdvanceTimeout();
  }, [clearAdvanceTimeout]);

  const handleClose = useCallback(() => {
    clearAdvanceTimeout();
    onClose();
  }, [clearAdvanceTimeout, onClose]);

  const handleSuccessfulAttempt = useCallback(() => {
    if (advanceTimeoutRef.current) {
      return;
    }

    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      setCurrentIndex(previousIndex => previousIndex + 1);
    }, SUCCESS_ADVANCE_DELAY_MS);
  }, []);

  if (!visible || phrases.length === 0) {
    return null;
  }

  const isComplete = currentIndex >= phrases.length;
  const activePhrase = isComplete ? null : phrases[currentIndex];
  const activePhraseTranslations = activePhrase
    ? getPhraseDisplayTranslations(activePhrase, helperLanguage, language)
    : null;
  const progressRatio = isComplete
    ? 1
    : Math.min((currentIndex + 1) / phrases.length, 1);

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={handleClose} style={styles.backdrop} />

        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.cardWrap}>
            <View style={styles.sessionShell}>
              <View style={styles.sessionChrome}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionEyebrow}>Random Practice</Text>
                    <Text style={styles.sessionTitle}>
                      {isComplete
                        ? `${phrases.length}/${phrases.length} words cleared`
                        : `Word ${currentIndex + 1} of ${phrases.length}`}
                    </Text>
                    <Text style={styles.sessionSubtitle}>
                      Listen, say it back, keep the streak moving.
                    </Text>
                  </View>

                  <View style={styles.sessionBadge}>
                    <Text style={styles.sessionBadgeText}>{phrases.length}</Text>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(progressRatio * 100, 10)}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.sessionDivider} />

              <View style={styles.sessionBody}>
                {activePhrase ? (
                  <SpeakingCard
                    autoPractice
                    closeLabel="Stop"
                    embedded
                    helperLabel={
                      languageMetadata[activePhraseTranslations!.helperLanguage].label
                    }
                    helperText={activePhraseTranslations!.helperTranslation.text}
                    isFavorite={isFavorite(activePhrase.id)}
                    locale={resolvePracticeLocale(
                      activePhraseTranslations!.learningLanguage,
                    )}
                    onClose={handleClose}
                    onSuccessfulAttempt={handleSuccessfulAttempt}
                    onToggleFavorite={() => onToggleFavorite(activePhrase.id)}
                    phrase={activePhraseTranslations!.translation.text}
                  />
                ) : (
                  <View style={styles.completeCard}>
                    <View style={styles.completeIcon}>
                      <Icon
                        color={theme.colors.accent}
                        name="checkmark-circle"
                        size={54}
                      />
                    </View>
                    <Text style={styles.completeTitle}>Random practice complete</Text>
                    <Text style={styles.completeText}>
                      You cleared {phrases.length} random{' '}
                      {phrases.length === 1 ? 'word' : 'words'} in this run.
                    </Text>

                    <View style={styles.completeActions}>
                      <Pressable
                        onPress={onRestart}
                        style={({ pressed }) => [
                          styles.completePrimaryAction,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.completePrimaryActionText}>
                          Practice 10 more
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleClose}
                        style={({ pressed }) => [
                          styles.completeSecondaryAction,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.completeSecondaryActionText}>
                          Close
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    backgroundColor: withAlpha(theme.colors.text, 0.28),
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  cardWrap: {
    maxWidth: 520,
    width: '100%',
  },
  sessionShell: {
    backgroundColor: theme.colors.card,
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: 'visible',
    ...theme.shadows.surface,
  },
  sessionChrome: {
    padding: theme.spacing.md,
  },
  sessionDivider: {
    backgroundColor: withAlpha(theme.colors.border, 0.72),
    height: 1,
    marginHorizontal: theme.spacing.md,
  },
  sessionBody: {
    padding: theme.spacing.lg,
  },
  sessionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sessionCopy: {
    flex: 1,
  },
  sessionEyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  sessionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  sessionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  sessionBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: withAlpha(theme.colors.primary, 0.16),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sessionBadgeText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    borderRadius: theme.radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    height: '100%',
  },
  completeCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  completeIcon: {
    marginBottom: theme.spacing.md,
  },
  completeTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  completeText: {
    ...theme.typography.body,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  completeActions: {
    gap: theme.spacing.sm,
    width: '100%',
  },
  completePrimaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  completePrimaryActionText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  completeSecondaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  completeSecondaryActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export default RandomPracticeModal;
