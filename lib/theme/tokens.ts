import type { TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

type ThemeColors = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceSoft: string;
  text: string;
  textMuted: string;
  textCaption: string;
  accent: string;
  accentSoft: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  navy: string;
  burntOrange: string;
  coral: string;
  gold: string;
};

type ThemeTypography = {
  display: TextStyle;
  h1: TextStyle;
  h2: TextStyle;
  section: TextStyle;
  body: TextStyle;
  secondary: TextStyle;
  caption: TextStyle;
  button: TextStyle;
  metric: TextStyle;
  label: TextStyle;
};

type ThemeShadows = {
  card: ViewStyle;
  soft: ViewStyle;
};

export type ThemeTokens = {
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pageX: number;
    pageTop: number;
    pageBottom: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  shadows: ThemeShadows;
  typography: ThemeTypography;
};

const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pageX: 24,
  pageTop: 24,
  pageBottom: 24,
} as const;

const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

const typography = {
  display: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 48,
    lineHeight: 52,
  } satisfies TextStyle,
  h1: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 36,
    lineHeight: 40,
  } satisfies TextStyle,
  h2: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 28,
    lineHeight: 32,
  } satisfies TextStyle,
  section: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 24,
    lineHeight: 28,
  } satisfies TextStyle,
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 24,
  } satisfies TextStyle,
  secondary: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 21,
  } satisfies TextStyle,
  caption: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 18,
  } satisfies TextStyle,
  button: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  } satisfies TextStyle,
  metric: {
    fontFamily: 'PTSerif_400Regular',
    fontSize: 40,
    lineHeight: 44,
  } satisfies TextStyle,
  label: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 0.5,
  } satisfies TextStyle,
} as const;

const dark: ThemeTokens = {
  colors: {
    background: '#0B0C0F',
    backgroundElevated: '#101218',
    surface: '#151923',
    surfaceSoft: '#1A2030',
    text: '#F4F1E8',
    textMuted: 'rgba(244,241,232,0.78)',
    textCaption: 'rgba(244,241,232,0.58)',
    accent: '#B8962E',
    accentSoft: 'rgba(184,150,46,0.24)',
    border: 'rgba(184,150,46,0.34)',
    success: '#5CB88A',
    warning: '#D4826A',
    danger: '#E86B6B',
    navy: '#1B3A5C',
    burntOrange: '#C4622D',
    coral: '#D4826A',
    gold: '#B8962E',
  },
  spacing,
  radius,
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    soft: {
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
  },
  typography,
};

const light: ThemeTokens = {
  colors: {
    background: '#F5F0E7',
    backgroundElevated: '#F8F3EA',
    surface: '#FFFDF8',
    surfaceSoft: '#F2EADF',
    text: '#1E1B17',
    textMuted: 'rgba(30,27,23,0.78)',
    textCaption: 'rgba(30,27,23,0.58)',
    accent: '#B8962E',
    accentSoft: 'rgba(184,150,46,0.18)',
    border: 'rgba(97,79,29,0.24)',
    success: '#3D8B66',
    warning: '#C4622D',
    danger: '#B84A4A',
    navy: '#1B3A5C',
    burntOrange: '#C4622D',
    coral: '#D4826A',
    gold: '#B8962E',
  },
  spacing,
  radius,
  shadows: {
    card: {
      shadowColor: '#30261A',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    soft: {
      shadowColor: '#30261A',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
  },
  typography,
};

export const themeTokens: Record<ResolvedTheme, ThemeTokens> = {
  dark,
  light,
};
