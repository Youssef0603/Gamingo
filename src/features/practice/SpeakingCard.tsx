import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { Badge, GameButton, GameCard } from '../../components/ui';
import { theme, withAlpha } from '../../theme/theme';
import { usePractice } from './usePractice';

import type { PracticeDependencies } from './practiceServices';
import type { PracticeFeedback } from './usePractice';

type SpeakingCardProps = {
  dependencies?: Partial<PracticeDependencies>;
  locale?: string;
  meaning: string;
  onAttemptComplete?: (feedback: PracticeFeedback) => void;
  phrase: string;
  pronunciation?: string;
};

function SpeakingCard({
  dependencies,
  locale,
  meaning,
  onAttemptComplete,
  phrase,
  pronunciation,
}: SpeakingCardProps) {
  const successGlow = useRef(new Animated.Value(0)).current;
  const failureFlash = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
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
  } = usePractice({
    autoPlay: true,
    dependencies,
    locale,
    onAttemptComplete,
    phrase,
  });

  const feedbackTone =
    feedback?.label === 'Perfect'
      ? 'accent'
      : feedback?.label === 'Close'
        ? 'secondary'
        : 'danger';
  const supportTone =
    permissionStatus === 'granted'
      ? 'accent'
      : permissionStatus === 'denied' || permissionStatus === 'blocked'
        ? 'danger'
        : permissionStatus === 'unavailable'
          ? 'neutral'
          : 'secondary';
  const supportLabel =
    permissionStatus === 'granted'
      ? 'Mic Ready'
      : permissionStatus === 'denied'
        ? 'Mic Denied'
        : permissionStatus === 'blocked'
          ? 'Mic Blocked'
          : permissionStatus === 'unavailable'
            ? 'Mic Unsupported'
            : 'Mic Pending';
  const supportMessage =
    permissionStatus === 'blocked'
      ? 'Enable microphone and speech access in system settings to use live practice.'
      : permissionStatus === 'denied'
        ? 'Microphone access was denied. Tap Speak again after granting permission.'
        : permissionStatus === 'unavailable'
          ? 'This build has audio playback, but live speech recognition needs a native recognizer module.'
          : null;
  const cardTranslateStyle = useMemo(
    () => ({
      transform: [{ translateX: shakeX }],
    }),
    [shakeX],
  );
  const successScale = successGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  useEffect(() => {
    if (!feedback) {
      return;
    }

    if (feedback.label === 'Try again') {
      successGlow.stopAnimation();
      successGlow.setValue(0);
      failureFlash.stopAnimation();
      failureFlash.setValue(0);
      shakeX.stopAnimation();
      shakeX.setValue(0);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(failureFlash, {
            duration: 120,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(failureFlash, {
            duration: 220,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(shakeX, {
            duration: 40,
            toValue: -10,
            useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
            duration: 40,
            toValue: 10,
            useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
            duration: 40,
            toValue: -8,
            useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
            duration: 40,
            toValue: 8,
            useNativeDriver: true,
          }),
          Animated.timing(shakeX, {
            duration: 40,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      return;
    }

    failureFlash.stopAnimation();
    failureFlash.setValue(0);
    shakeX.stopAnimation();
    shakeX.setValue(0);
    successGlow.stopAnimation();
    successGlow.setValue(0);

    Animated.sequence([
      Animated.timing(successGlow, {
        duration: 150,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(successGlow, {
        duration: 380,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [failureFlash, feedback, shakeX, successGlow]);

  return (
    <Animated.View style={[styles.cardShell, cardTranslateStyle]}>
      <GameCard glow="primary" style={styles.card}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            styles.successOverlay,
            {
              opacity: successGlow,
              transform: [{ scale: successScale }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            styles.failureOverlay,
            {
              opacity: failureFlash,
            },
          ]}
        />

        <View style={styles.content}>
          <View style={styles.badgeRow}>
            <Badge label="Speaking Drill" tone="primary" />
            <Badge
              label={
                isRequestingPermission
                  ? 'Authorizing Mic'
                  : isListening
                    ? 'Listening'
                    : isPlaying
                      ? 'Playing'
                      : 'Ready'
              }
              tone={
                isRequestingPermission
                  ? 'secondary'
                  : isListening
                    ? 'danger'
                    : isPlaying
                      ? 'secondary'
                      : 'neutral'
              }
            />
            <Badge label={supportLabel} tone={supportTone} />
          </View>

          <Text style={styles.phrase}>{phrase}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Pronunciation Hint</Text>
            <Text style={styles.sectionText}>
              {pronunciation ?? 'Read it as shown and focus on clean pacing.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meaning</Text>
            <Text style={styles.sectionText}>{meaning}</Text>
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionCell}>
              <GameButton
                fullWidth
                disabled={isListening || isPlaying || isRequestingPermission}
                onPress={() => {
                  playPhrase().catch(() => undefined);
                }}
                title={isPlaying ? 'Playing...' : 'Listen'}
                variant="secondary"
              />
            </View>
            <View style={styles.actionCell}>
              <GameButton
                fullWidth
                disabled={isListening || isPlaying || isRequestingPermission}
                onPress={() => {
                  speakPhrase().catch(() => undefined);
                }}
                title={
                  isRequestingPermission
                    ? 'Authorizing...'
                    : isListening
                      ? 'Listening...'
                      : 'Speak'
                }
              />
            </View>
          </View>

          {supportMessage ? (
            <View style={styles.supportBox}>
              <Text style={styles.supportText}>{supportMessage}</Text>
            </View>
          ) : null}

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                {
                  backgroundColor: withAlpha(
                    feedbackTone === 'accent'
                      ? theme.colors.accent
                      : feedbackTone === 'secondary'
                        ? theme.colors.secondary
                        : theme.colors.danger,
                    0.12,
                  ),
                  borderColor: withAlpha(
                    feedbackTone === 'accent'
                      ? theme.colors.accent
                      : feedbackTone === 'secondary'
                        ? theme.colors.secondary
                        : theme.colors.danger,
                    0.32,
                  ),
                },
              ]}
            >
              <View style={styles.feedbackHeader}>
                <Badge label={feedback.label} tone={feedbackTone} />
                <Text style={styles.feedbackScore}>
                  Match: {Math.round(feedback.score * 100)}%
                </Text>
              </View>

              <Text style={styles.feedbackText}>{feedback.message}</Text>

              {heardText ? (
                <Text style={styles.heardText}>Heard: {heardText}</Text>
              ) : null}
            </View>
          ) : null}

          {error && !feedback ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
        </View>
      </GameCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: theme.spacing.lg,
  },
  card: {
    padding: 0,
  },
  content: {
    padding: theme.spacing.lg,
  },
  overlay: {
    bottom: 0,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  successOverlay: {
    backgroundColor: withAlpha(theme.colors.accent, 0.08),
    borderColor: withAlpha(theme.colors.accent, 0.45),
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
  },
  failureOverlay: {
    backgroundColor: withAlpha(theme.colors.danger, 0.08),
    borderColor: withAlpha(theme.colors.danger, 0.4),
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  phrase: {
    ...theme.typography.title,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: theme.spacing.lg,
  },
  section: {
    backgroundColor: withAlpha(theme.colors.textPrimary, 0.03),
    borderColor: withAlpha(theme.colors.textPrimary, 0.08),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionLabel: {
    ...theme.typography.badgeLabel,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  sectionText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  actionCell: {
    flex: 1,
  },
  supportBox: {
    backgroundColor: withAlpha(theme.colors.textPrimary, 0.03),
    borderColor: withAlpha(theme.colors.textPrimary, 0.08),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
  },
  supportText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  feedbackBox: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
  },
  feedbackHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  feedbackScore: {
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
  },
  feedbackText: {
    ...theme.typography.body,
  },
  heardText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.md,
  },
});

export default SpeakingCard;
