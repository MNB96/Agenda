export interface RepeatConfigInput {
  unit: 'day' | 'week' | 'month' | 'year'
  interval: number
  daysOfWeek?: number[]
  time?: string
  end: 'never' | 'on_date' | 'after_occurrences'
  endDate?: string
  occurrences?: number
  /** How many instances of this series have been completed so far (including this one). */
  occurrencesDone?: number
}

// Private constructor + brand field: the only way to get an instance is create(), which
// validates. A plain object literal (even one shaped exactly like this) is not assignable to
// this type — TypeScript rejects it because it's missing the private brand, not just by
// convention. See the "constructores reales" discussion this was built for.
export class RepeatConfig {
  private readonly _brand = 'RepeatConfig' as const

  private constructor(
    public readonly unit: RepeatConfigInput['unit'],
    public readonly interval: number,
    public readonly end: RepeatConfigInput['end'],
    public readonly daysOfWeek: number[] | undefined,
    public readonly time: string | undefined,
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
    if (input.end === 'on_date' && !input.endDate) {
      throw new Error('Falta la fecha de fin de la repetición.')
    }
    if (input.end === 'after_occurrences' && (!input.occurrences || input.occurrences <= 0)) {
      throw new Error('Falta la cantidad de repeticiones.')
    }
    return new RepeatConfig(
      input.unit,
      input.interval,
      input.end,
      input.daysOfWeek,
      input.time,
      input.endDate,
      input.occurrences,
      input.occurrencesDone,
    )
  }
}
