import type { Item, ItemType, NewItemInput } from '../types'
import { createId } from '../../../utils/id'

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
    repeatConfig: input.repeatConfig,
    parentId: input.parentId,
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
    syncToCalendar: input.syncToCalendar ?? true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export const updateItem = (current: Item, patch: Partial<Item>): Item => ({
  ...current,
  ...patch,
  updatedAt: new Date().toISOString(),
})
