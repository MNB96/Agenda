export interface CalendarInfo {
  id: string
  summary: string
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  location?: string
  startDateTime: string
  endDateTime?: string
  allDay?: boolean
}
