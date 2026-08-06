import type { RepeatRule } from './Item.types'
import type { ItemType } from './Item'
import type { RepeatConfigInput } from './valueObjects/RepeatConfig'
import type { ReminderConfigInput } from './valueObjects/ReminderConfig'
import type { AcademicConfigInput } from './valueObjects/AcademicConfig'
import type { TravelConfigInput } from './valueObjects/TravelConfig'

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
  reminderConfig?: ReminderConfigInput[]
  travelConfig?: TravelConfigInput
  academicConfig?: AcademicConfigInput
  syncToCalendar?: boolean
}

// Not derived from ItemProps: excludes system-managed fields (status, calendarLink, etc.) that
// only Item.complete/linkCalendar/markSyncPending are allowed to touch.
export type ItemPatch = Partial<NewItemInput>
