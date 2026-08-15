import type { Habit } from './Habit'
import type { HabitOccurrence } from './HabitOccurrence'

export interface HabitCompletion {
  habitId: string
  /** Calendar day (yyyy-MM-dd) the habit was marked done — the period it belongs to is derived from the habit's regularity. */
  date: string
  /** Daily count for that specific date. */
  count: number
}

export interface HabitRepository {
  list(): Promise<Habit[]>
  getById(id: string): Promise<Habit | undefined>
  save(habit: Habit): Promise<Habit>
  remove(id: string): Promise<void>
  listCompletions(): Promise<HabitCompletion[]>
  addCompletion(habitId: string, date: string): Promise<void>
  removeCompletion(habitId: string, date: string): Promise<void>
  setCompletionCount(habitId: string, date: string, count: number): Promise<void>
  listOccurrencesBetween(startIso: string, endIso: string): Promise<HabitOccurrence[]>
  addOccurrence(habitId: string, occurredAt: string, source: HabitOccurrence['source']): Promise<HabitOccurrence>
  removeOccurrence(id: string): Promise<void>
}
