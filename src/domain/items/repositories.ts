import type { Item } from './types'

export interface ItemRepository {
  list(): Promise<Item[]>
  getById(id: string): Promise<Item | undefined>
  save(item: Item): Promise<Item>
  remove(id: string): Promise<void>
  removeMany(ids: string[]): Promise<void>
  search(query: string): Promise<Item[]>
}