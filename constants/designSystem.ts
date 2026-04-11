import type { TextStyle } from 'react-native';

export const colors = {
  black: '#000000',
  dark: '#0A0806',
  dark2: '#110E06',
  darkCard: '#141009',
  gold: '#C9A84C',
  goldLight: '#E2C97E',
  goldDim: 'rgba(201,168,76,0.35)',
  white: '#F5F0E8',
  gray1: 'rgba(245,240,232,0.75)',
  gray2: 'rgba(245,240,232,0.55)',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
} as const;

export const typography = {
  display: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 48,
  } satisfies TextStyle,
  h1: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 36,
  } satisfies TextStyle,
  h2: {
    fontFamily: 'CormorantGaramond_300Light',
    fontSize: 28,
  } satisfies TextStyle,
  body: {
    fontFamily: 'Jost_300Light',
    fontSize: 15,
  } satisfies TextStyle,
  label: {
    fontFamily: 'Jost_300Light',
    fontSize: 10,
    letterSpacing: 3,
  } satisfies TextStyle,
} as const;
