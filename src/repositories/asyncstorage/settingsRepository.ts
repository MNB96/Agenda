import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  DEFAULT_SETTINGS,
  type LicenseUsage,
  type Settings,
  type SettingsRepository,
} from '../../domain/settings/types'

const SETTINGS_KEY = '@agenda/settings'
const LICENSES_KEY = '@agenda/licenses'

const parseOrDefault = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export class AsyncStorageSettingsRepository implements SettingsRepository {
  async get(): Promise<Settings> {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    const stored = parseOrDefault<Settings | undefined>(raw, undefined)
    if (!stored) {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
      return DEFAULT_SETTINGS
    }
    return { ...DEFAULT_SETTINGS, ...stored }
  }

  async save(next: Settings): Promise<Settings> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    return next
  }

  async listLicenseUsages(): Promise<LicenseUsage[]> {
    const raw = await AsyncStorage.getItem(LICENSES_KEY)
    return parseOrDefault<LicenseUsage[]>(raw, [])
  }

  async saveLicenseUsage(usage: LicenseUsage): Promise<LicenseUsage> {
    const usages = await this.listLicenseUsages()
    const next = usages.some((entry) => entry.id === usage.id)
      ? usages.map((entry) => (entry.id === usage.id ? usage : entry))
      : [usage, ...usages]
    await AsyncStorage.setItem(LICENSES_KEY, JSON.stringify(next))
    return usage
  }

  async deleteLicenseUsage(id: string): Promise<void> {
    const usages = await this.listLicenseUsages()
    const next = usages.filter((entry) => entry.id !== id)
    await AsyncStorage.setItem(LICENSES_KEY, JSON.stringify(next))
  }
}
