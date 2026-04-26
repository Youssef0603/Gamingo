import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme, withAlpha } from '../../theme/theme';
import { usePractice } from './usePractice';

import type { SpeechRecognitionPermissionStatus } from '../../services';
import type { PracticeFeedback, PracticeStatus } from './usePractice';

type SpeakingCardProps = {
  englishText: string;
  isFavorite: boolean;
  locale?: string;
  onClose: () => void;
  onToggleFavorite: () => void;
  phrase: string;
  pronunciation?: string;
};

function getStatusMeta(
  status: PracticeStatus,
  permissionStatus: SpeechRecognitionPermissionStatus,
  feedback: PracticeFeedback | null,
) {
  if (status === 'requesting-permission') {
    return { color: theme.colors.primary, label: 'Preparing mic' };
  }

  if (status === 'playing') {
    return { color: theme.colors.primary, label: 'Playing audio' };
  }

  if (status === 'listening') {
    return { color: theme.colors.accent, label: 'Listening' };
  }

  if (feedback?.label === 'Perfect') {
    return { color: theme.colors.accent, label: 'Success' };
  }

  if (feedback?.label === 'Close') {
    return { color: theme.colors.primary, label: 'Close match' };
  }

  if (feedback?.label === 'Try again') {
    return { color: theme.colors.danger, label: 'Failed' };
  }

  if (permissionStatus === 'blocked') {
    return { color: theme.colors.danger, label: 'Mic blocked' };
  }

  if (permissionStatus === 'denied') {
    return { color: theme.colors.danger, label: 'Mic denied' };
  }

  if (permissionStatus === 'unavailable') {
    return { color: theme.colors.danger, label: 'Mic unavailable' };
  }

  return { color: theme.colors.mutedText, label: 'Ready' };
}

function getSupportMessage(permissionStatus: SpeechRecognitionPermissionStatus) {
  if (permissionStatus === 'blocked') {
    return 'Enable microphone access in system settings.';
  }

  if (permissionStatus === 'denied') {
    return 'Allow microphone access to keep practicing.';
  }

  if (permissionStatus === 'unavailable') {
    return 'Speech recognition is not available in this build.';
  }

  return null;
}

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
  pronunciation,
}: SpeakingCardProps) {
  const {
    error,
    feedback,
    heardText,
    isListening,
    isPlaying,
    isRequestingPermission,
    permissionStatus,
    playPhrase,
    speakPhrase,
    status,
  } = usePractice({
    autoPlay: false,
    locale,
    phrase,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await playPhrase();

      if (!cancelled) {
        await speakPhrase().catch(() => undefined);
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [playPhrase, speakPhrase]);

  const statusMeta = getStatusMeta(status, permissionStatus, feedback);
  const supportMessage = getSupportMessage(permissionStatus);
  const feedbackColor = getFeedbackColor(feedback);
  const isBusy = isPlaying || isListening || isRequestingPermission;

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

      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: withAlpha(statusMeta.color, 0.12),
            borderColor: withAlpha(statusMeta.color, 0.22),
          },
        ]}
      >
        {(isBusy || feedback) ? (
          <View
            style={[styles.statusDot, { backgroundColor: statusMeta.color }]}
          />
        ) : null}
        <Text style={[styles.statusText, { color: statusMeta.color }]}>
          {statusMeta.label}
        </Text>
      </View>

      <Text style={styles.phrase}>{phrase}</Text>
      <Text style={styles.translation}>{englishText}</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Pronunciation</Text>
        <Text style={styles.infoValue}>{pronunciation ?? 'Not available'}</Text>
      </View>

      {supportMessage ? (
        <Text style={styles.supportText}>{supportMessage}</Text>
      ) : null}

      {feedback ? (
        <View
          style={[
            styles.feedbackCard,
            {
              backgroundColor: withAlpha(feedbackColor, 0.08),
              borderColor: withAlpha(feedbackColor, 0.2),
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

      {error && !feedback ? <Text style={styles.errorText}>{error}</Text> : null}

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

        <Pressable
          disabled={isBusy}
          onPress={() => {
            speakPhrase().catch(() => undefined);
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            isBusy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryActionText}>Try again</Text>
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
  statusBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    marginRight: 8,
    width: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  phrase: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  translation: {
    ...theme.typography.body,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  infoLabel: {
    color: theme.colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  infoValue: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  supportText: {
    ...theme.typography.caption,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.md,
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
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SpeakingCard;
