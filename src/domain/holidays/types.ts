export type HolidayType = 'inamovible' | 'trasladable' | 'puente'

export interface Holiday {
  date: string
  type: HolidayType
  name: string
}
