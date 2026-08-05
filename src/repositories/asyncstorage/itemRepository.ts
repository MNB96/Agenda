import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ItemRepository } from '../../domain/items/repositories'
import type { Item } from '../../domain/items/types'

const ITEMS_KEY = '@agenda/items'

export class AsyncStorageItemRepository implements ItemRepository {
  async list(): Promise<Item[]> {
    const raw = await AsyncStorage.getItem(ITEMS_KEY)
    if (!raw) {
      return []
    }
    try {
      return JSON.parse(raw) as Item[]
    } catch {
      return []
    }
  }

  async getById(id: string): Promise<Item | undefined> {
    const items = await this.list()
    return items.find((item) => item.id === id)
  }

  async save(item: Item): Promise<Item> {
    const items = await this.list()
    const next = items.some((entry) => entry.id === item.id)
      ? items.map((entry) => (entry.id === item.id ? item : entry))
      : [item, ...items]
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next))
    return item
  }

  async remove(id: string): Promise<void> {
    const items = await this.list()
    const next = items.filter((item) => item.id !== id)
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next))
  }

  async removeMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const items = await this.list()
    const next = items.filter((item) => !idSet.has(item.id))
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(next))
  }

  async search(query: string): Promise<Item[]> {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return this.list()
    }

    const items = await this.list()
    return items.filter((item) => {
      const category = item.categoryId ?? ''
      return [item.title, item.description, item.location, category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    })
  }
}
