import type { ItemCategory, TransportMode } from '../items/types'

export interface LicenseUsage {
  id: string
  date: string
  itemId?: string
  days: number
  note?: string
}

export interface Settings {
  id: 'main'
  visibleCategoryIds: string[]
  showCompletedItems: boolean
  defaultTransport: TransportMode
  defaultTravelExtraMinutes: number
  remindersEnabled: boolean
  defaultReminderMinutes: number
  availableExamLeaveDaysPerYear: number
  categories: ItemCategory[]
  selectedGoogleCalendarIds: string[]
  locationPermissionRequested: boolean
}

export interface SettingsRepository {
  get(): Promise<Settings>
  save(next: Settings): Promise<Settings>
  listLicenseUsages(): Promise<LicenseUsage[]>
  saveLicenseUsage(usage: LicenseUsage): Promise<LicenseUsage>
  deleteLicenseUsage(id: string): Promise<void>
}

export const DEFAULT_CATEGORIES: ItemCategory[] = [
  { id: 'facultad', name: 'Facultad', color: '#6a4c93', icon: 'GraduationCap' },
  { id: 'trabajo', name: 'Trabajo', color: '#006d77', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#9c6644', icon: 'Heart' },
  { id: 'casa', name: 'Casa', color: '#bc6c25', icon: 'Home' },
  { id: 'salud', name: 'Salud', color: '#2a9d8f', icon: 'Cross' },
  { id: 'compras', name: 'Compras', color: '#e76f51', icon: 'ShoppingCart' },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  visibleCategoryIds: [],
  showCompletedItems: false,
  defaultTransport: 'transit',
  defaultTravelExtraMinutes: 10,
  remindersEnabled: true,
  defaultReminderMinutes: 60,
  availableExamLeaveDaysPerYear: 10,
  categories: DEFAULT_CATEGORIES,
  selectedGoogleCalendarIds: [],
  locationPermissionRequested: false,
}