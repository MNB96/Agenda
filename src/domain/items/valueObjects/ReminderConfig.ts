export interface ReminderConfigInput {
  id: string
  mode: 'absolute' | 'relative' | 'departure'
  minutesBefore?: number
  dateTime?: string
  persistent?: boolean
  alarmType?: 'notification' | 'alarm'
}

export class ReminderConfig {
  private readonly _brand = 'ReminderConfig' as const

  private constructor(
    public readonly id: string,
    public readonly mode: ReminderConfigInput['mode'],
    public readonly minutesBefore: number | undefined,
    public readonly dateTime: string | undefined,
    public readonly persistent: boolean | undefined,
    public readonly alarmType: ReminderConfigInput['alarmType'],
  ) {}

  static create(input: ReminderConfigInput): ReminderConfig {
    if (input.mode === 'absolute' && !input.dateTime) {
      throw new Error('Falta la fecha y hora del recordatorio.')
    }
    if (
      (input.mode === 'relative' || input.mode === 'departure') &&
      (input.minutesBefore === undefined || input.minutesBefore < 0)
    ) {
      throw new Error('Falta cuántos minutos antes va el recordatorio.')
    }
    return new ReminderConfig(input.id, input.mode, input.minutesBefore, input.dateTime, input.persistent, input.alarmType)
  }
}
