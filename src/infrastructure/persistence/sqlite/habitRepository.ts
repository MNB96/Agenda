import * as SQLite from 'expo-sqlite'
import { getDb } from './db'
import {
  Habit,
  createHabitOccurrence,
  type HabitCompletion,
  type HabitOccurrence,
  type HabitReminderConfig,
  type HabitRepository,
} from '../../../domain/habits'

interface HabitRow {
  id: string
  title: string
  categoryId: string | null
  regularity: string
  timesPerDay: number | null
  reminder: string | null
  notificationIds: string | null
  createdAt: string
  updatedAt: string
  regularityChangedAt: string | null
}

interface HabitOccurrenceRow {
  id: string
  habitId: string
  occurredAt: string
  source: HabitOccurrence['source']
  createdAt: string
  updatedAt: string
}

const parseJsonSafe = <T,>(raw: string | null): T | undefined => {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

const toCalendarDate = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida para ocurrencia: ${isoDate}`)
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const reconcileSummaryCount = async (db: SQLite.SQLiteDatabase, habitId: string, date: string, delta: number): Promise<void> => {
  const current = await db.getFirstAsync<{ count: number }>('SELECT count FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
  const nextCount = Math.max(0, Math.trunc(Number(current?.count ?? 0)) + delta)

  if (nextCount <= 0) {
    await db.runAsync('DELETE FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
    return
  }

  await db.runAsync(
    'INSERT INTO habit_completions (habitId, date, count) VALUES (?, ?, ?) ON CONFLICT(habitId, date) DO UPDATE SET count = excluded.count',
    [habitId, date, nextCount],
  )
}

const hydrateRow = (row: HabitRow): Habit | undefined => {
  const result = Habit.hydrate({
    id: row.id,
    title: row.title,
    categoryId: row.categoryId ?? undefined,
    regularity: row.regularity as Habit['regularity'],
    timesPerDay: row.timesPerDay ?? 1,
    reminder: parseJsonSafe<HabitReminderConfig>(row.reminder),
    notificationIds: parseJsonSafe<string[]>(row.notificationIds),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    regularityChangedAt: row.regularityChangedAt ?? undefined,
  })
  if (!result.success) {
    console.warn(`No se pudo hidratar el hábito ${row.id}: ${result.error.message}`)
    return undefined
  }
  return result.habit
}

export class SQLiteHabitRepository implements HabitRepository {
  async list(): Promise<Habit[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<HabitRow>('SELECT * FROM habits ORDER BY createdAt ASC')
    return rows.map(hydrateRow).filter((habit): habit is Habit => habit !== undefined)
  }

  async getById(id: string): Promise<Habit | undefined> {
    const db = await getDb()
    const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [id])
    return row ? hydrateRow(row) : undefined
  }

  async save(habit: Habit): Promise<Habit> {
    const db = await getDb()
    await db.runAsync(
      'INSERT OR REPLACE INTO habits (id, title, categoryId, regularity, timesPerDay, reminder, notificationIds, createdAt, updatedAt, regularityChangedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        habit.id,
        habit.title,
        habit.categoryId ?? null,
        habit.regularity,
        habit.timesPerDay,
        habit.reminder ? JSON.stringify(habit.reminder) : null,
        habit.notificationIds ? JSON.stringify(habit.notificationIds) : null,
        habit.createdAt,
        habit.updatedAt,
        habit.regularityChangedAt ?? null,
      ],
    )
    return habit
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM habits WHERE id = ?', [id])
      await db.runAsync('DELETE FROM habit_occurrences WHERE habitId = ?', [id])
      await db.runAsync('DELETE FROM habit_completions WHERE habitId = ?', [id])
    })
  }

  async listCompletions(): Promise<HabitCompletion[]> {
    const db = await getDb()
    return db.getAllAsync<HabitCompletion>('SELECT habitId, date, count FROM habit_completions')
  }

  async listOccurrencesBetween(startIso: string, endIso: string): Promise<HabitOccurrence[]> {
    const db = await getDb()
    return db.getAllAsync<HabitOccurrenceRow>(
      'SELECT id, habitId, occurredAt, source, createdAt, updatedAt FROM habit_occurrences WHERE occurredAt >= ? AND occurredAt < ? ORDER BY occurredAt ASC, createdAt ASC',
      [startIso, endIso],
    )
  }

  async addOccurrence(habitId: string, occurredAt: string, source: HabitOccurrence['source']): Promise<HabitOccurrence> {
    const db = await getDb()
    const occurrence = createHabitOccurrence(habitId, occurredAt, source)

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO habit_occurrences (id, habitId, occurredAt, source, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [occurrence.id, occurrence.habitId, occurrence.occurredAt, occurrence.source, occurrence.createdAt, occurrence.updatedAt],
      )
      const date = toCalendarDate(occurrence.occurredAt)
      await reconcileSummaryCount(db, habitId, date, 1)
    })

    return occurrence
  }

  async removeOccurrence(id: string): Promise<void> {
    const db = await getDb()

    await db.withTransactionAsync(async () => {
      const row = await db.getFirstAsync<HabitOccurrenceRow>('SELECT id, habitId, occurredAt, source, createdAt, updatedAt FROM habit_occurrences WHERE id = ?', [id])
      if (!row) return

      await db.runAsync('DELETE FROM habit_occurrences WHERE id = ?', [id])
      const date = toCalendarDate(row.occurredAt)
      await reconcileSummaryCount(db, row.habitId, date, -1)
    })
  }

  async addCompletion(habitId: string, date: string): Promise<void> {
    const db = await getDb()
    const current = await db.getFirstAsync<{ count: number }>('SELECT count FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
    const nextCount = Math.max(1, Math.trunc(Number(current?.count ?? 0)) + 1)
    await db.runAsync(
      'INSERT INTO habit_completions (habitId, date, count) VALUES (?, ?, ?) ON CONFLICT(habitId, date) DO UPDATE SET count = excluded.count',
      [habitId, date, nextCount],
    )
  }

  async removeCompletion(habitId: string, date: string): Promise<void> {
    const db = await getDb()
    await db.runAsync('DELETE FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
  }

  async setCompletionCount(habitId: string, date: string, count: number): Promise<void> {
    const db = await getDb()
    const nextCount = Math.max(0, Math.min(999, Math.trunc(Number(count) || 0)))
    if (nextCount <= 0) {
      await db.runAsync('DELETE FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
      return
    }

    await db.runAsync(
      'INSERT INTO habit_completions (habitId, date, count) VALUES (?, ?, ?) ON CONFLICT(habitId, date) DO UPDATE SET count = excluded.count',
      [habitId, date, nextCount],
    )
  }
}
