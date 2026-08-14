import { describe, expect, it } from 'vitest'
import { Habit } from './Habit'
import { getCompletionCountForDate, nextDailyCompletionCount } from './services/completionCounts'
import { isCompletionCountMet } from './services/streaks'

describe('Habit', () => {
  it('persists the times-per-day value on creation', () => {
    const habit = Habit.create({
      title: 'Ejercicio',
      regularity: 'daily',
      timesPerDay: 3,
    })

    expect(habit.timesPerDay).toBe(3)
  })

  it('rejects invalid times per day values', () => {
    expect(() =>
      Habit.create({
        title: 'Ejercicio',
        regularity: 'daily',
        timesPerDay: 0,
      }),
    ).toThrow('La cantidad de veces por día debe ser mayor a 0.')
  })

  it('counts multiple completions for the same day without resetting to zero', () => {
    const completions = [
      { date: '2026-08-14', count: 1 },
      { date: '2026-08-14', count: 1 },
      { date: '2026-08-15', count: 1 },
    ]

    expect(getCompletionCountForDate(completions, '2026-08-14')).toBe(2)
    expect(nextDailyCompletionCount(2, 3)).toBe(3)
    expect(nextDailyCompletionCount(3, 3)).toBe(3)
  })

  it('treats a daily count as complete when it reaches or exceeds the target', () => {
    expect(isCompletionCountMet(7, 8)).toBe(false)
    expect(isCompletionCountMet(8, 8)).toBe(true)
    expect(isCompletionCountMet(9, 8)).toBe(true)
  })
})
