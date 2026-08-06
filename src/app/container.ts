import { SQLiteItemRepository } from '../infrastructure/persistence/sqlite/itemRepository'
import { AsyncStorageSettingsRepository } from '../infrastructure/persistence/asyncstorage/settingsRepository'
import { GoogleCalendarRepository } from '../infrastructure/calendar/googleCalendarRepository'
import { GoogleTasksRepository } from '../infrastructure/tasks/googleTasksRepository'
import type { ItemRepository } from '../domain/items'
import type { SettingsRepository } from '../domain/settings/repositories'
import type { CalendarRepository } from '../domain/calendar/repositories'
import type { TaskRepository } from '../domain/tasks/repositories'

export const itemRepository: ItemRepository = new SQLiteItemRepository()
export const settingsRepository: SettingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository: CalendarRepository = new GoogleCalendarRepository()
export const taskRepository: TaskRepository = new GoogleTasksRepository()
