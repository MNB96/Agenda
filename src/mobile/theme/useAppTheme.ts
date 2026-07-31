import { useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { darkTheme, lightTheme } from './tokens'

export const useAppTheme = () => {
  const scheme = useColorScheme()

  return useMemo(() => {
    if (scheme === 'dark') {
      return darkTheme
    }
    return lightTheme
  }, [scheme])
}
