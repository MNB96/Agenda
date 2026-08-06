import type { ItemCategory, TransportMode } from '../items/types'

export type { LicenseUsage, LicenseUsageInput } from './LicenseUsage'
export { createLicenseUsage } from './LicenseUsage'
export { updateSettings, validateSettings } from './Settings'

export interface Settings {
  id: 'main'
  themePreference: 'system' | 'light' | 'dark'
  visibleCategoryIds: string[]
  showCompletedItems: boolean
  defaultTransport: TransportMode
  remindersEnabled: boolean
  availableExamLeaveDaysPerYear: number
  categories: ItemCategory[]
  selectedCalendarIds: string[]
  locationPermissionRequested: boolean
}

export const DEFAULT_CATEGORIES: ItemCategory[] = [
  { id: 'facultad', name: 'Facultad', color: '#A7DBD8', icon: 'GraduationCap' },
  { id: 'trabajo', name: 'Trabajo', color: '#E0E4CC', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#69D2E7', icon: 'Heart' },
  { id: 'casa', name: 'Casa', color: '#7DD4E2', icon: 'Home' },
  { id: 'salud', name: 'Salud', color: '#B8DDD1', icon: 'Cross' },
  { id: 'compras', name: 'Compras', color: '#E6E5C2', icon: 'ShoppingCart' },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  themePreference: 'system',
  visibleCategoryIds: [],
  showCompletedItems: false,
  defaultTransport: 'transit',
  remindersEnabled: true,
  availableExamLeaveDaysPerYear: 10,
  categories: DEFAULT_CATEGORIES,
  selectedCalendarIds: [],
  locationPermissionRequested: false,
}
