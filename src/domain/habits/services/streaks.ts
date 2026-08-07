import { differenceInCalendarDays, differenceInCalendarWeeks, format, parseISO } from 'date-fns'
import { assertNever } from '../../../utils/assertNever'
import type { HabitRegularity } from '../Habit'

const EPOCH = new Date(2000, 0, 1)

// Ordinal lets streaks compare across periods regardless of unit; takes Date objects (never
// ISO-string round-trips) so local-time day boundaries stay correct.
const periodOrdinal = (date: Date, regularity: HabitRegularity): number => {
  switch (regularity) {
    case 'daily':
      return differenceInCalendarDays(date, EPOCH)
    case 'weekly':
      return differenceInCalendarWeeks(date, EPOCH, { weekStartsOn: 1 })
    case 'monthly':
      return date.getFullYear() * 12 + date.getMonth()
    case 'yearly':
      return date.getFullYear()
    default:
      return assertNever(regularity)
  }
}

export interface StreakResult {
  current: number
  best: number
}

export const computeStreaks = (
  completionDates: readonly string[],
  regularity: HabitRegularity,
  now: Date = new Date(),
): StreakResult => {
  const ordinals = [...new Set(completionDates.map((date) => periodOrdinal(parseISO(date), regularity)))].sort((a, b) => a - b)
  if (ordinals.length === 0) return { current: 0, best: 0 }

  let best = 1
  let run = 1
  for (let i = 1; i < ordinals.length; i++) {
    run = ordinals[i] === ordinals[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  }

  const nowOrdinal = periodOrdinal(now, regularity)
  const last = ordinals[ordinals.length - 1]
  // Not done for the current period yet doesn't break the streak — only skipping a whole one does.
  if (last !== nowOrdinal && last !== nowOrdinal - 1) return { current: 0, best }

  let current = 1
  let idx = ordinals.length - 1
  while (idx > 0 && ordinals[idx] - ordinals[idx - 1] === 1) {
    current++
    idx--
  }
  return { current, best }
}

export const isCompletedForCurrentPeriod = (
  completionDates: readonly string[],
  regularity: HabitRegularity,
  now: Date = new Date(),
): boolean => {
  const nowOrdinal = periodOrdinal(now, regularity)
  return completionDates.some((date) => periodOrdinal(parseISO(date), regularity) === nowOrdinal)
}

export interface WeekDayStatus {
  date: string
  done: boolean
}

// Monday-to-Sunday completion status for a daily habit's current week — paired with each day's
// date so callers can toggle a specific day, not just read it.
export const weekCompletionStatus = (completionDates: readonly string[], now: Date = new Date()): WeekDayStatus[] => {
  const completedDays = new Set(completionDates.map((date) => date.slice(0, 10)))
  const monday = new Date(now)
  const offsetFromMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - offsetFromMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const date = format(day, 'yyyy-MM-dd')
    return { date, done: completedDays.has(date) }
  })
}
