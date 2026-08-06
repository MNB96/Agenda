import { addDays, addHours, format, parseISO } from 'date-fns'
import type { Item } from '../Item'

export const resolveEventDateTimes = (item: Item): { start: string; end: string; allDay: boolean } | undefined => {
  if (!item.startDate) {
    return undefined
  }

  if (!item.startTime) {
    // Google Calendar's all-day events use an exclusive end date — a one-day event needs
    // end = start + 1 day, not end === start, or it reads as zero-length. item.endDate is
    // stored inclusive, so it's always shifted forward by one before going out.
    const inclusiveEndDate = item.endDate ?? item.startDate
    const exclusiveEndDate = format(addDays(parseISO(inclusiveEndDate), 1), 'yyyy-MM-dd')
    const start = `${item.startDate}T00:00:00.000Z`
    const end = `${exclusiveEndDate}T00:00:00.000Z`
    return { start, end, allDay: true }
  }

  const startDateTime = parseISO(`${item.startDate}T${item.startTime}:00`)
  const start = startDateTime.toISOString()
  // endTime without endDate means "same day" — only fall back to +1h when there's no endTime at all.
  const end = item.endTime
    ? parseISO(`${item.endDate ?? item.startDate}T${item.endTime}:00`).toISOString()
    : addHours(startDateTime, 1).toISOString()

  return { start, end, allDay: false }
}
