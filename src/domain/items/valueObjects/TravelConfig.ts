export type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling'

export interface TravelConfigInput {
  transport: TransportMode
  extraMinutes: number
  departureReminderEnabled: boolean
}

export class TravelConfig {
  // declare = type-only, erased by the compiler — avoids a real field leaking into spreads/JSON.
  private declare readonly _brand: void

  private constructor(
    public readonly transport: TransportMode,
    public readonly extraMinutes: number,
    public readonly departureReminderEnabled: boolean,
  ) {}

  static create(input: TravelConfigInput): TravelConfig {
    if (!Number.isFinite(input.extraMinutes) || input.extraMinutes < 0) {
      throw new Error('Los minutos extra de viaje no pueden ser negativos.')
    }
    return new TravelConfig(input.transport, input.extraMinutes, input.departureReminderEnabled)
  }
}
