import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

import { Icon } from '../../components/ui';
import { trackReviewMilestone } from '../reviews/appReview';
import { playSuccessSound } from '../../services';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAMS,
  type AnalyticsParams,
  trackAnalyticsEvent,
} from '../../services/analytics';
import { theme, withAlpha } from '../../theme/theme';
import { usePractice } from './usePractice';

import type { PracticeFeedback } from './usePractice';
import type { LanguageCode } from '../../types/language';

const successCheckmarkAnimation = require('../../assets/animations/Checkmark.json');
const INLINE_FEEDBACK_SLOT_HEIGHT = 56;
const androidCardTextStyle = Platform.select({
  android: {
    includeFontPadding: true,
  },
  default: {},
});

type SpeakingCardProps = {
  analyticsContext?: AnalyticsParams;
  autoStartListeningAfterPlayback?: boolean;
  cancellationToken?: number;
  closeLabel?: string;
  embedded?: boolean;
  embeddedFeedbackStyle?: 'floating' | 'inline';
  helperLabel: string;
  helperText: string;
  isFavorite: boolean;
  languageCode?: LanguageCode;
  locale?: string;
  onClose: () => void;
  onSuccessfulAttempt?: (feedback: PracticeFeedback) => void;
  onToggleFavorite: () => void;
  phraseId?: string;
  phrase: string;
  reserveFeedbackSpace?: boolean;
  showCloseAction?: boolean;
  trackReviewSuccess?: boolean;
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

function SuccessCheckmark({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <LottieView
      autoPlay
      loop={false}
      resizeMode="contain"
      source={successCheckmarkAnimation}
      style={compact ? styles.successAnimationCompact : styles.successAnimation}
    />
  );
}

function SpeakingCard({
  analyticsContext,
  autoStartListeningAfterPlayback = false,
  cancellationToken = 0,
  closeLabel = 'Close',
  embedded = false,
  embeddedFeedbackStyle = 'floating',
  helperLabel,
  helperText,
  isFavorite,
  languageCode,
  locale,
  onClose,
  onSuccessfulAttempt,
  onToggleFavorite,
  phraseId,
  phrase,
  reserveFeedbackSpace = false,
  showCloseAction = true,
  trackReviewSuccess = true,
}: SpeakingCardProps) {
  const [practiceFlash, setPracticeFlash] = useState<PracticeFlashState | null>(null);
  const [isSequencingPractice, setIsSequencingPractice] = useState(false);
  const cancellationTokenRef = useRef(cancellationToken);
  const practiceSequenceRequestIdRef = useRef(0);
  const shouldUseInlineEmbeddedFeedback =
    embedded && embeddedFeedbackStyle === 'inline';
  const shouldReserveFloatingFeedbackSpace =
    practiceFlash?.kind === 'failure' || reserveFeedbackSpace;
  const shouldRenderFeedbackArea =
    shouldUseInlineEmbeddedFeedback ||
    reserveFeedbackSpace ||
    practiceFlash?.kind === 'failure';
  const practiceAnalyticsContext = useMemo(
    () => ({
      ...analyticsContext,
      [ANALYTICS_PARAMS.AUTO_LISTEN]: autoStartListeningAfterPlayback
        ? 'true'
        : 'false',
    }),
    [analyticsContext, autoStartListeningAfterPlayback],
  );

  const handleAttemptComplete = useCallback((nextFeedback: PracticeFeedback) => {
    const nextPracticeFlash = getPracticeFlash(nextFeedback);

    setPracticeFlash(nextPracticeFlash);

    if (nextPracticeFlash.kind === 'success') {
      playSuccessSound().catch(() => undefined);
      if (trackReviewSuccess) {
        trackReviewMilestone('practice-success');
      }
      onSuccessfulAttempt?.(nextFeedback);
    }
  }, [onSuccessfulAttempt, trackReviewSuccess]);

  const invalidatePracticeSequence = useCallback(() => {
    practiceSequenceRequestIdRef.current += 1;
    setIsSequencingPractice(false);
  }, []);

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
    analyticsContext: practiceAnalyticsContext,
    languageCode,
    locale,
    onAttemptComplete: handleAttemptComplete,
    phraseId,
    phrase,
  });

  const handlePracticePress = useCallback(() => {
    invalidatePracticeSequence();
    setPracticeFlash(null);
    speakPhrase().catch(() => undefined);
  }, [invalidatePracticeSequence, speakPhrase]);

  const playInitialPhrase = useCallback(async () => {
    setPracticeFlash(null);

    await playPhrase();
  }, [playPhrase]);

  const playPhraseThenListen = useCallback(async () => {
    const nextSequenceRequestId = practiceSequenceRequestIdRef.current + 1;

    practiceSequenceRequestIdRef.current = nextSequenceRequestId;
    setPracticeFlash(null);
    setIsSequencingPractice(true);

    try {
      await playPhrase();

      if (nextSequenceRequestId !== practiceSequenceRequestIdRef.current) {
        return;
      }

      await speakPhrase();
    } catch {
      return;
    } finally {
      if (nextSequenceRequestId === practiceSequenceRequestIdRef.current) {
        setIsSequencingPractice(false);
      }
    }
  }, [playPhrase, speakPhrase]);

  const handleReplayPhrase = useCallback(() => {
    cancelPractice().finally(() => {
      if (autoStartListeningAfterPlayback) {
        playPhraseThenListen().catch(() => undefined);
        return;
      }

      playInitialPhrase().catch(() => undefined);
    });
  }, [
    autoStartListeningAfterPlayback,
    cancelPractice,
    playInitialPhrase,
    playPhraseThenListen,
  ]);

  useEffect(() => {
    if (autoStartListeningAfterPlayback) {
      playPhraseThenListen().catch(() => undefined);
    } else {
      playInitialPhrase().catch(() => undefined);
    }

    return () => {
      invalidatePracticeSequence();
      invalidatePractice();
    };
  }, [
    autoStartListeningAfterPlayback,
    invalidatePractice,
    invalidatePracticeSequence,
    playInitialPhrase,
    playPhraseThenListen,
  ]);

  useEffect(() => {
    if (cancellationToken === cancellationTokenRef.current) {
      return;
    }

    cancellationTokenRef.current = cancellationToken;
    invalidatePracticeSequence();
    invalidatePractice();
  }, [cancellationToken, invalidatePractice, invalidatePracticeSequence]);

  const handleClosePress = useCallback(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.PRACTICE_CANCELED, {
      ...practiceAnalyticsContext,
      [ANALYTICS_PARAMS.UI_ACTION]: 'close',
    }).catch(() => undefined);
    invalidatePracticeSequence();
    invalidatePractice();
    onClose();
  }, [
    invalidatePractice,
    invalidatePracticeSequence,
    onClose,
    practiceAnalyticsContext,
  ]);

  const feedbackMutedColor = practiceFlash
    ? getPracticeMutedTone(practiceFlash.kind)
    : null;
  const isBusy =
    isPlaying || isListening || isRequestingPermission || isSequencingPractice;
  const primaryActionLabel =
    isListening || isRequestingPermission
      ? 'Listening...'
      : isPlaying || isSequencingPractice
        ? 'Playing...'
        : 'Practice';

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        shouldReserveFloatingFeedbackSpace &&
          !shouldUseInlineEmbeddedFeedback &&
          styles.cardWithFeedback,
        shouldReserveFloatingFeedbackSpace &&
          embedded &&
          !shouldUseInlineEmbeddedFeedback &&
          styles.cardEmbeddedWithFeedback,
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
      {practiceFlash && !shouldUseInlineEmbeddedFeedback ? (
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
            {practiceFlash.kind === 'success' ? (
              <SuccessCheckmark key="floating-success-checkmark" />
            ) : (
              <Icon
                color={feedbackMutedColor ?? theme.colors.accent}
                name="close"
                size={38}
              />
            )}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.headerRow,
          !showCloseAction && styles.headerRowWithoutClose,
        ]}
      >
        {showCloseAction ? (
          <Pressable
            onPress={handleClosePress}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{closeLabel}</Text>
          </Pressable>
        ) : null}

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
          styles.phraseButton,
          isBusy && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.phrase}>{phrase}</Text>
      </Pressable>
      <Text style={styles.translation}>
        {helperLabel}: {helperText}
      </Text>

      {shouldRenderFeedbackArea ? (
        <View
          style={[
            styles.feedbackWrap,
            reserveFeedbackSpace && styles.feedbackWrapReserved,
            shouldUseInlineEmbeddedFeedback && styles.feedbackWrapInlineEmbedded,
          ]}
        >
          {shouldUseInlineEmbeddedFeedback && practiceFlash?.kind === 'success' ? (
            <View style={styles.feedbackInlineSuccessWrap}>
              <SuccessCheckmark
                compact
                key={`inline-success-checkmark-${phraseId ?? phrase}`}
              />
            </View>
          ) : shouldUseInlineEmbeddedFeedback ? (
            <View style={styles.feedbackInlineRow}>
              <View
                style={[
                  styles.feedbackInlineIconWrap,
                  !practiceFlash && styles.feedbackInlineIconWrapHidden,
                  practiceFlash && {
                    backgroundColor: withAlpha(
                      feedbackMutedColor ?? theme.colors.border,
                      0.1,
                    ),
                    borderColor: withAlpha(
                      feedbackMutedColor ?? theme.colors.border,
                      0.28,
                    ),
                  },
                ]}
              >
                <Icon
                  color={feedbackMutedColor ?? theme.colors.accent}
                  name={practiceFlash?.kind === 'failure' ? 'close' : 'checkmark'}
                  size={16}
                />
              </View>
              <Text
                style={[
                  styles.feedbackTitle,
                  styles.feedbackTitleInline,
                  practiceFlash?.kind === 'success' && styles.feedbackTitleHidden,
                  !practiceFlash && styles.feedbackTitleHidden,
                  { color: feedbackMutedColor ?? theme.colors.accent },
                ]}
              >
                {practiceFlash
                  ? practiceFlash.kind === 'success'
                    ? 'Success'
                    : 'Try again'
                  : 'Success'}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.feedbackTitle,
                practiceFlash?.kind === 'success' && styles.feedbackTitleHidden,
                !practiceFlash && styles.feedbackTitleHidden,
                { color: feedbackMutedColor ?? theme.colors.accent },
              ]}
            >
              {practiceFlash
                ? practiceFlash.kind === 'success'
                  ? 'Success'
                  : 'Try again'
                : 'Success'}
            </Text>
          )}
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
            handlePracticePress();
          }}
          style={({ pressed }) => [
            styles.primaryAction,
            isBusy && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryActionText}>{primaryActionLabel}</Text>
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
          <View style={styles.secondaryActionContent}>
            <Text style={styles.secondaryActionText}>Play again</Text>
            <Icon color={theme.colors.primary} name="volume-high" size={16} />
          </View>
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
  headerRowWithoutClose: {
    justifyContent: 'flex-end',
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
    ...androidCardTextStyle,
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: Platform.OS === 'android' ? 48 : 38,
    textAlign: 'center',
  },
  phraseButton: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  translation: {
    ...theme.typography.body,
    ...androidCardTextStyle,
    color: theme.colors.mutedText,
    lineHeight: Platform.OS === 'android' ? 24 : theme.typography.body.lineHeight,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  feedbackWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  feedbackWrapReserved: {
    minHeight: INLINE_FEEDBACK_SLOT_HEIGHT,
  },
  feedbackWrapInlineEmbedded: {
    marginBottom: theme.spacing.lg,
  },
  feedbackInlineSuccessWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: INLINE_FEEDBACK_SLOT_HEIGHT,
    width: '100%',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  feedbackTitleHidden: {
    opacity: 0,
  },
  feedbackTitleInline: {
    marginBottom: 0,
  },
  feedbackInlineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    minHeight: INLINE_FEEDBACK_SLOT_HEIGHT,
  },
  feedbackInlineIconWrap: {
    alignItems: 'center',
    backgroundColor: withAlpha(theme.colors.border, 0.08),
    borderColor: withAlpha(theme.colors.border, 0.18),
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  feedbackInlineIconWrapHidden: {
    opacity: 0,
  },
  successAnimation: {
    height: 92,
    width: 92,
  },
  successAnimationCompact: {
    height: INLINE_FEEDBACK_SLOT_HEIGHT,
    width: INLINE_FEEDBACK_SLOT_HEIGHT,
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
  secondaryActionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.xs,
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SpeakingCard;
