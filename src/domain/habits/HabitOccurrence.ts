import { createId } from '../../utils/id'

export const HABIT_OCCURRENCE_SOURCE = {
  MANUAL: 'manual',
  NOTIFICATION: 'notification',
} as const

export type HabitOccurrenceSource = (typeof HABIT_OCCURRENCE_SOURCE)[keyof typeof HABIT_OCCURRENCE_SOURCE]

export interface HabitOccurrence {
  id: string
  habitId: string
  occurredAt: string
  source: HabitOccurrenceSource
  createdAt: string
  updatedAt: string
}

export const createHabitOccurrence = (
  habitId: string,
  occurredAt: string,
  source: HabitOccurrenceSource,
  now: Date = new Date(),
): HabitOccurrence => ({
  id: createId(),
  habitId,
  occurredAt,
  source,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
})
