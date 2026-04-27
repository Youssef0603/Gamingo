import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { playSuccessSound, stopSpeaking } from '../../services';
import { theme, withAlpha } from '../../theme/theme';
import { usePractice } from './usePractice';

import type { PracticeFeedback } from './usePractice';

type SpeakingCardProps = {
  englishText: string;
  isFavorite: boolean;
  locale?: string;
  onClose: () => void;
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
  const isCorrect =
    Boolean(feedback.normalizedExpected) &&
    feedback.normalizedExpected === feedback.normalizedSpoken;

  if (isCorrect) {
    return {
      kind: 'success',
      message: 'Correct. Nice rep.',
    };
  }

  return {
    kind: 'failure',
    message: 'Not quite. Listen and try again.',
  };
}

function SpeakingCard({
  englishText,
  isFavorite,
  locale,
  onClose,
  onToggleFavorite,
  phrase,
}: SpeakingCardProps) {
  const [practiceFlash, setPracticeFlash] = useState<PracticeFlashState | null>(null);

  const handleAttemptComplete = useCallback((nextFeedback: PracticeFeedback) => {
    const nextPracticeFlash = getPracticeFlash(nextFeedback);

    setPracticeFlash(nextPracticeFlash);

    if (nextPracticeFlash.kind === 'success') {
      playSuccessSound().catch(() => undefined);
    }
  }, []);

  const {
    error,
    isListening,
    isPlaying,
    isRequestingPermission,
    playPhrase,
    speakPhrase,
  } = usePractice({
    autoPlay: false,
    locale,
    onAttemptComplete: handleAttemptComplete,
    phrase,
  });

  useEffect(() => {
    playPhrase().catch(() => undefined);
  }, [playPhrase]);

  const feedbackMutedColor = practiceFlash
    ? getPracticeMutedTone(practiceFlash.kind)
    : null;
  const isBusy = isPlaying || isListening || isRequestingPermission;

  return (
    <View
      style={[
        styles.card,
        practiceFlash && [
          styles.cardWithFeedback,
          {
            borderColor: withAlpha(feedbackMutedColor ?? theme.colors.border, 0.58),
          },
        ],
      ]}
    >
      {practiceFlash ? (
        <View
          pointerEvents="none"
          style={styles.feedbackBadge}
        >
          <View
            style={[
              styles.feedbackBadgeInner,
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
          onPress={onClose}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Close</Text>
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
        onPress={() => {
          stopSpeaking()
            .catch(() => undefined)
            .finally(() => {
              playPhrase().catch(() => undefined);
            });
        }}
        style={({ pressed }) => [
          styles.speakButton,
          isBusy && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.phrase}>{phrase}</Text>
        <Icon color={theme.colors.primary} name="volume-high" size={20} />
      </Pressable>
      <Text style={styles.translation}>{englishText}</Text>

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
          onPress={() => {
            setPracticeFlash(null);
            playPhrase().catch(() => undefined);
          }}
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
  cardWithFeedback: {
    paddingTop: theme.spacing.xxl + theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  feedbackBadge: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -36,
    position: 'absolute',
    top: -36,
    width: 72,
    zIndex: 2,
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
    opacity: 0.85,
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
    justifyContent: 'center',
    minWidth: 116,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
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
    justifyContent: 'center',
    minWidth: 180,
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SpeakingCard;
