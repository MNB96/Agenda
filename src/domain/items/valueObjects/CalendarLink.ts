export interface CalendarLinkInput {
  calendarId: string
  eventId: string
  lastSyncedAt: string
  /** 'app' if this app created the calendar event; 'external' if it was pre-existing and only linked. */
  origin: 'app' | 'external'
}

export class CalendarLink {
  private readonly _brand = 'CalendarLink' as const

  private constructor(
    public readonly calendarId: string,
    public readonly eventId: string,
    public readonly lastSyncedAt: string,
    public readonly origin: CalendarLinkInput['origin'],
  ) {}

  static create(input: CalendarLinkInput): CalendarLink {
    if (!input.calendarId.trim() || !input.eventId.trim()) {
      throw new Error('Falta el id del calendario o del evento.')
    }
    return new CalendarLink(input.calendarId, input.eventId, input.lastSyncedAt, input.origin)
  }
}
