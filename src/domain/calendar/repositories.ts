import type { CalendarEvent, CalendarInfo } from './types'

export interface CalendarRepository {
  listCalendars(accessToken: string): Promise<CalendarInfo[]>
  listEvents(
    accessToken: string,
    calendarIds: string[],
    params: { timeMin: string; timeMax: string },
  ): Promise<CalendarEvent[]>
  createEvent(
    accessToken: string,
    calendarId: string,
    payload: {
      summary: string
      description?: string
      location?: string
      startDateTime: string
      endDateTime: string
      allDay?: boolean
    },
  ): Promise<{ eventId: string }>
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    payload: {
      summary: string
      description?: string
      location?: string
      startDateTime: string
      endDateTime: string
      allDay?: boolean
    },
  ): Promise<void>
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>
}
