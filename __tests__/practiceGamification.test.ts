import {
  getPracticeLevelProgress,
  initialPracticeStats,
  updatePracticeStats,
} from '../src/features/practice/practiceGamification';

describe('practiceGamification', () => {
  it('increments success stats for a clean rep', () => {
    const nextStats = updatePracticeStats(initialPracticeStats, 'Perfect');

    expect(nextStats).toEqual({
      correctPronunciations: 1,
      streak: 1,
      totalPracticed: 1,
      xp: 25,
    });
  });

  it('resets streak on a failed rep while keeping total progress moving', () => {
    const successfulStats = updatePracticeStats(initialPracticeStats, 'Close');
    const nextStats = updatePracticeStats(successfulStats, 'Try again');

    expect(nextStats).toEqual({
      correctPronunciations: 1,
      streak: 0,
      totalPracticed: 2,
      xp: 20,
    });
  });

  it('calculates level progress from xp', () => {
    expect(getPracticeLevelProgress(140)).toEqual({
      currentLevelXp: 40,
      level: 2,
      progress: 0.4,
      xpRequiredForNextLevel: 100,
      xpToNextLevel: 60,
    });
  });
});
