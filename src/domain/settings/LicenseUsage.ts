export interface LicenseUsage {
  id: string
  date: string
  itemId?: string
  days: number
  note?: string
}

export interface LicenseUsageInput {
  id: string
  date: string
  itemId?: string
  days: number
  note?: string
}

// A "day of study leave" logged for less than a day, or none at all, isn't a real usage —
// today the only two values the UI ever produces are 0.5 (half day) and 1 (full day), but this
// protects the invariant regardless of which call site constructs one.
export const createLicenseUsage = (input: LicenseUsageInput): LicenseUsage => {
  if (input.days <= 0) {
    throw new Error('Los días de licencia deben ser mayores a 0.')
  }
  return { ...input }
}
