import { useColorScheme } from 'react-native'
import { getThemeTokens, type ThemeMode } from './tokens'
import { useThemePreference } from './ThemePreferenceContext'

export const useAppTheme = () => {
  const colorScheme = useColorScheme()
  const preference = useThemePreference()
  const mode: ThemeMode =
    preference === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : preference
  const colors = getThemeTokens(mode)

  return {
    preference,
    mode,
    isDark: mode === 'dark',
    colors,
  }
}
