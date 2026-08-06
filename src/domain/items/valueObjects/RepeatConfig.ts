import { isValidCalendarDate } from '../../../utils/calendarDate'

export interface RepeatConfigInput {
  unit: 'hour' | 'day' | 'week' | 'month' | 'year'
  interval: number
  daysOfWeek?: number[]
  end: 'never' | 'on_date' | 'after_occurrences'
  endDate?: string
  occurrences?: number
  /** How many previous occurrences of this series have already been completed. */
  occurrencesDone?: number
}

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

// Private constructor + brand: only create() produces an instance, and it validates.
export class RepeatConfig {
  // declare = type-only, erased by the compiler — avoids a real field leaking into spreads/JSON.
  private declare readonly _brand: void

  private constructor(
    public readonly unit: RepeatConfigInput['unit'],
    public readonly interval: number,
    public readonly end: RepeatConfigInput['end'],
    public readonly daysOfWeek: readonly number[] | undefined,
    public readonly endDate: string | undefined,
    public readonly occurrences: number | undefined,
    public readonly occurrencesDone: number | undefined,
  ) {}

  static create(input: RepeatConfigInput): RepeatConfig {
    if (!Number.isInteger(input.interval) || input.interval <= 0) {
      throw new Error('El intervalo de repetición debe ser un número entero mayor a 0.')
    }
    if (input.daysOfWeek?.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error('Los días de la semana deben estar entre 0 (lunes) y 6 (domingo).')
    }
    // Garantía del dominio, no solo convención del caller (RepeatPanel).
    if (input.daysOfWeek?.length && input.unit !== 'week') {
      throw new Error('Los días de la semana solo aplican a una repetición semanal.')
    }
    if (input.end === 'on_date') {
      if (!input.endDate) {
        throw new Error('Falta la fecha de fin de la repetición.')
      }
      if (!DATE_FORMAT.test(input.endDate)) {
        throw new Error('La fecha de fin de la repetición no es válida.')
      }
      const [endYear, endMonth, endDay] = input.endDate.split('-').map(Number)
      if (!isValidCalendarDate(endYear, endMonth, endDay)) {
        throw new Error('La fecha de fin de la repetición no es válida.')
      }
    } else if (input.endDate) {
      throw new Error('La fecha de fin solo aplica cuando la repetición termina en una fecha.')
    }
    if (input.end === 'after_occurrences') {
      if (!input.occurrences || !Number.isInteger(input.occurrences) || input.occurrences <= 0) {
        throw new Error('Falta la cantidad de repeticiones.')
      }
    } else if (input.occurrences !== undefined) {
      throw new Error('La cantidad de repeticiones solo aplica cuando la repetición termina después de N repeticiones.')
    }
    if (input.occurrencesDone !== undefined) {
      if (!Number.isInteger(input.occurrencesDone) || input.occurrencesDone < 0) {
        throw new Error('La cantidad de repeticiones cumplidas debe ser un entero mayor o igual a 0.')
      }
      if (input.occurrences !== undefined && input.occurrencesDone > input.occurrences) {
        throw new Error('La cantidad de repeticiones cumplidas no puede superar el total.')
      }
    }

    // Copia propia, ordenada y sin duplicados — no arrastra la referencia mutable del caller.
    const daysOfWeek = input.daysOfWeek?.length
      ? [...new Set(input.daysOfWeek)].sort((dayA, dayB) => dayA - dayB)
      : undefined

    return new RepeatConfig(
      input.unit,
      input.interval,
      input.end,
      daysOfWeek,
      input.endDate,
      input.occurrences,
      input.occurrencesDone,
    )
  }
}
