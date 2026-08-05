import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Item } from '../../domain/items/types'
import { ITEM_COLUMNS, ITEM_PLACEHOLDERS, toItemRowParams } from './itemRow'

const OLD_ITEMS_KEY = '@agenda/items'
const MIGRATION_FLAG_KEY = 'agenda:sqlite-items-migration-v1'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

// One-time move from the old single-blob AsyncStorage key into SQLite. Runs as part of
// getDb()'s init chain (not via the SQLiteItemRepository, which would call getDb() again
// and deadlock on the same in-flight promise) so every repository call is guaranteed to
// see the migrated data, regardless of call order at startup.
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

export const getDb = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('agenda.db').then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;')
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
      `)
      await migrateFromAsyncStorage(db)
      return db
    })
  }
  return dbPromise
}
