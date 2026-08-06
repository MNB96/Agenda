import { Item, type ItemProps } from '../../../domain/items'
import { RepeatConfig, type RepeatConfigInput } from '../../../domain/items/valueObjects/RepeatConfig'
import { ReminderConfig, type ReminderConfigInput } from '../../../domain/items/valueObjects/ReminderConfig'
import { AcademicConfig, type AcademicConfigInput } from '../../../domain/items/valueObjects/AcademicConfig'
import { TravelConfig, type TravelConfigInput } from '../../../domain/items/valueObjects/TravelConfig'
import { CalendarLink, type CalendarLinkInput } from '../../../domain/items/valueObjects/CalendarLink'

interface RawItemJson
  extends Omit<ItemProps, 'repeatConfig' | 'reminderConfig' | 'academicConfig' | 'travelConfig' | 'calendarLink'> {
  repeatConfig?: RepeatConfigInput
  reminderConfig?: ReminderConfigInput[]
  academicConfig?: AcademicConfigInput
  travelConfig?: TravelConfigInput
  calendarLink?: CalendarLinkInput
}

// Rebuilds real value-object instances from plain JSON; each field is rebuilt independently and tolerantly (a malformed legacy config just drops that field).
export const hydrateItem = (raw: unknown): Item | undefined => {
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

  const result = Item.hydrate({
    ...source,
    repeatConfig,
    reminderConfig,
    academicConfig,
    travelConfig,
    calendarLink,
  })

  if (!result.success) {
    console.warn(`No se pudo hidratar el item ${String(source.id)}: ${result.error.message}`)
    return undefined
  }
  return result.item
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
