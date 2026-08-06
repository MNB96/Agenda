import type { Item } from './types'

export interface ItemRepository {
  list(): Promise<Item[]>
  listActive(): Promise<Item[]>
  listCompleted(limit: number, offset: number): Promise<Item[]>
  listCompletedByCategory(categoryId: string, limit: number): Promise<Item[]>
  listArchiveEligible(completedBefore: string): Promise<Item[]>
  getById(id: string): Promise<Item | undefined>
  getByParentIds(parentIds: string[]): Promise<Item[]>
  save(item: Item): Promise<Item>
  saveMany(items: Item[]): Promise<Item[]>
  remove(id: string): Promise<void>
  removeMany(ids: string[]): Promise<void>
}