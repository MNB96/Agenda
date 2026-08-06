export interface CalendarInfo {
  id: string
  summary: string
  primary?: boolean
  selected?: boolean
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
