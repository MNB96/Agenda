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

// Medio día o día completo son los únicos usos reales de una licencia por examen.
export const createLicenseUsage = (input: LicenseUsageInput): LicenseUsage => {
  if (input.days !== 0.5 && input.days !== 1) {
    throw new Error('Los días de licencia deben ser 0.5 (medio día) o 1 (día completo).')
  }
  return { ...input }
}
