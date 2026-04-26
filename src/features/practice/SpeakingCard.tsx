import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../components/ui';
import { stopSpeaking } from '../../services';
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

function getFeedbackColor(feedback: PracticeFeedback | null) {
  if (feedback?.label === 'Perfect') {
    return theme.colors.accent;
  }

  if (feedback?.label === 'Close') {
    return theme.colors.primary;
  }

  return theme.colors.danger;
}

function SpeakingCard({
  englishText,
  isFavorite,
  locale,
  onClose,
  onToggleFavorite,
  phrase,
}: SpeakingCardProps) {
  const { error, feedback, heardText, isPlaying, playPhrase } = usePractice({
    autoPlay: false,
    locale,
    phrase,
  });

  useEffect(() => {
    playPhrase().catch(() => undefined);
  }, [playPhrase]);

  const feedbackColor = getFeedbackColor(feedback);
  const isBusy = isPlaying;

  return (
    <View style={styles.card}>
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
        onPress={() => {
          stopSpeaking()
            .catch(() => undefined)
            .finally(() => {
              playPhrase().catch(() => undefined);
            });
        }}
        style={({ pressed }) => [
          styles.speakButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.phrase}>{phrase}</Text>
        <Icon color={theme.colors.primary} name="volume-high" size={20} />
      </Pressable>
      <Text style={styles.translation}>{englishText}</Text>

      {feedback ? (
        <View
          style={[
            styles.feedbackCard,
            {
              backgroundColor: `${feedbackColor}14`,
              borderColor: `${feedbackColor}33`,
            },
          ]}
        >
          <Text style={[styles.feedbackTitle, { color: feedbackColor }]}>
            {feedback.label}
          </Text>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          {heardText ? (
            <Text style={styles.heardText}>Heard: {heardText}</Text>
          ) : null}
        </View>
      ) : null}

      {error && !feedback ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          disabled={isBusy}
          onPress={() => {
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
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
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
  feedbackCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  feedbackText: {
    ...theme.typography.body,
    color: theme.colors.text,
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
