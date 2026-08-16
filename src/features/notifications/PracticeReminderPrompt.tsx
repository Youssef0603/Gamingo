import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  acceptPracticeReminderPrompt,
  deferPracticeReminderPrompt,
  getPracticeReminderPromptEligibility,
  getPracticeReminderSnapshot,
  markPracticeReminderPromptShown,
  subscribeToPracticeReminderState,
} from './practiceReminders';

type PracticeReminderPromptProps = {
  isInteractionBlocking: boolean;
};

const PROMPT_ORIGIN = 'practice_screen';

function PracticeReminderPrompt({
  isInteractionBlocking,
}: PracticeReminderPromptProps) {
  const [snapshot, setSnapshot] = useState(getPracticeReminderSnapshot);
  const isPromptVisibleRef = useRef(false);

  useEffect(
    () =>
      subscribeToPracticeReminderState(() => {
        setSnapshot(getPracticeReminderSnapshot());
      }),
    [],
  );

  useEffect(() => {
    if (isInteractionBlocking || isPromptVisibleRef.current) {
      return;
    }

    const eligibility = getPracticeReminderPromptEligibility();

    if (!eligibility.eligible) {
      return;
    }

    isPromptVisibleRef.current = true;

    markPracticeReminderPromptShown(PROMPT_ORIGIN, eligibility)
      .then(() => {
        let hasHandledDecision = false;

        const handleDecision = (
          decision: () => Promise<unknown> | unknown,
        ) => {
          if (hasHandledDecision) {
            return;
          }

          hasHandledDecision = true;
          Promise.resolve(decision()).finally(() => {
            isPromptVisibleRef.current = false;
          });
        };

        Alert.alert(
          'Want a quick practice reminder?',
          'We can remind you to practice a few words later.',
          [
            {
              onPress: () =>
                handleDecision(() =>
                  deferPracticeReminderPrompt(PROMPT_ORIGIN, 'not_now'),
                ),
              style: 'cancel',
              text: 'Not now',
            },
            {
              onPress: () =>
                handleDecision(() =>
                  acceptPracticeReminderPrompt(PROMPT_ORIGIN),
                ),
              text: 'Remind me',
            },
          ],
          {
            cancelable: true,
            onDismiss: () =>
              handleDecision(() =>
                deferPracticeReminderPrompt(PROMPT_ORIGIN, 'dismissed'),
              ),
          },
        );
      })
      .catch(() => {
        isPromptVisibleRef.current = false;
      });
  }, [
    isInteractionBlocking,
    snapshot.favoriteSaveCount,
    snapshot.isHydrated,
    snapshot.lastDecisionAtMs,
    snapshot.lastPromptedAtMs,
    snapshot.optInStatus,
    snapshot.permissionStatus,
    snapshot.practiceSuccessCount,
    snapshot.promptShownCount,
    snapshot.randomPracticeCompletionCount,
  ]);

  return null;
}

export default PracticeReminderPrompt;
