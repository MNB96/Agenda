import { differenceInCalendarDays } from 'date-fns'
import type { Item } from '../../domain/items/types'

const ARCHIVE_AFTER_DAYS = 60

/**
 * A completed item is safe to delete from local storage once it's old enough AND it's
 * synced to Google Calendar — the calendar event is the backup, so nothing is lost.
 * Completed items with no Google link are never auto-archived, since deleting them would
 * be the only copy of that data gone for good.
 */
export const isEligibleForAutoArchive = (item: Item, now: Date = new Date()): boolean => {
  if (item.status !== 'completed') return false
  if (!item.completedAt) return false
  if (!item.googleCalendarLink) return false
  return differenceInCalendarDays(now, new Date(item.completedAt)) >= ARCHIVE_AFTER_DAYS
}
