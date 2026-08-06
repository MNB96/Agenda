import type { ItemRepository } from '../../../domain/items/repositories'
import type { Item } from '../../../domain/items/types'
import { getDb } from './db'
import { ITEM_COLUMNS, ITEM_PLACEHOLDERS, toItemRowParams } from './itemRow'

interface ItemRow {
  data: string
}

export class SQLiteItemRepository implements ItemRepository {
  async list(): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>('SELECT data FROM items')
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async listActive(): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>("SELECT data FROM items WHERE status != 'completed'")
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async listCompleted(limit: number, offset: number): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      "SELECT data FROM items WHERE status = 'completed' ORDER BY completedAt DESC LIMIT ? OFFSET ?",
      [limit, offset],
    )
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async listCompletedByCategory(categoryId: string, limit: number): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      "SELECT data FROM items WHERE status = 'completed' AND categoryId = ? ORDER BY completedAt DESC LIMIT ?",
      [categoryId, limit],
    )
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async listArchiveEligible(completedBefore: string): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      `SELECT data FROM items
       WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt <= ?
         AND googleCalendarEventId IS NOT NULL`,
      [completedBefore],
    )
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async getById(id: string): Promise<Item | undefined> {
    const db = await getDb()
    const row = await db.getFirstAsync<ItemRow>('SELECT data FROM items WHERE id = ?', [id])
    return row ? (JSON.parse(row.data) as Item) : undefined
  }

  async getByParentIds(parentIds: string[]): Promise<Item[]> {
    if (parentIds.length === 0) return []
    const db = await getDb()
    const placeholders = parentIds.map(() => '?').join(', ')
    const rows = await db.getAllAsync<ItemRow>(
      `SELECT data FROM items WHERE parentId IN (${placeholders})`,
      parentIds,
    )
    return rows.map((row) => JSON.parse(row.data) as Item)
  }

  async save(item: Item): Promise<Item> {
    const db = await getDb()
    await db.runAsync(
      `INSERT OR REPLACE INTO items (${ITEM_COLUMNS}) VALUES (${ITEM_PLACEHOLDERS})`,
      toItemRowParams(item),
    )
    return item
  }

  async saveMany(items: Item[]): Promise<Item[]> {
    if (items.length === 0) return items
    const db = await getDb()
    // Una sola transacción para todo el lote en vez de N commits separados (uno por save()) —
    // se nota en useCalendarSyncRecovery cuando sincroniza varios items de golpe con Calendar.
    await db.withTransactionAsync(async () => {
      for (const item of items) {
        await db.runAsync(
          `INSERT OR REPLACE INTO items (${ITEM_COLUMNS}) VALUES (${ITEM_PLACEHOLDERS})`,
          toItemRowParams(item),
        )
      }
    })
    return items
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.runAsync('DELETE FROM items WHERE id = ?', [id])
  }

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const db = await getDb()
    const placeholders = ids.map(() => '?').join(', ')
    await db.runAsync(`DELETE FROM items WHERE id IN (${placeholders})`, ids)
  }
}
