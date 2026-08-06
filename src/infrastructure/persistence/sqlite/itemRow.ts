import type { Item } from '../../../domain/items/types'

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
