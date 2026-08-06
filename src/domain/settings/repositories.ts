import type { LicenseUsage, Settings } from './types'

export interface SettingsRepository {
  get(): Promise<Settings>
  save(next: Settings): Promise<Settings>
  listLicenseUsages(): Promise<LicenseUsage[]>
  saveLicenseUsage(usage: LicenseUsage): Promise<LicenseUsage>
  deleteLicenseUsage(id: string): Promise<void>
}
