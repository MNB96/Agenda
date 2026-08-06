export interface ReminderConfigInput {
  id: string
  mode: 'relative' | 'departure'
  minutesBefore?: number
  persistent?: boolean
  alarmType?: 'notification' | 'alarm'
}

export class ReminderConfig {
  // declare = type-only, erased by the compiler — avoids a real field leaking into spreads/JSON.
  private declare readonly _brand: void

  private constructor(
    public readonly id: string,
    public readonly mode: ReminderConfigInput['mode'],
    public readonly minutesBefore: number | undefined,
    public readonly persistent: boolean | undefined,
    public readonly alarmType: ReminderConfigInput['alarmType'],
  ) {}

  static create(input: ReminderConfigInput): ReminderConfig {
    if (input.minutesBefore === undefined || !Number.isFinite(input.minutesBefore) || input.minutesBefore < 0) {
      throw new Error('Falta cuántos minutos antes va el recordatorio.')
    }
    return new ReminderConfig(input.id, input.mode, input.minutesBefore, input.persistent, input.alarmType)
  }
}
