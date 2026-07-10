import {
  calculatePracticeSimilarity,
  evaluatePracticeAttempt,
  getPracticeFeedbackLabel,
  normalizePracticeText,
} from '../src/features/practice/practiceUtils';

describe('practiceUtils', () => {
  it('normalizes punctuation, accents, and spacing', () => {
    expect(normalizePracticeText('  Push,  maintenant! ')).toBe(
      'push maintenant',
    );
    expect(normalizePracticeText('Derrière toi!')).toBe('derriere toi');
  });

  it('returns perfect for an exact normalized match', () => {
    expect(evaluatePracticeAttempt('Behind you!', 'behind you').label).toBe(
      'Perfect',
    );
  });

  it('accepts censored transcripts when the mask still matches the phrase', () => {
    const evaluation = evaluatePracticeAttempt('иди нахуй', 'Иди на х**');

    expect(evaluation.label).toBe('Perfect');
    expect(evaluation.score).toBe(1);
  });

  it('returns close for a near match', () => {
    expect(evaluatePracticeAttempt('Stop feeding', 'stop feedin').label).toBe(
      'Close',
    );
  });

  it('passes close orthographic variants that keep the spoken meaning intact', () => {
    const evaluation = evaluatePracticeAttempt(
      'المنطقة الآمنة',
      'المنطقه الامنه',
    );

    expect(evaluation.label).toBe('Close');
    expect(evaluation.score).toBeGreaterThanOrEqual(0.7);
  });

  it('passes attempts at a seventy percent similarity score', () => {
    expect(getPracticeFeedbackLabel(0.7)).toBe('Close');
    expect(getPracticeFeedbackLabel(0.699)).toBe('Try again');
  });

  it('returns try again for a weak match', () => {
    expect(evaluatePracticeAttempt('Rotate B', 'hold angle').label).toBe(
      'Try again',
    );
  });

  it('produces a higher score for closer phrases', () => {
    const closeScore = calculatePracticeSimilarity('Stop feeding', 'stop feed');
    const weakScore = calculatePracticeSimilarity('Stop feeding', 'site clear');

    expect(closeScore).toBeGreaterThan(weakScore);
  });
});
