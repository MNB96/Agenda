import { AsyncStorageItemRepository } from '../repositories/asyncstorage/itemRepository'
import { AsyncStorageSettingsRepository } from '../repositories/asyncstorage/settingsRepository'
import { GoogleCalendarRepository } from '../providers/calendar/googleCalendarRepository'

export const itemRepository = new AsyncStorageItemRepository()
export const settingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository = new GoogleCalendarRepository()
