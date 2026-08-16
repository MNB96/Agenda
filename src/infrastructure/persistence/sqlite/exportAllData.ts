import { getDb } from './db'

// Raw table dump — every column as stored, not re-serialized through the domain layer, so this
// stays a faithful backup even if a row fails today's stricter hydration/validation rules.
export interface SqliteDataExport {
  exportedAt: string
  items: Record<string, unknown>[]
  habits: Record<string, unknown>[]
  habitCompletions: Record<string, unknown>[]
  habitOccurrences: Record<string, unknown>[]
  subjects: Record<string, unknown>[]
}

export const exportAllSqliteData = async (): Promise<SqliteDataExport> => {
  const db = await getDb()
  const [items, habits, habitCompletions, habitOccurrences, subjects] = await Promise.all([
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM items'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM habits'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM habit_completions'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM habit_occurrences'),
    db.getAllAsync<Record<string, unknown>>('SELECT * FROM subjects'),
  ])
  return {
    exportedAt: new Date().toISOString(),
    items,
    habits,
    habitCompletions,
    habitOccurrences,
    subjects,
  }
}
