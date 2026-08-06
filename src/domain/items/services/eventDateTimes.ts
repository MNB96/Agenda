import { addHours, parseISO } from 'date-fns'
import type { Item } from '../types'

export const resolveEventDateTimes = (item: Item): { start: string; end: string; allDay: boolean } | undefined => {
  if (!item.startDate) {
    return undefined
  }

  if (!item.startTime) {
    const start = `${item.startDate}T00:00:00.000Z`
    const end = `${item.endDate ?? item.startDate}T00:00:00.000Z`
    return { start, end, allDay: true }
  }

  const start = parseISO(`${item.startDate}T${item.startTime}:00`).toISOString()
  const end = item.endDate && item.endTime
    ? parseISO(`${item.endDate}T${item.endTime}:00`).toISOString()
    : addHours(parseISO(`${item.startDate}T${item.startTime}:00`), 1).toISOString()

  return { start, end, allDay: false }
}
