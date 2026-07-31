import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../../domain/settings/types'

export type ThemePreference = Settings['themePreference']

const ThemePreferenceContext = createContext<ThemePreference>('system')

interface ThemePreferenceProviderProps {
  preference: ThemePreference
  children: ReactNode
}

export const ThemePreferenceProvider = ({ preference, children }: ThemePreferenceProviderProps) => (
  <ThemePreferenceContext.Provider value={preference}>{children}</ThemePreferenceContext.Provider>
)

export const useThemePreference = () => useContext(ThemePreferenceContext)
