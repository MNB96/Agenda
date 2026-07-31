export type ThemeMode = 'light' | 'dark'

export interface ThemeTokens {
  primary: string
  primarySoft: string
  secondary: string
  secondarySoft: string
  cream: string
  creamSoft: string
  accent: string
  accentSoft: string
  accentStrong: string
  accentStrongSoft: string
  overlayAccent: string

  background: string
  surface: string
  surfaceSecondary: string
  surfaceElevated: string
  border: string
  borderStrong: string

  text: string
  textSecondary: string
  textMuted: string

  success: string
  warning: string
  danger: string

  fabText: string
  onPrimary: string
}

const lightTokens: ThemeTokens = {
  primary: '#69D2E7',
  primarySoft: '#7DD4E2',
  secondary: '#A7DBD8',
  secondarySoft: '#B8DDD1',
  cream: '#E0E4CC',
  creamSoft: '#E6E5C2',
  accent: '#F38630',
  accentSoft: '#F58B27',
  accentStrong: '#FA6900',
  accentStrongSoft: '#FB6D00',
  overlayAccent: 'rgba(38, 50, 56, 0.2)',

  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSecondary: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E9F1F2',
  borderStrong: '#D8E8EA',

  text: '#263238',
  textSecondary: '#4D6168',
  textMuted: '#7A8C93',

  success: '#A7DBD8',
  warning: '#F38630',
  danger: '#FA6900',

  fabText: '#FFFFFF',
  onPrimary: '#263238',
}

const darkTokens: ThemeTokens = {
  primary: '#69D2E7',
  primarySoft: '#7DD4E2',
  secondary: '#A7DBD8',
  secondarySoft: '#B8DDD1',
  cream: '#E0E4CC',
  creamSoft: '#E6E5C2',
  accent: '#F38630',
  accentSoft: '#F58B27',
  accentStrong: '#FA6900',
  accentStrongSoft: '#FB6D00',
  overlayAccent: 'rgba(14, 25, 29, 0.72)',

  background: '#0E191D',
  surface: '#111F24',
  surfaceSecondary: '#192B30',
  surfaceElevated: '#16272C',
  border: 'rgba(167, 219, 216, 0.14)',
  borderStrong: 'rgba(167, 219, 216, 0.22)',

  text: '#F5F7F4',
  textSecondary: '#B2BEBB',
  textMuted: '#7F9190',

  success: '#A7DBD8',
  warning: '#F38630',
  danger: '#FA6900',

  fabText: '#FFFFFF',
  onPrimary: '#0E191D',
}

export const getThemeTokens = (mode: ThemeMode): ThemeTokens =>
  mode === 'dark' ? darkTokens : lightTokens
