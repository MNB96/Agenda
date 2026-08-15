import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Item } from '../../../domain/items'
import { ITEM_COLUMNS, ITEM_PLACEHOLDERS, toItemRowParams } from './itemRow'

const OLD_ITEMS_KEY = '@agenda/items'
const LEGACY_CACHE_CLEANUP_FLAG_KEY = 'agenda:legacy-cache-cleanup-v1'
const MIGRATION_FLAG_KEY = 'agenda:sqlite-items-migration-v1'
const FIELD_RENAME_MIGRATION_FLAG_KEY = 'agenda:calendar-link-field-rename-v1'
const TYPE_UNIFICATION_MIGRATION_FLAG_KEY = 'agenda:item-type-unification-v1'
const HABIT_TIMES_PER_DAY_MIGRATION_FLAG_KEY = 'agenda:habit-times-per-day-v1'
const HABIT_COMPLETION_COUNTS_MIGRATION_FLAG_KEY = 'agenda:habit-completion-counts-v1'
const HABIT_OCCURRENCES_MIGRATION_FLAG_KEY = 'agenda:habit-occurrences-v1'
const HABIT_REGULARITY_CHANGED_AT_MIGRATION_FLAG_KEY = 'agenda:habit-regularity-changed-at-v1'

const LEGACY_CACHE_KEYS = [
  OLD_ITEMS_KEY,
  '@agenda/calendar_delete_queue',
  MIGRATION_FLAG_KEY,
  FIELD_RENAME_MIGRATION_FLAG_KEY,
  TYPE_UNIFICATION_MIGRATION_FLAG_KEY,
  HABIT_TIMES_PER_DAY_MIGRATION_FLAG_KEY,
  HABIT_COMPLETION_COUNTS_MIGRATION_FLAG_KEY,
  HABIT_OCCURRENCES_MIGRATION_FLAG_KEY,
  'agenda:notification-channels-v3-alarm-stream',
] as const

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

const clearLegacyInstallCaches = async (): Promise<void> => {
  const alreadyCleaned = await AsyncStorage.getItem(LEGACY_CACHE_CLEANUP_FLAG_KEY)
  if (alreadyCleaned) return

  const keys = await AsyncStorage.getAllKeys()
  const staleKeys = keys.filter((key) => {
    if (LEGACY_CACHE_KEYS.includes(key as (typeof LEGACY_CACHE_KEYS)[number])) return true
    if (key.startsWith('agenda:holidays-v2-')) return true
    if (key.startsWith('agenda:notification-channels-')) return true
    return false
  })

  if (staleKeys.length > 0) {
    await AsyncStorage.multiRemove(staleKeys)
  }

  await AsyncStorage.setItem(LEGACY_CACHE_CLEANUP_FLAG_KEY, '1')
}

// One-time move from the old single-blob AsyncStorage key into SQLite. Runs inside getDb()'s
// init chain, not via SQLiteItemRepository, to avoid deadlocking on the same in-flight promise.
const migrateFromAsyncStorage = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const raw = await AsyncStorage.getItem(OLD_ITEMS_KEY)
  if (raw) {
    try {
      const items = JSON.parse(raw) as Item[]
      await db.withTransactionAsync(async () => {
        for (const item of items) {
          await db.runAsync(
            `INSERT OR REPLACE INTO items (${ITEM_COLUMNS}) VALUES (${ITEM_PLACEHOLDERS})`,
            toItemRowParams(item),
          )
        }
      })
      await AsyncStorage.removeItem(OLD_ITEMS_KEY)
    } catch {
      // Blob corrupto o ilegible — no hay nada recuperable, seguimos con SQLite vacío.
    }
  }

  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, '1')
}

// One-time field rename inside the stored JSON blob (googleCalendarLink -> calendarLink,
// syncToGoogleCalendar -> syncToCalendar). Without it, old rows read as unlinked and
// useCalendarSyncRecovery would create a duplicate Calendar event.
const migrateCalendarLinkFieldNames = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(FIELD_RENAME_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const rows = await db.getAllAsync<{ id: string; data: string }>('SELECT id, data FROM items')
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data) as Record<string, unknown>
        let changed = false

        if ('googleCalendarLink' in parsed) {
          const link = parsed.googleCalendarLink as Record<string, unknown> | null | undefined
          if (link && typeof link === 'object') {
            if ('source' in link) {
              link.origin = link.source === 'app' ? 'app' : 'external'
              delete link.source
            }
            parsed.calendarLink = link
          }
          delete parsed.googleCalendarLink
          changed = true
        }

        if ('syncToGoogleCalendar' in parsed) {
          parsed.syncToCalendar = parsed.syncToGoogleCalendar
          delete parsed.syncToGoogleCalendar
          changed = true
        }

        if (changed) {
          await db.runAsync('UPDATE items SET data = ? WHERE id = ?', [JSON.stringify(parsed), row.id])
        }
      } catch {
        // Fila con JSON corrupto: no hay nada seguro que migrar, se deja como está.
      }
    }
  })

  await AsyncStorage.setItem(FIELD_RENAME_MIGRATION_FLAG_KEY, '1')
}

// One-time collapse of the retired 'event'/'deadline' types into 'task' — otherwise old rows fail buildItem's unknown-type check and vanish.
const migrateLegacyItemTypes = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(TYPE_UNIFICATION_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const rows = await db.getAllAsync<{ id: string; data: string }>(
    "SELECT id, data FROM items WHERE type IN ('event', 'deadline')",
  )
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data) as Record<string, unknown>
        parsed.type = 'task'
        await db.runAsync('UPDATE items SET type = ?, data = ? WHERE id = ?', ['task', JSON.stringify(parsed), row.id])
      } catch {
        // Fila con JSON corrupto: no hay nada seguro que migrar, se deja como está.
      }
    }
  })

  await AsyncStorage.setItem(TYPE_UNIFICATION_MIGRATION_FLAG_KEY, '1')
}

const migrateHabitTimesPerDay = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(HABIT_TIMES_PER_DAY_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habits)')
  const hasTimesPerDayColumn = columns.some((column) => column.name === 'timesPerDay')
  if (!hasTimesPerDayColumn) {
    await db.runAsync('ALTER TABLE habits ADD COLUMN timesPerDay INTEGER NOT NULL DEFAULT 1')
  }

  await db.runAsync('UPDATE habits SET timesPerDay = 1 WHERE timesPerDay IS NULL')
  await AsyncStorage.setItem(HABIT_TIMES_PER_DAY_MIGRATION_FLAG_KEY, '1')
}

const migrateHabitCompletionCounts = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(HABIT_COMPLETION_COUNTS_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habit_completions)')
  const hasCountColumn = columns.some((column) => column.name === 'count')
  if (!hasCountColumn) {
    await db.runAsync('ALTER TABLE habit_completions ADD COLUMN count INTEGER NOT NULL DEFAULT 1')
  }

  await db.runAsync('UPDATE habit_completions SET count = 1 WHERE count IS NULL OR count <= 0')
  await AsyncStorage.setItem(HABIT_COMPLETION_COUNTS_MIGRATION_FLAG_KEY, '1')
}

const migrateHabitRegularityChangedAt = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(HABIT_REGULARITY_CHANGED_AT_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habits)')
  const hasColumn = columns.some((column) => column.name === 'regularityChangedAt')
  if (!hasColumn) {
    await db.runAsync('ALTER TABLE habits ADD COLUMN regularityChangedAt TEXT')
  }

  await AsyncStorage.setItem(HABIT_REGULARITY_CHANGED_AT_MIGRATION_FLAG_KEY, '1')
}

const migrateHabitOccurrences = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  const alreadyMigrated = await AsyncStorage.getItem(HABIT_OCCURRENCES_MIGRATION_FLAG_KEY)
  if (alreadyMigrated) return

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS habit_occurrences (
      id TEXT PRIMARY KEY NOT NULL,
      habitId TEXT NOT NULL,
      occurredAt TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId ON habit_occurrences(habitId);
    CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId_occurredAt ON habit_occurrences(habitId, occurredAt);
  `)

  await AsyncStorage.setItem(HABIT_OCCURRENCES_MIGRATION_FLAG_KEY, '1')
}

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('agenda.db').then(async (db) => {
      await clearLegacyInstallCaches()
      await db.execAsync('PRAGMA journal_mode = WAL;')
      // NORMAL + WAL: mucho menos fsync que FULL, riesgo aceptable de perder solo el último commit.
      await db.execAsync('PRAGMA synchronous = NORMAL;')
      await db.execAsync('PRAGMA foreign_keys = ON;')
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY NOT NULL,
          status TEXT NOT NULL,
          type TEXT NOT NULL,
          parentId TEXT,
          categoryId TEXT,
          startDate TEXT,
          deadline TEXT,
          completedAt TEXT,
          googleCalendarId TEXT,
          googleCalendarEventId TEXT,
          calendarSyncPending INTEGER,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
        CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);

        CREATE TABLE IF NOT EXISTS habits (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          categoryId TEXT,
          regularity TEXT NOT NULL,
          timesPerDay INTEGER NOT NULL DEFAULT 1,
          reminder TEXT,
          notificationIds TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS habit_completions (
          habitId TEXT NOT NULL,
          date TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (habitId, date)
        );
        CREATE INDEX IF NOT EXISTS idx_habit_completions_habitId ON habit_completions(habitId);
        CREATE TABLE IF NOT EXISTS habit_occurrences (
          id TEXT PRIMARY KEY NOT NULL,
          habitId TEXT NOT NULL,
          occurredAt TEXT NOT NULL,
          source TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId ON habit_occurrences(habitId);
        CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId_occurredAt ON habit_occurrences(habitId, occurredAt);
      `)
      await migrateFromAsyncStorage(db)
      await migrateCalendarLinkFieldNames(db)
      await migrateLegacyItemTypes(db)
      await migrateHabitTimesPerDay(db)
      await migrateHabitCompletionCounts(db)
      await migrateHabitOccurrences(db)
      await migrateHabitRegularityChangedAt(db)
      return db
    })
  }
  return dbPromise
}
