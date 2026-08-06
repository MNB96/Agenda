import type { Item, ItemRepository } from '../../../domain/items'
import { getDb } from './db'
import { hydrateItem, ITEM_COLUMNS, ITEM_PLACEHOLDERS, toItemRowParams } from './itemRow'

interface ItemRow {
  data: string
}

// Drops rows hydrateItem can't reconstruct (corrupted/contradictory JSON) instead of propagating undefined.
const hydrateRows = (rows: ItemRow[]): Item[] =>
  rows.map((row) => hydrateItem(JSON.parse(row.data))).filter((item): item is Item => item !== undefined)

export class SQLiteItemRepository implements ItemRepository {
  async list(): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>('SELECT data FROM items')
    return hydrateRows(rows)
  }

  async listActive(): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>("SELECT data FROM items WHERE status != 'completed'")
    return hydrateRows(rows)
  }

  async listCompleted(limit: number, offset: number): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      "SELECT data FROM items WHERE status = 'completed' ORDER BY completedAt DESC LIMIT ? OFFSET ?",
      [limit, offset],
    )
    return hydrateRows(rows)
  }

  async listCompletedByCategory(categoryId: string, limit: number): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      "SELECT data FROM items WHERE status = 'completed' AND categoryId = ? ORDER BY completedAt DESC LIMIT ?",
      [categoryId, limit],
    )
    return hydrateRows(rows)
  }

  async listPurgeEligible(completedBefore: string): Promise<Item[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<ItemRow>(
      `SELECT data FROM items
       WHERE status = 'completed' AND completedAt IS NOT NULL AND completedAt <= ?
         AND googleCalendarEventId IS NOT NULL`,
      [completedBefore],
    )
    return hydrateRows(rows)
  }

  async getById(id: string): Promise<Item | undefined> {
    const db = await getDb()
    const row = await db.getFirstAsync<ItemRow>('SELECT data FROM items WHERE id = ?', [id])
    return row ? hydrateItem(JSON.parse(row.data)) : undefined
  }

  async getByParentIds(parentIds: string[]): Promise<Item[]> {
    if (parentIds.length === 0) return []
    const db = await getDb()
    const placeholders = parentIds.map(() => '?').join(', ')
    const rows = await db.getAllAsync<ItemRow>(
      `SELECT data FROM items WHERE parentId IN (${placeholders})`,
      parentIds,
    )
    return hydrateRows(rows)
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
    // Una sola transacción para todo el lote en vez de N commits separados.
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
