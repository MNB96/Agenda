import type { Habit } from './Habit'

export interface HabitCompletion {
  habitId: string
  /** Calendar day (yyyy-MM-dd) the habit was marked done — the period it belongs to is derived from the habit's regularity. */
  date: string
}

export interface HabitRepository {
  list(): Promise<Habit[]>
  getById(id: string): Promise<Habit | undefined>
  save(habit: Habit): Promise<Habit>
  remove(id: string): Promise<void>
  listCompletions(): Promise<HabitCompletion[]>
  addCompletion(habitId: string, date: string): Promise<void>
  removeCompletion(habitId: string, date: string): Promise<void>
}
