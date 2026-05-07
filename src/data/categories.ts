import type { PhraseCategory } from '../types/phrase';

export type CategoryMetadata = {
  title: string;
  description: string;
  icon: string;
};

export const categoryMetadata: Record<PhraseCategory, CategoryMetadata> = {
  callouts: {
    title: 'Callouts',
    description: 'Fast enemy-position and map-info phrases used mid-round.',
    icon: '📡',
  },
  instructions: {
    title: 'Instructions',
    description: 'Short command phrases for immediate team direction.',
    icon: '🎯',
  },
  strategy: {
    title: 'Strategy',
    description: 'Round-planning phrases for tempo, rotations, and spacing.',
    icon: '♟️',
  },
  objective: {
    title: 'Objective',
    description: 'Communication for plants, defuses, captures, and site control.',
    icon: '🏁',
  },
  danger: {
    title: 'Danger',
    description: 'Urgent warnings about threats, flanks, and incoming pressure.',
    icon: '⚠️',
  },
  economy: {
    title: 'Economy',
    description: 'Buy, save, and resource-management callouts between rounds.',
    icon: '💰',
  },
  teamwork: {
    title: 'Teamwork',
    description: 'Phrases for utility combos, trades, and coordinated support.',
    icon: '🤝',
  },
  slang: {
    title: 'Slang',
    description: 'Common shorthand and community jargon heard in matches.',
    icon: '🗣️',
  },
  toxic: {
    title: 'Toxic',
    description: 'Harsh phrases players may hear during tilt or blame.',
    icon: '☣️',
  },
  antiToxic: {
    title: 'Anti-Toxic',
    description: 'Calmer alternatives that keep comms useful and respectful.',
    icon: '🛡️',
  },
  custom: {
    title: 'Custom',
    description: 'Words you added yourself for the current language setup.',
    icon: '✨',
  },
};

export const featuredCategories: PhraseCategory[] = [
  'callouts',
  'danger',
  'instructions',
];
