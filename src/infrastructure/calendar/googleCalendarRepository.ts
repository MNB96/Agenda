import type { CalendarEvent, CalendarInfo } from '../../domain/calendar/types'
import type { CalendarRepository } from '../../domain/calendar/repositories'
import { GoogleCalendarAuthError } from './errors'

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

const buildHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
})

const encodeCalendarId = (calendarId: string): string => encodeURIComponent(calendarId)

const ensureOk = async (response: Response, defaultMessage: string): Promise<void> => {
  if (response.ok) {
    return
  }
  if (response.status === 401 || response.status === 403) {
    throw new GoogleCalendarAuthError()
  }
  throw new Error(defaultMessage)
}

export class GoogleCalendarRepository implements CalendarRepository {
  async listCalendars(accessToken: string): Promise<CalendarInfo[]> {
    const response = await fetch(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`, {
      headers: buildHeaders(accessToken),
    })
    await ensureOk(response, 'No se pudieron cargar los calendarios de Google.')
    const data = (await response.json()) as { items?: Record<string, unknown>[] }
    return (data.items ?? []).map((entry) => ({
      id: String(entry.id),
      summary: String(entry.summary ?? 'Calendario sin nombre'),
      primary: Boolean(entry.primary),
      selected: Boolean(entry.selected),
    }))
  }

  async listEvents(
    accessToken: string,
    calendarIds: string[],
    params: { timeMin: string; timeMax: string },
  ): Promise<CalendarEvent[]> {
    const events = await Promise.all(
      calendarIds.map(async (calendarId) => {
        const query = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin: params.timeMin,
          timeMax: params.timeMax,
          maxResults: '250',
        })

        const response = await fetch(
          `${GOOGLE_CALENDAR_BASE}/calendars/${encodeCalendarId(calendarId)}/events?${query.toString()}`,
          { headers: buildHeaders(accessToken) },
        )

        if (response.status === 401 || response.status === 403) {
          throw new GoogleCalendarAuthError()
        }

        if (!response.ok) {
          return [] as CalendarEvent[]
        }

        const data = (await response.json()) as {
          items?: {
            id: string
            summary?: string
            description?: string
            location?: string
            start?: { dateTime?: string; date?: string }
            end?: { dateTime?: string; date?: string }
          }[]
        }

        return (data.items ?? [])
          .filter((event) => Boolean(event.start?.dateTime ?? event.start?.date))
          .map((event) => {
            const allDay = Boolean(event.start?.date && !event.start?.dateTime)
            const startDateTime = event.start?.dateTime ?? `${event.start?.date}T00:00:00.000Z`
            const endDateTime = event.end?.dateTime ?? (event.end?.date ? `${event.end.date}T00:00:00.000Z` : undefined)
            return {
              id: event.id,
              calendarId,
              title: event.summary ?? 'Sin titulo',
              description: event.description,
              location: event.location,
              startDateTime,
              endDateTime,
              allDay,
            }
          })
      }),
    )

    return events.flat().sort((eventA, eventB) => eventA.startDateTime.localeCompare(eventB.startDateTime))
  }

  async createEvent(
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
  ): Promise<{ eventId: string }> {
    const response = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeCalendarId(calendarId)}/events`, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(
        payload.allDay
          ? {
              summary: payload.summary,
              description: payload.description,
              location: payload.location,
              start: { date: payload.startDateTime.slice(0, 10) },
              end: { date: payload.endDateTime.slice(0, 10) },
            }
          : {
              summary: payload.summary,
              description: payload.description,
              location: payload.location,
              start: { dateTime: payload.startDateTime },
              end: { dateTime: payload.endDateTime },
            },
      ),
    })

    await ensureOk(response, 'No se pudo crear el evento en Google Calendar.')

    const data = (await response.json()) as { id: string }
    return { eventId: data.id }
  }

  async updateEvent(
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
  ): Promise<void> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeCalendarId(calendarId)}/events/${eventId}`,
      {
        method: 'PUT',
        headers: buildHeaders(accessToken),
        body: JSON.stringify(
          payload.allDay
            ? {
                summary: payload.summary,
                description: payload.description,
                location: payload.location,
                start: { date: payload.startDateTime.slice(0, 10) },
                end: { date: payload.endDateTime.slice(0, 10) },
              }
            : {
                summary: payload.summary,
                description: payload.description,
                location: payload.location,
                start: { dateTime: payload.startDateTime },
                end: { dateTime: payload.endDateTime },
              },
        ),
      },
    )

    await ensureOk(response, 'No se pudo actualizar el evento de Google Calendar.')
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_BASE}/calendars/${encodeCalendarId(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: buildHeaders(accessToken),
      },
    )

    if (response.status === 401 || response.status === 403) {
      throw new GoogleCalendarAuthError()
    }

    if (!response.ok && response.status !== 404) {
      throw new Error('No se pudo eliminar el evento de Google Calendar.')
    }
  }
}