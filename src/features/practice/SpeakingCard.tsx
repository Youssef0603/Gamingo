import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { trackPositiveReviewSignal } from '../reviews/appReview';
import { playSuccessSound } from '../../services';
import { theme, withAlpha } from '../../theme/theme';
import { usePractice } from './usePractice';

import type { PracticeFeedback } from './usePractice';

type SpeakingCardProps = {
  cancellationToken?: number;
  closeLabel?: string;
  embedded?: boolean;
  helperLabel: string;
  helperText: string;
  isFavorite: boolean;
  locale?: string;
  onClose: () => void;
  onSuccessfulAttempt?: (feedback: PracticeFeedback) => void;
  onToggleFavorite: () => void;
  phrase: string;
};

type PracticeFlashState = {
  kind: 'success' | 'failure';
  message: string;
};

function getPracticeMutedTone(kind: PracticeFlashState['kind']) {
  return kind === 'success' ? '#4BBF7A' : '#E26A6A';
}

function getPracticeFlash(feedback: PracticeFeedback): PracticeFlashState {
  const isSuccessfulAttempt =
    feedback.label === 'Perfect' || feedback.label === 'Close';

  if (isSuccessfulAttempt) {
    return {
      kind: 'success',
      message:
        feedback.label === 'Perfect'
          ? 'Correct. Nice rep.'
          : 'Close enough. Count it.',
    };
  }

  return {
    kind: 'failure',
    message: 'Not quite. Listen and try again.',
  };
}

function SpeakingCard({
  cancellationToken = 0,
  closeLabel = 'Close',
  embedded = false,
  helperLabel,
  helperText,
  isFavorite,
  locale,
  onClose,
  onSuccessfulAttempt,
  onToggleFavorite,
  phrase,
}: SpeakingCardProps) {
  const [practiceFlash, setPracticeFlash] = useState<PracticeFlashState | null>(null);
  const cancellationTokenRef = useRef(cancellationToken);

  const handleAttemptComplete = useCallback((nextFeedback: PracticeFeedback) => {
    const nextPracticeFlash = getPracticeFlash(nextFeedback);

    setPracticeFlash(nextPracticeFlash);

    if (nextPracticeFlash.kind === 'success') {
      playSuccessSound().catch(() => undefined);
      trackPositiveReviewSignal();
      onSuccessfulAttempt?.(nextFeedback);
    }
  }, [onSuccessfulAttempt]);

  const {
    error,
    isListening,
    isPlaying,
    isRequestingPermission,
    cancelPractice,
    invalidatePractice,
    playPhrase,
    speakPhrase,
  } = usePractice({
    locale,
    onAttemptComplete: handleAttemptComplete,
    phrase,
  });

  const playInitialPhrase = useCallback(async () => {
    setPracticeFlash(null);

    await playPhrase();
  }, [playPhrase]);

  const handleReplayPhrase = useCallback(() => {
    cancelPractice().finally(() => {
      playInitialPhrase().catch(() => undefined);
    });
  }, [cancelPractice, playInitialPhrase]);

  useEffect(() => {
    playInitialPhrase().catch(() => undefined);

    return () => {
      invalidatePractice();
    };
  }, [invalidatePractice, playInitialPhrase]);

  useEffect(() => {
    if (cancellationToken === cancellationTokenRef.current) {
      return;
    }

    cancellationTokenRef.current = cancellationToken;
    invalidatePractice();
  }, [cancellationToken, invalidatePractice]);

  const handleClosePress = useCallback(() => {
    invalidatePractice();
    onClose();
  }, [invalidatePractice, onClose]);

  const feedbackMutedColor = practiceFlash
    ? getPracticeMutedTone(practiceFlash.kind)
    : null;
  const isBusy = isPlaying || isListening || isRequestingPermission;

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        practiceFlash && styles.cardWithFeedback,
        practiceFlash && embedded && styles.cardEmbeddedWithFeedback,
        practiceFlash && !embedded && styles.cardWithFeedbackState,
        practiceFlash && embedded && styles.cardEmbeddedWithFeedbackState,
        practiceFlash && {
          backgroundColor: embedded
            ? withAlpha(feedbackMutedColor ?? theme.colors.border, 0.045)
            : theme.colors.card,
          borderColor: withAlpha(
            feedbackMutedColor ?? theme.colors.border,
            embedded ? 0.42 : 0.58,
          ),
        },
      ]}
    >
      {practiceFlash ? (
        <View
          pointerEvents="none"
          style={[
            styles.feedbackBadge,
            embedded && styles.feedbackBadgeEmbedded,
          ]}
        >
          <View
            style={[
              styles.feedbackBadgeInner,
              embedded && styles.feedbackBadgeInnerEmbedded,
              {
                borderColor: withAlpha(feedbackMutedColor ?? theme.colors.border, 0.58),
              },
            ]}
          >
            <Icon
              color={feedbackMutedColor ?? theme.colors.accent}
              name={practiceFlash.kind === 'success' ? 'checkmark' : 'close'}
              size={38}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <Pressable
          onPress={handleClosePress}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>{closeLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onToggleFavorite}
          style={({ pressed }) => [
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonSaved,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text
            style={[
              styles.favoriteButtonText,
              isFavorite && styles.favoriteButtonTextSaved,
            ]}
          >
            {isFavorite ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        disabled={isBusy}
        onPress={handleReplayPhrase}
        style={({ pressed }) => [
          styles.speakButton,
          isBusy && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.phrase}>{phrase}</Text>
        <Icon color={theme.colors.primary} name="volume-high" size={20} />
      </Pressable>
      <Text style={styles.translation}>
        {helperLabel}: {helperText}
      </Text>

      {practiceFlash ? (
        <View style={styles.feedbackWrap}>
          <Text
            style={[
              styles.feedbackTitle,
              { color: feedbackMutedColor ?? theme.colors.accent },
            ]}
          >
            {practiceFlash.kind === 'success' ? 'Success' : 'Try again'}
          </Text>
          {/* <Text style={styles.feedbackText}>{practiceFlash.message}</Text> */}
        </View>
      ) : null}

      {error && !practiceFlash ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          disabled={isBusy}
          onPress={() => {
            setPracticeFlash(null);
            speakPhrase().catch(() => undefined);
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            isBusy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryActionText}>
            {isListening || isRequestingPermission ? 'Listening...' : 'Practice'}
          </Text>
        </Pressable>
        <Pressable
          disabled={isBusy}
          onPress={handleReplayPhrase}
          style={({ pressed }) => [
            styles.secondaryAction,
            isBusy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryActionText}>Play again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: 'visible',
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  cardEmbedded: {
    backgroundColor: withAlpha(theme.colors.primary, 0.025),
    borderColor: withAlpha(theme.colors.primary, 0.16),
    borderWidth: 1.5,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  cardWithFeedback: {
    paddingTop: theme.spacing.xxl + theme.spacing.sm,
  },
  cardEmbeddedWithFeedback: {
    paddingTop: theme.spacing.xxl + theme.spacing.md,
  },
  cardWithFeedbackState: {
    borderWidth: 1,
  },
  cardEmbeddedWithFeedbackState: {
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  feedbackBadge: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: -20,
    zIndex: 2,
  },
  feedbackBadgeEmbedded: {
    top: -28,
    zIndex: 4,
  },
  feedbackBadgeInner: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    height: 52,
    justifyContent: 'center',
    width: 52,
    ...theme.shadows.surface,
  },
  feedbackBadgeInnerEmbedded: {
    borderWidth: 3,
    height: 62,
    width: 62,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  favoriteButton: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.primary, 0.08),
    borderColor: withAlpha(theme.colors.primary, 0.2),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  favoriteButtonSaved: {
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
    borderColor: withAlpha(theme.colors.accent, 0.2),
  },
  favoriteButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  favoriteButtonTextSaved: {
    color: theme.colors.accent,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  phrase: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    textAlign: 'center',
  },
  speakButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  translation: {
    ...theme.typography.body,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  feedbackWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  feedbackText: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
  },
  heardText: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  primaryActionText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SpeakingCard;
