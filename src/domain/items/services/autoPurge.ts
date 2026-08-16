import { differenceInCalendarDays } from 'date-fns'
import type { Item } from '../Item'

export const AUTO_PURGE_AFTER_DAYS = 60

// Safe to purge once old enough and no sync pending — calendarLink is not required.
export const isEligibleForAutoPurge = (item: Item, now: Date = new Date()): boolean => {
  if (item.status !== 'completed') return false
  if (!item.completedAt) return false
  if (item.calendarSyncPending) return false
  return differenceInCalendarDays(now, new Date(item.completedAt)) >= AUTO_PURGE_AFTER_DAYS
}
