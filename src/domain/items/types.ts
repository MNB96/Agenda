import type { ItemProps, ItemType } from './Item'
import { RepeatConfig, type RepeatConfigInput } from './valueObjects/RepeatConfig'
import { ReminderConfig, type ReminderConfigInput } from './valueObjects/ReminderConfig'
import { DateWindow, type DateWindowInput } from './valueObjects/DateWindow'
import { GoalConfig, type GoalConfigInput } from './valueObjects/GoalConfig'
import { AcademicConfig, type AcademicConfigInput } from './valueObjects/AcademicConfig'
import { TravelConfig, type TravelConfigInput, type TransportMode } from './valueObjects/TravelConfig'
import { CalendarLink, type CalendarLinkInput } from './valueObjects/CalendarLink'

export type { RepeatConfigInput, ReminderConfigInput, DateWindowInput, GoalConfigInput, AcademicConfigInput, TravelConfigInput, CalendarLinkInput, TransportMode }
export { RepeatConfig, ReminderConfig, DateWindow, GoalConfig, AcademicConfig, TravelConfig, CalendarLink }
export { Item, ITEM_TYPE } from './Item'
export type { ItemType, ItemProps, ScheduledItemType } from './Item'

export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type ItemStatus = 'active' | 'completed' | 'archived'

export interface ItemCategory {
  id: string
  name: string
  color: string
  icon: string
}

// Raw shape for creating an item: anything that becomes a value object is still the plain,
// not-yet-validated *Input shape here — Item.create is what turns it into the real thing.
export interface NewItemInput {
  title: string
  description?: string
  type?: ItemType
  important?: boolean
  repeatRule?: RepeatRule
  repeatConfig?: RepeatConfigInput
  parentId?: string
  categoryId?: string
  location?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  deadline?: string
  dateWindow?: DateWindowInput
  reminderConfig?: ReminderConfigInput[]
  travelConfig?: TravelConfigInput
  goalConfig?: GoalConfigInput
  academicConfig?: AcademicConfigInput
  syncToCalendar?: boolean
}

// Same idea for Item.update: everything except the value-object fields passes through as-is;
// those fields take raw input (or a carried-over instance — an instance already satisfies its
// own Input shape structurally) and get re-validated into real instances by Item.update.
// Derived from ItemProps (the flat prop bag), not Item itself — Item is a union now, and
// `keyof` on a union only sees fields common to every variant, which would silently drop
// goalConfig/dateWindow from this derivation instead of erroring.
export type ItemPatch = Partial<
  Omit<ItemProps, 'repeatConfig' | 'reminderConfig' | 'dateWindow' | 'goalConfig' | 'academicConfig' | 'travelConfig' | 'calendarLink'>
> & {
  repeatConfig?: RepeatConfigInput
  reminderConfig?: ReminderConfigInput[]
  dateWindow?: DateWindowInput
  goalConfig?: GoalConfigInput
  academicConfig?: AcademicConfigInput
  travelConfig?: TravelConfigInput
  calendarLink?: CalendarLinkInput
}
