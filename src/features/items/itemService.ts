import { addHours, parseISO } from 'date-fns'
import type { Item, ItemType, NewItemInput } from '../../domain/items/types'
import { createId } from '../../utils/id'

const inferType = (input: NewItemInput): ItemType => {
  if (input.type) {
    return input.type
  }
  if (input.goalConfig) {
    return 'goal'
  }
  if (input.dateWindow?.startDate || input.dateWindow?.endDate) {
    return 'date_window'
  }
  if (input.startDate && input.startTime) {
    return 'event'
  }
  if (input.deadline) {
    return 'deadline'
  }
  return 'task'
}

export const createItem = (input: NewItemInput): Item => {
  const nowIso = new Date().toISOString()
  return {
    id: createId(),
    title: input.title.trim(),
    description: input.description?.trim(),
    type: inferType(input),
    status: 'active',
    important: input.important,
    repeatRule: input.repeatRule,
    categoryId: input.categoryId,
    location: input.location,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
    endTime: input.endTime,
    deadline: input.deadline,
    dateWindow: input.dateWindow,
    reminderConfig: input.reminderConfig,
    travelConfig: input.travelConfig,
    goalConfig: input.goalConfig,
    academicConfig: input.academicConfig,
    syncToGoogleCalendar: input.syncToGoogleCalendar ?? false,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export const updateItem = (current: Item, patch: Partial<Item>): Item => ({
  ...current,
  ...patch,
  updatedAt: new Date().toISOString(),
})

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