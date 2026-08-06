import { Item, type ItemProps } from '../../../domain/items/types'
import { RepeatConfig, type RepeatConfigInput } from '../../../domain/items/valueObjects/RepeatConfig'
import { ReminderConfig, type ReminderConfigInput } from '../../../domain/items/valueObjects/ReminderConfig'
import { DateWindow, type DateWindowInput } from '../../../domain/items/valueObjects/DateWindow'
import { GoalConfig, type GoalConfigInput } from '../../../domain/items/valueObjects/GoalConfig'
import { AcademicConfig, type AcademicConfigInput } from '../../../domain/items/valueObjects/AcademicConfig'
import { TravelConfig, type TravelConfigInput } from '../../../domain/items/valueObjects/TravelConfig'
import { CalendarLink, type CalendarLinkInput } from '../../../domain/items/valueObjects/CalendarLink'

interface RawItemJson
  extends Omit<
    ItemProps,
    'repeatConfig' | 'reminderConfig' | 'dateWindow' | 'goalConfig' | 'academicConfig' | 'travelConfig' | 'calendarLink'
  > {
  repeatConfig?: RepeatConfigInput
  reminderConfig?: ReminderConfigInput[]
  dateWindow?: DateWindowInput
  goalConfig?: GoalConfigInput
  academicConfig?: AcademicConfigInput
  travelConfig?: TravelConfigInput
  calendarLink?: CalendarLinkInput
}

// Rebuilds real value-object instances from the plain JSON that JSON.parse produces — without
// this, item.repeatConfig etc. would just be plain objects that happen to look right, not real
// instances (no private brand, so they wouldn't even satisfy the Item type). Each field is
// rebuilt independently and tolerantly: a single malformed legacy config (from before this
// validation existed) drops just that field instead of failing the whole item.
export const hydrateItem = (raw: unknown): Item => {
  const source = raw as RawItemJson

  let repeatConfig: RepeatConfig | undefined
  if (source.repeatConfig) {
    try {
      repeatConfig = RepeatConfig.create(source.repeatConfig)
    } catch {
      repeatConfig = undefined
    }
  }

  let reminderConfig: ReminderConfig[] | undefined
  if (Array.isArray(source.reminderConfig)) {
    reminderConfig = source.reminderConfig
      .map((entry) => {
        try {
          return ReminderConfig.create(entry)
        } catch {
          return undefined
        }
      })
      .filter((entry): entry is ReminderConfig => entry !== undefined)
  }

  let dateWindow: DateWindow | undefined
  if (source.dateWindow) {
    try {
      dateWindow = DateWindow.create(source.dateWindow)
    } catch {
      dateWindow = undefined
    }
  }

  let goalConfig: GoalConfig | undefined
  if (source.goalConfig) {
    try {
      goalConfig = GoalConfig.create(source.goalConfig)
    } catch {
      goalConfig = undefined
    }
  }

  let academicConfig: AcademicConfig | undefined
  if (source.academicConfig) {
    try {
      academicConfig = AcademicConfig.create(source.academicConfig)
    } catch {
      academicConfig = undefined
    }
  }

  let travelConfig: TravelConfig | undefined
  if (source.travelConfig) {
    try {
      travelConfig = TravelConfig.create(source.travelConfig)
    } catch {
      travelConfig = undefined
    }
  }

  let calendarLink: CalendarLink | undefined
  if (source.calendarLink) {
    try {
      calendarLink = CalendarLink.create(source.calendarLink)
    } catch {
      calendarLink = undefined
    }
  }

  return Item.hydrate({
    ...source,
    repeatConfig,
    reminderConfig,
    dateWindow,
    goalConfig,
    academicConfig,
    travelConfig,
    calendarLink,
  })
}

export const ITEM_COLUMNS =
  'id, status, type, parentId, categoryId, startDate, deadline, completedAt, googleCalendarId, googleCalendarEventId, calendarSyncPending, createdAt, updatedAt, data'
export const ITEM_PLACEHOLDERS = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'

export const toItemRowParams = (item: Item): (string | number | null)[] => [
  item.id,
  item.status,
  item.type,
  item.parentId ?? null,
  item.categoryId ?? null,
  item.startDate ?? null,
  item.deadline ?? null,
  item.completedAt ?? null,
  item.calendarLink?.calendarId ?? null,
  item.calendarLink?.eventId ?? null,
  item.calendarSyncPending ? 1 : 0,
  item.createdAt,
  item.updatedAt,
  JSON.stringify(item),
]
