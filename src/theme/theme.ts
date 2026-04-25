import type { TextStyle, ViewStyle } from 'react-native';

const colors = {
  background: '#0A0A0F',
  surface: '#12121A',
  primary: '#00F0FF',
  secondary: '#9B5CFF',
  accent: '#39FF14',
  danger: '#FF3B3B',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
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
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

const createGlow = (
  color: string,
  opacity: number,
  glowRadius: number,
  elevation: number,
): ViewStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: glowRadius,
  elevation,
});

const createSurfaceShadow = (): ViewStyle => ({
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 10,
});

const typography = {
  title: {
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: colors.textPrimary,
  } as TextStyle,
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.textPrimary,
  } as TextStyle,
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textPrimary,
  } as TextStyle,
  buttonLabel: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: colors.textPrimary,
  } as TextStyle,
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  } as TextStyle,
  caption: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
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
    surface: createSurfaceShadow(),
    glowPrimary: createGlow(colors.primary, 0.38, 18, 12),
    glowSecondary: createGlow(colors.secondary, 0.34, 18, 12),
    glowAccent: createGlow(colors.accent, 0.3, 16, 10),
    glowDanger: createGlow(colors.danger, 0.32, 16, 10),
  },
  typography,
} as const;

export type Theme = typeof theme;
export type AccentTone = 'primary' | 'secondary' | 'accent' | 'danger';
