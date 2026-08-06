import { useColorScheme } from 'react-native'
import { getThemeTokens, type ThemeMode } from './tokens'
import { useSettings } from '../../features/settings/useSettings'

export const useAppTheme = () => {
  const colorScheme = useColorScheme()
  const { data: settings } = useSettings()
  const preference = settings?.themePreference ?? 'system'
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
