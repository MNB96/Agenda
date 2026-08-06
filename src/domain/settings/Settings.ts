import type { Settings } from './types'

// Entity-level invariant: a negative number of leave days doesn't mean anything. Settings is a
// single always-existing record (no separate "create" step, only ever updated), so there's one
// validating function instead of a create/update pair.
export const validateSettings = (settings: Settings): void => {
  if (settings.availableExamLeaveDaysPerYear < 0) {
    throw new Error('Los días de licencia disponibles no pueden ser negativos.')
  }
}

export const updateSettings = (current: Settings, patch: Partial<Settings>): Settings => {
  const next: Settings = { ...current, ...patch }
  validateSettings(next)
  return next
}
