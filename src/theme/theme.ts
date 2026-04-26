import type { TextStyle, ViewStyle } from 'react-native';

const palette = {
  background: '#F7F8FC',
  card: '#FFFFFF',
  primary: '#5865F2',
  accent: '#22C55E',
  danger: '#EF4444',
  text: '#111827',
  mutedText: '#6B7280',
  border: '#E5E7EB',
} as const;

const colors = {
  ...palette,
  surface: palette.card,
  secondary: '#818CF8',
  textPrimary: palette.text,
  textSecondary: palette.mutedText,
} as const;

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

const createCardShadow = (): ViewStyle => ({
  shadowColor: '#111827',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 3,
});

const typography = {
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  } as TextStyle,
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  } as TextStyle,
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  } as TextStyle,
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  } as TextStyle,
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  } as TextStyle,
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  } as TextStyle,
} as const;

export const withAlpha = (hexColor: string, alpha: number) => {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const normalizedHex = hexColor.replace('#', '');
  const expandedHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split('')
          .map(value => value + value)
          .join('')
      : normalizedHex;

  const red = parseInt(expandedHex.slice(0, 2), 16);
  const green = parseInt(expandedHex.slice(2, 4), 16);
  const blue = parseInt(expandedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clampedAlpha})`;
};

export const theme = {
  colors,
  spacing,
  radius,
  shadows: {
    card: createCardShadow(),
    surface: createCardShadow(),
    glowPrimary: createCardShadow(),
    glowSecondary: createCardShadow(),
    glowAccent: createCardShadow(),
    glowDanger: createCardShadow(),
  },
  typography,
} as const;

export type Theme = typeof theme;
export type AccentTone = 'primary' | 'secondary' | 'accent' | 'danger';
