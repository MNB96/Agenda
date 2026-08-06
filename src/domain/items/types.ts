export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RepeatConfig {
  unit: 'day' | 'week' | 'month' | 'year'
  interval: number
  daysOfWeek?: number[]
  time?: string
  end: 'never' | 'on_date' | 'after_occurrences'
  endDate?: string
  occurrences?: number
  /** How many instances of this series have been completed so far (including this one). */
  occurrencesDone?: number
}

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
  alarmType?: 'notification' | 'alarm'
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
  studyTimeBefore?: 'half' | 'full'
  grade?: number
}

export interface DateWindow {
  startDate?: string
  endDate?: string
}

export interface CalendarLink {
  calendarId: string
  eventId: string
  lastSyncedAt: string
  /** 'app' if this app created the calendar event; 'external' if it was pre-existing and only linked. */
  origin: 'app' | 'external'
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
  important?: boolean
  repeatRule?: RepeatRule
  repeatConfig?: RepeatConfig
  parentId?: string
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
  syncToCalendar?: boolean
  calendarLink?: CalendarLink
  calendarSyncPending?: boolean
  notificationIds?: string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface NewItemInput {
  title: string
  description?: string
  type?: ItemType
  important?: boolean
  repeatRule?: RepeatRule
  repeatConfig?: RepeatConfig
  parentId?: string
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
  syncToCalendar?: boolean
}