export interface DateWindowInput {
  startDate?: string
  endDate?: string
}

export class DateWindow {
  private readonly _brand = 'DateWindow' as const

  private constructor(
    public readonly startDate: string | undefined,
    public readonly endDate: string | undefined,
  ) {}

  static create(input: DateWindowInput): DateWindow {
    if (input.startDate && input.endDate && input.endDate < input.startDate) {
      throw new Error('La fecha de cierre no puede ser anterior a la fecha de apertura.')
    }
    return new DateWindow(input.startDate, input.endDate)
  }
}
