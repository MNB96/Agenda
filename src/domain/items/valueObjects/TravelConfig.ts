export type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling'

export interface TravelConfigInput {
  transport: TransportMode
  extraMinutes: number
  departureReminderEnabled: boolean
}

export class TravelConfig {
  private readonly _brand = 'TravelConfig' as const

  private constructor(
    public readonly transport: TransportMode,
    public readonly extraMinutes: number,
    public readonly departureReminderEnabled: boolean,
  ) {}

  static create(input: TravelConfigInput): TravelConfig {
    if (input.extraMinutes < 0) {
      throw new Error('Los minutos extra de viaje no pueden ser negativos.')
    }
    return new TravelConfig(input.transport, input.extraMinutes, input.departureReminderEnabled)
  }
}
