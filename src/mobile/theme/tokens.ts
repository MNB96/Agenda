export interface AppColors {
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
  border: string

  text: string
  textSecondary: string
  textMuted: string

  success: string
  warning: string
  danger: string
  info: string

  interactive: string
  interactiveMuted: string
}

export interface AppTheme {
  dark: boolean
  colors: AppColors
}

const lightColors: AppColors = {
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
  overlayAccent: 'rgba(255,156,0,0.19)',

  background: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F5EE',
  border: '#E6EAE1',

  text: '#1F2D36',
  textSecondary: '#4E6771',
  textMuted: '#7A9099',

  success: '#7CCFC0',
  warning: '#F38630',
  danger: '#FA6900',
  info: '#69D2E7',

  interactive: '#69D2E7',
  interactiveMuted: '#B9C7CC',
}

const darkColors: AppColors = {
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
  overlayAccent: 'rgba(255,156,0,0.19)',

  background: '#111A22',
  surface: '#18232D',
  surfaceSecondary: '#20303A',
  border: '#2B3D48',

  text: '#E9F2F3',
  textSecondary: '#B5C8CD',
  textMuted: '#8CA2A8',

  success: '#7CCFC0',
  warning: '#F58B27',
  danger: '#FB6D00',
  info: '#69D2E7',

  interactive: '#69D2E7',
  interactiveMuted: '#5A6F78',
}

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
}

export const darkTheme: AppTheme = {
  dark: true,
  colors: darkColors,
}
