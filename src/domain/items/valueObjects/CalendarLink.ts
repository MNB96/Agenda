export interface CalendarLinkInput {
  /** Calendar id for an event link; task list id (always '@default' today) for a task link. */
  calendarId: string
  /** Event id for an event link; task id for a task link. */
  eventId: string
  lastSyncedAt: string
  /** 'app' if this app created the resource; 'external' if it was pre-existing and only linked. */
  origin: 'app' | 'external'
  /** Which Google API this points to. Missing on old links predating Tasks support — always an event then. */
  kind?: 'event' | 'task'
}

export class CalendarLink {
  // declare = type-only, erased by the compiler — avoids a real field leaking into spreads/JSON.
  private declare readonly _brand: void

  private constructor(
    public readonly calendarId: string,
    public readonly eventId: string,
    public readonly lastSyncedAt: string,
    public readonly origin: CalendarLinkInput['origin'],
    public readonly kind: 'event' | 'task',
  ) {}

  static create(input: CalendarLinkInput): CalendarLink {
    const calendarId = input.calendarId.trim()
    const eventId = input.eventId.trim()
    if (!calendarId || !eventId) {
      throw new Error('Falta el id del calendario o del evento.')
    }
    return new CalendarLink(calendarId, eventId, input.lastSyncedAt, input.origin, input.kind ?? 'event')
  }
}
