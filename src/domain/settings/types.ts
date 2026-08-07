import { GOAL_CATEGORY_IDS, type ItemCategory } from '../items'

export type { LicenseUsage, LicenseUsageInput } from './LicenseUsage'
export { createLicenseUsage } from './LicenseUsage'
export { updateSettings, validateSettings } from './Settings'

export interface Settings {
  id: 'main'
  themePreference: 'system' | 'light' | 'dark'
  availableExamLeaveDaysPerYear: number
  selectedCalendarIds: readonly string[]
  locationPermissionRequested: boolean
  showCategoryIcons: boolean
}

export const DEFAULT_CATEGORIES: readonly ItemCategory[] = [
  { id: 'facultad', name: 'Facultad', color: '#A7DBD8', icon: 'GraduationCap' },
  { id: 'trabajo', name: 'Trabajo', color: '#E0E4CC', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#69D2E7', icon: 'Heart' },
  { id: 'casa', name: 'Casa', color: '#7DD4E2', icon: 'Home' },
  { id: 'salud', name: 'Salud', color: '#B8DDD1', icon: 'Cross' },
  { id: 'compras', name: 'Compras', color: '#E6E5C2', icon: 'ShoppingCart' },
]

// The subset of DEFAULT_CATEGORIES a goal is allowed to have — see Item.ts's validateGoalRestrictions.
export const GOAL_CATEGORIES: readonly ItemCategory[] = DEFAULT_CATEGORIES.filter((category) =>
  (GOAL_CATEGORY_IDS as readonly string[]).includes(category.id),
)

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  themePreference: 'system',
  availableExamLeaveDaysPerYear: 10,
  selectedCalendarIds: [],
  locationPermissionRequested: false,
  showCategoryIcons: true,
}
