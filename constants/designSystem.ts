import { themeTokens } from '@/lib/theme/tokens';

/**
 * Backward-compatible exports while screens migrate to `useAppTheme()`.
 * Defaults to dark palette to avoid sudden regressions.
 */
const t = themeTokens.dark;

export const colors = {
  black: t.colors.background,
  dark: t.colors.background,
  dark2: t.colors.backgroundElevated,
  darkCard: t.colors.surface,
  gold: t.colors.accent,
  goldLight: '#D4BC72',
  goldDim: t.colors.border,
  white: t.colors.text,
  gray1: t.colors.textMuted,
  gray2: t.colors.textCaption,
  success: t.colors.success,
  warning: t.colors.warning,
  danger: t.colors.danger,
  navy: t.colors.navy,
  burntOrange: t.colors.burntOrange,
  coral: t.colors.coral,
} as const;

export const typography = {
  display: t.typography.display,
  h1: t.typography.h1,
  h2: t.typography.h2,
  body: t.typography.body,
  tagline: {
    ...t.typography.body,
    fontFamily: 'DMSans_400Regular',
  },
  label: {
    ...t.typography.label,
    letterSpacing: 1.1,
  },
} as const;
