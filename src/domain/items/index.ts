// Public surface of the items bounded context — code outside this folder imports only from here.
export { Item, ITEM_TYPE, GOAL_CATEGORY_IDS } from './Item'
export type { ItemType, ItemProps, HydrationResult } from './Item'

export type { RepeatRule, ItemStatus, ItemCategory } from './Item.types'

export type { NewItemInput, ItemPatch } from './Item.inputs'

export type { ItemRepository } from './ItemRepository'

export { RepeatConfig } from './valueObjects/RepeatConfig'
export type { RepeatConfigInput } from './valueObjects/RepeatConfig'
export { ReminderConfig } from './valueObjects/ReminderConfig'
export type { ReminderConfigInput } from './valueObjects/ReminderConfig'
export { AcademicConfig } from './valueObjects/AcademicConfig'
export type { AcademicConfigInput } from './valueObjects/AcademicConfig'
export { TravelConfig } from './valueObjects/TravelConfig'
export type { TravelConfigInput, TransportMode } from './valueObjects/TravelConfig'
export { CalendarLink } from './valueObjects/CalendarLink'
export type { CalendarLinkInput } from './valueObjects/CalendarLink'
