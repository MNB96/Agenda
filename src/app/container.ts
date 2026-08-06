import { SQLiteItemRepository } from '../repositories/sqlite/itemRepository'
import { AsyncStorageSettingsRepository } from '../repositories/asyncstorage/settingsRepository'
import { GoogleCalendarRepository } from '../providers/calendar/googleCalendarRepository'
import type { ItemRepository } from '../domain/items/repositories'
import type { SettingsRepository } from '../domain/settings/repositories'
import type { CalendarRepository } from '../domain/calendar/repositories'

export const itemRepository: ItemRepository = new SQLiteItemRepository()
export const settingsRepository: SettingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository: CalendarRepository = new GoogleCalendarRepository()
