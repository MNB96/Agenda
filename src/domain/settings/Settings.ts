import type { Settings } from './types'

// Settings is a single always-existing record (no create step), so just one validating function.
export const validateSettings = (settings: Settings): void => {
  if (!Number.isFinite(settings.availableExamLeaveDaysPerYear) || settings.availableExamLeaveDaysPerYear < 0) {
    throw new Error('Los días de licencia disponibles no son válidos.')
  }
}

export const updateSettings = (current: Settings, patch: Partial<Settings>): Settings => {
  const next: Settings = { ...current, ...patch }
  validateSettings(next)
  return next
}
