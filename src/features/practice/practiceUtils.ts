import type { LanguageCode } from '../../types/language';

export type PracticeFeedbackLabel = 'Perfect' | 'Close' | 'Try again';

export type PracticeEvaluation = {
  expectedText: string;
  label: PracticeFeedbackLabel;
  normalizedExpected: string;
  normalizedSpoken: string;
  score: number;
  spokenText: string;
};

export const practiceLocaleMap: Record<LanguageCode, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  ar: 'ar-SA',
  it: 'it-IT',
  pt: 'pt-BR',
  hi: 'hi-IN',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  ru: 'ru-RU',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
};

export function resolvePracticeLocale(language: LanguageCode) {
  return practiceLocaleMap[language];
}

export function normalizePracticeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(source: string, target: string) {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const previous = Array.from(
    { length: target.length + 1 },
    (_, index) => index,
  );
  const current = new Array<number>(target.length + 1).fill(0);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    current[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const substitutionCost =
        source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;

      current[targetIndex] = Math.min(
        current[targetIndex - 1] + 1,
        previous[targetIndex] + 1,
        previous[targetIndex - 1] + substitutionCost,
      );
    }

    for (let targetIndex = 0; targetIndex <= target.length; targetIndex += 1) {
      previous[targetIndex] = current[targetIndex];
    }
  }

  return previous[target.length];
}

function tokenSimilarityScore(expected: string, spoken: string) {
  const expectedTokens = expected.split(' ').filter(Boolean);
  const spokenTokens = spoken.split(' ').filter(Boolean);

  if (!expectedTokens.length || !spokenTokens.length) {
    return 0;
  }

  const expectedSet = new Set(expectedTokens);
  const spokenSet = new Set(spokenTokens);

  let overlap = 0;

  expectedSet.forEach(token => {
    if (spokenSet.has(token)) {
      overlap += 1;
    }
  });

  return overlap / expectedSet.size;
}

export function calculatePracticeSimilarity(
  expectedText: string,
  spokenText: string,
) {
  const normalizedExpected = normalizePracticeText(expectedText);
  const normalizedSpoken = normalizePracticeText(spokenText);

  if (!normalizedExpected || !normalizedSpoken) {
    return 0;
  }

  const editDistance = levenshteinDistance(
    normalizedExpected,
    normalizedSpoken,
  );
  const charSimilarity =
    1 -
    editDistance / Math.max(normalizedExpected.length, normalizedSpoken.length);
  const tokenSimilarity = tokenSimilarityScore(
    normalizedExpected,
    normalizedSpoken,
  );

  return Number((charSimilarity * 0.7 + tokenSimilarity * 0.3).toFixed(3));
}

export function getPracticeFeedbackLabel(score: number) {
  if (score >= 0.92) {
    return 'Perfect';
  }

  if (score >= 0.7) {
    return 'Close';
  }

  return 'Try again';
}

export function evaluatePracticeAttempt(
  expectedText: string,
  spokenText: string,
): PracticeEvaluation {
  const normalizedExpected = normalizePracticeText(expectedText);
  const normalizedSpoken = normalizePracticeText(spokenText);
  const score = calculatePracticeSimilarity(expectedText, spokenText);

  return {
    expectedText,
    label:
      normalizedExpected && normalizedExpected === normalizedSpoken
        ? 'Perfect'
        : getPracticeFeedbackLabel(score),
    normalizedExpected,
    normalizedSpoken,
    score,
    spokenText,
  };
}

export function getPracticeFeedbackMessage(label: PracticeFeedbackLabel) {
  if (label === 'Perfect') {
    return 'Clean comms. That callout landed exactly right.';
  }

  if (label === 'Close') {
    return 'Good rep. You were close enough for a pass.';
  }

  return 'Try again and match the key words more closely.';
}
