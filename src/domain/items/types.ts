export type ItemType =
  | 'task'
  | 'event'
  | 'deadline'
  | 'reminder'
  | 'goal'
  | 'important_date'
  | 'date_window'

export type ItemStatus = 'active' | 'completed' | 'archived'

export type TransportMode = 'driving' | 'walking' | 'transit' | 'cycling'

export interface ReminderConfig {
  id: string
  mode: 'absolute' | 'relative' | 'departure'
  minutesBefore?: number
  dateTime?: string
  persistent?: boolean
}

export interface TravelConfig {
  transport: TransportMode
  extraMinutes: number
  departureReminderEnabled: boolean
}

export interface GoalConfig {
  targetValue: number
  currentValue: number
  unit?: string
  isBinary?: boolean
}

export interface AcademicConfig {
  licenseRequested?: boolean
  openReminderDaysBefore?: number[]
  closeReminderDaysBefore?: number[]
}

export interface DateWindow {
  startDate?: string
  endDate?: string
}

export interface GoogleCalendarLink {
  calendarId: string
  eventId: string
  lastSyncedAt: string
  source: 'app' | 'google'
}

export interface ItemCategory {
  id: string
  name: string
  color: string
  icon: string
}

export interface Item {
  id: string
  title: string
  description?: string
  type: ItemType
  status: ItemStatus
  categoryId?: string
  location?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  deadline?: string
  dateWindow?: DateWindow
  reminderConfig?: ReminderConfig[]
  travelConfig?: TravelConfig
  goalConfig?: GoalConfig
  academicConfig?: AcademicConfig
  syncToGoogleCalendar?: boolean
  googleCalendarLink?: GoogleCalendarLink
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface NewItemInput {
  title: string
  description?: string
  type?: ItemType
  categoryId?: string
  location?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  deadline?: string
  dateWindow?: DateWindow
  reminderConfig?: ReminderConfig[]
  travelConfig?: TravelConfig
  goalConfig?: GoalConfig
  academicConfig?: AcademicConfig
  syncToGoogleCalendar?: boolean
}