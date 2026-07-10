import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { Icon } from '../../components/ui';
import { trackReviewMilestone } from '../reviews/appReview';
import { stop as stopSpeechRecognition, stopSpeaking } from '../../services';
import { theme, withAlpha } from '../../theme/theme';
import { languageMetadata } from '../../types/language';
import { getPhraseDisplayTranslations } from '../../utils/phraseDisplay';
import type { LanguageCode } from '../../types/language';
import type { Phrase } from '../../types/phrase';
import { resolvePracticeLocale } from './practiceUtils';
import SpeakingCard from './SpeakingCard';

const SUCCESS_ADVANCE_DELAY_MS = 950;
const OUTSIDE_TAP_MOVEMENT_THRESHOLD = 8;

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
  const [cancellationToken, setCancellationToken] = useState(0);
  const [isSkippingWord, setIsSkippingWord] = useState(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<View>(null);
  const dialogFrameRef = useRef<{
    height: number;
    width: number;
    x: number;
    y: number;
  } | null>(null);
  const isSkipTransitionActiveRef = useRef(false);
  const hasTrackedCompletionRef = useRef(false);
  const successfulAttemptCountRef = useRef(0);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);

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
    setCancellationToken(0);
    setCurrentIndex(0);
    setIsSkippingWord(false);
    hasTrackedCompletionRef.current = false;
    successfulAttemptCountRef.current = 0;
    isSkipTransitionActiveRef.current = false;
  }, [clearAdvanceTimeout, sessionId, visible]);

  useEffect(() => () => {
    clearAdvanceTimeout();
  }, [clearAdvanceTimeout]);

  const handleClose = useCallback(() => {
    clearAdvanceTimeout();
    isSkipTransitionActiveRef.current = false;
    setIsSkippingWord(false);
    setCancellationToken(previousToken => previousToken + 1);

    Promise.allSettled([
      stopSpeaking(),
      stopSpeechRecognition(),
    ]).finally(() => {
      onClose();
    });
  }, [clearAdvanceTimeout, onClose]);

  const measureDialogFrame = useCallback(() => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      dialogFrameRef.current = {
        height,
        width,
        x,
        y,
      };
    });
  }, []);

  const handleOverlayTouchStart = useCallback((event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;

    touchStartRef.current = { pageX, pageY };
    measureDialogFrame();
  }, [measureDialogFrame]);

  const handleOverlayTouchEnd = useCallback((event: GestureResponderEvent) => {
    const touchStart = touchStartRef.current;

    touchStartRef.current = null;

    if (!touchStart) {
      return;
    }

    const { pageX, pageY } = event.nativeEvent;
    const movedDistance = Math.max(
      Math.abs(pageX - touchStart.pageX),
      Math.abs(pageY - touchStart.pageY),
    );

    if (movedDistance > OUTSIDE_TAP_MOVEMENT_THRESHOLD) {
      return;
    }

    const dialogFrame = dialogFrameRef.current;

    if (!dialogFrame) {
      return;
    }

    const isInsideDialog =
      pageX >= dialogFrame.x
      && pageX <= dialogFrame.x + dialogFrame.width
      && pageY >= dialogFrame.y
      && pageY <= dialogFrame.y + dialogFrame.height;

    if (!isInsideDialog) {
      handleClose();
    }
  }, [handleClose]);

  const handleSuccessfulAttempt = useCallback(() => {
    if (advanceTimeoutRef.current) {
      return;
    }

    successfulAttemptCountRef.current += 1;
    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      setCurrentIndex(previousIndex => previousIndex + 1);
    }, SUCCESS_ADVANCE_DELAY_MS);
  }, []);

  const handleSkipWord = useCallback(() => {
    if (isSkipTransitionActiveRef.current) {
      return;
    }

    isSkipTransitionActiveRef.current = true;
    setIsSkippingWord(true);
    clearAdvanceTimeout();
    setCancellationToken(previousToken => previousToken + 1);

    Promise.allSettled([
      stopSpeaking(),
      stopSpeechRecognition(),
    ]).finally(() => {
      setCurrentIndex(previousIndex => previousIndex + 1);
      isSkipTransitionActiveRef.current = false;
      setIsSkippingWord(false);
    });
  }, [clearAdvanceTimeout]);

  const isComplete = currentIndex >= phrases.length;
  const activePhrase = isComplete ? null : phrases[currentIndex];
  const activePhraseTranslations = activePhrase
    ? getPhraseDisplayTranslations(activePhrase, helperLanguage, language)
    : null;
  const progressRatio = isComplete
    ? 1
    : Math.min((currentIndex + 1) / phrases.length, 1);

  useEffect(() => {
    if (
      !visible ||
      phrases.length === 0 ||
      !isComplete ||
      successfulAttemptCountRef.current !== phrases.length ||
      hasTrackedCompletionRef.current
    ) {
      return;
    }

    hasTrackedCompletionRef.current = true;
    trackReviewMilestone('random-practice-complete');
  }, [isComplete, phrases.length, visible]);

  if (!visible || phrases.length === 0) {
    return null;
  }

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
          onContentSizeChange={measureDialogFrame}
          onLayout={measureDialogFrame}
          onTouchEnd={handleOverlayTouchEnd}
          onTouchStart={handleOverlayTouchStart}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View
            ref={cardRef}
            onLayout={measureDialogFrame}
            style={styles.cardWrap}
          >
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
                      Listen, then practice when you are ready.
                    </Text>
                  </View>

                  <Pressable
                    accessibilityHint="Closes random practice."
                    accessibilityLabel="Close random practice"
                    onPress={handleClose}
                    style={({ pressed }) => [
                      styles.sessionCloseButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Icon
                      color={theme.colors.primary}
                      name="close"
                      size={22}
                    />
                  </Pressable>
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
                  <>
                    <SpeakingCard
                      autoStartListeningAfterPlayback
                      cancellationToken={cancellationToken}
                      embedded
                      embeddedFeedbackStyle="inline"
                      helperLabel={
                        languageMetadata[activePhraseTranslations!.helperLanguage].label
                      }
                      helperText={activePhraseTranslations!.helperTranslation.text}
                      isFavorite={isFavorite(activePhrase.id)}
                      key={activePhrase.id}
                      languageCode={activePhraseTranslations!.learningLanguage}
                      locale={resolvePracticeLocale(
                        activePhraseTranslations!.learningLanguage,
                      )}
                      onClose={handleClose}
                      onSuccessfulAttempt={handleSuccessfulAttempt}
                      onToggleFavorite={() => onToggleFavorite(activePhrase.id)}
                      phraseId={
                        activePhrase.category === 'custom'
                          ? undefined
                          : activePhrase.id
                      }
                      phrase={activePhraseTranslations!.translation.text}
                      reserveFeedbackSpace
                      showCloseAction={false}
                      trackReviewSuccess={false}
                    />
                    <Pressable
                      disabled={isSkippingWord}
                      onPress={handleSkipWord}
                      style={({ pressed }) => [
                        styles.skipAction,
                        isSkippingWord && styles.buttonDisabled,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.skipActionText}>Skip</Text>
                      <Icon
                        color={theme.colors.primary}
                        name="play-skip-forward"
                        size={18}
                      />
                    </Pressable>
                  </>
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
    padding: theme.spacing.lg,
  },
  sessionDivider: {
    backgroundColor: withAlpha(theme.colors.border, 0.72),
    height: 1,
    marginHorizontal: theme.spacing.md,
  },
  sessionBody: {
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  skipAction: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.18),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    minHeight: 44,
    minWidth: 100,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
  },
  skipActionText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
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
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  sessionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  sessionSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
  },
  sessionCloseButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: withAlpha(theme.colors.primary, 0.16),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    flex: 1,
    justifyContent: 'center',
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
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});

export default RandomPracticeModal;
