import { getDb } from './db'
import { Habit, type HabitCompletion, type HabitReminderConfig, type HabitRepository } from '../../../domain/habits'

interface HabitRow {
  id: string
  title: string
  categoryId: string | null
  regularity: string
  reminder: string | null
  notificationIds: string | null
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

const hydrateRow = (row: HabitRow): Habit | undefined => {
  const result = Habit.hydrate({
    id: row.id,
    title: row.title,
    categoryId: row.categoryId ?? undefined,
    regularity: row.regularity as Habit['regularity'],
    reminder: parseJsonSafe<HabitReminderConfig>(row.reminder),
    notificationIds: parseJsonSafe<string[]>(row.notificationIds),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
      'INSERT OR REPLACE INTO habits (id, title, categoryId, regularity, reminder, notificationIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        habit.id,
        habit.title,
        habit.categoryId ?? null,
        habit.regularity,
        habit.reminder ? JSON.stringify(habit.reminder) : null,
        habit.notificationIds ? JSON.stringify(habit.notificationIds) : null,
        habit.createdAt,
        habit.updatedAt,
      ],
    )
    return habit
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM habits WHERE id = ?', [id])
      await db.runAsync('DELETE FROM habit_completions WHERE habitId = ?', [id])
    })
  }

  async listCompletions(): Promise<HabitCompletion[]> {
    const db = await getDb()
    return db.getAllAsync<HabitCompletion>('SELECT habitId, date FROM habit_completions')
  }

  async addCompletion(habitId: string, date: string): Promise<void> {
    const db = await getDb()
    await db.runAsync('INSERT OR IGNORE INTO habit_completions (habitId, date) VALUES (?, ?)', [habitId, date])
  }

  async removeCompletion(habitId: string, date: string): Promise<void> {
    const db = await getDb()
    await db.runAsync('DELETE FROM habit_completions WHERE habitId = ? AND date = ?', [habitId, date])
  }
}
