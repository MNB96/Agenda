import { getDb } from './db'
import type { SqliteDataExport } from './exportAllData'

export const isValidExport = (obj: unknown): obj is SqliteDataExport => {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return (
    typeof o.exportedAt === 'string' &&
    Array.isArray(o.items) &&
    Array.isArray(o.habits) &&
    Array.isArray(o.habitCompletions) &&
    Array.isArray(o.habitOccurrences) &&
    Array.isArray(o.subjects)
  )
}

const insertRows = async (
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> => {
  for (const row of rows) {
    const keys = Object.keys(row)
    if (keys.length === 0) continue
    const cols = keys.join(', ')
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map((k) => row[k])
    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`,
      values as (string | number | null)[],
    )
  }
}

export const importAllSqliteData = async (data: SqliteDataExport): Promise<void> => {
  const db = await getDb()
  await db.withTransactionAsync(async () => {
    // Borrar todo antes de restaurar
    await db.execAsync('DELETE FROM habit_occurrences')
    await db.execAsync('DELETE FROM habit_completions')
    await db.execAsync('DELETE FROM habits')
    await db.execAsync('DELETE FROM items')
    await db.execAsync('DELETE FROM subjects')

    await insertRows(db, 'items', data.items)
    await insertRows(db, 'habits', data.habits)
    await insertRows(db, 'habit_completions', data.habitCompletions)
    await insertRows(db, 'habit_occurrences', data.habitOccurrences)
    await insertRows(db, 'subjects', data.subjects)
  })
}
