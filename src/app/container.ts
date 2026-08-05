import { SQLiteItemRepository } from '../repositories/sqlite/itemRepository'
import { AsyncStorageSettingsRepository } from '../repositories/asyncstorage/settingsRepository'
import { GoogleCalendarRepository } from '../providers/calendar/googleCalendarRepository'

export const itemRepository = new SQLiteItemRepository()
export const settingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository = new GoogleCalendarRepository()
