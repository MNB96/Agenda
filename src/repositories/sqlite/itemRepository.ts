import type { ItemRepository } from '../../domain/items/repositories'
import type { Item } from '../../domain/items/types'
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

  async getById(id: string): Promise<Item | undefined> {
    const db = await getDb()
    const row = await db.getFirstAsync<ItemRow>('SELECT data FROM items WHERE id = ?', [id])
    return row ? (JSON.parse(row.data) as Item) : undefined
  }

  async save(item: Item): Promise<Item> {
    const db = await getDb()
    await db.runAsync(
      `INSERT OR REPLACE INTO items (${ITEM_COLUMNS}) VALUES (${ITEM_PLACEHOLDERS})`,
      toItemRowParams(item),
    )
    return item
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

  async search(query: string): Promise<Item[]> {
    const normalized = query.trim().toLowerCase()
    const items = await this.list()
    if (!normalized) return items
    return items.filter((item) => {
      const category = item.categoryId ?? ''
      return [item.title, item.description, item.location, category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    })
  }
}
