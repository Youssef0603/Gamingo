import type { PracticeFeedbackLabel } from './practiceUtils';

export type PracticeStats = {
  correctPronunciations: number;
  streak: number;
  totalPracticed: number;
  xp: number;
};

export type PracticeLevelProgress = {
  currentLevelXp: number;
  level: number;
  progress: number;
  xpRequiredForNextLevel: number;
  xpToNextLevel: number;
};

export const initialPracticeStats: PracticeStats = {
  correctPronunciations: 0,
  streak: 0,
  totalPracticed: 0,
  xp: 0,
};

export const XP_PER_LEVEL = 100;

export function isSuccessfulPractice(label: PracticeFeedbackLabel) {
  return label === 'Perfect' || label === 'Close';
}

export function getPracticeXpReward(label: PracticeFeedbackLabel) {
  if (label === 'Perfect') {
    return 25;
  }

  if (label === 'Close') {
    return 15;
  }

  return 5;
}

export function updatePracticeStats(
  stats: PracticeStats,
  label: PracticeFeedbackLabel,
): PracticeStats {
  const success = isSuccessfulPractice(label);

  return {
    correctPronunciations:
      stats.correctPronunciations + (success ? 1 : 0),
    streak: success ? stats.streak + 1 : 0,
    totalPracticed: stats.totalPracticed + 1,
    xp: stats.xp + getPracticeXpReward(label),
  };
}

export function getPracticeLevelProgress(xp: number): PracticeLevelProgress {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const levelStartXp = (level - 1) * XP_PER_LEVEL;
  const nextLevelXp = level * XP_PER_LEVEL;
  const currentLevelXp = xp - levelStartXp;
  const xpToNextLevel = nextLevelXp - xp;

  return {
    currentLevelXp,
    level,
    progress: currentLevelXp / XP_PER_LEVEL,
    xpRequiredForNextLevel: XP_PER_LEVEL,
    xpToNextLevel,
  };
}
