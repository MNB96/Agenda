import { createId } from '../../utils/id'
import type { ItemPatch, ItemStatus, NewItemInput, RepeatRule } from './types'
import { RepeatConfig } from './valueObjects/RepeatConfig'
import { ReminderConfig } from './valueObjects/ReminderConfig'
import { DateWindow } from './valueObjects/DateWindow'
import { GoalConfig } from './valueObjects/GoalConfig'
import { AcademicConfig } from './valueObjects/AcademicConfig'
import { TravelConfig } from './valueObjects/TravelConfig'
import { CalendarLink } from './valueObjects/CalendarLink'

// Fields shared by every kind of item, regardless of type. task/event/deadline share this exact
// shape today — they're distinguished only by which of these fields ends up filled (event has
// startTime, deadline has deadline, task has neither), not by having different fields, so they
// stay one variant (ScheduledItem). goal and date_window each own one field none of the others
// can have (goalConfig, dateWindow) — those get their own variant so the compiler rejects the
// mismatch instead of just documenting it in a comment.
interface BaseItemProps {
  id: string
  title: string
  description?: string
  status: ItemStatus
  important?: boolean
  repeatRule?: RepeatRule
  repeatConfig?: RepeatConfig
  parentId?: string
  categoryId?: string
  location?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  deadline?: string
  reminderConfig?: ReminderConfig[]
  travelConfig?: TravelConfig
  academicConfig?: AcademicConfig
  syncToCalendar?: boolean
  calendarLink?: CalendarLink
  calendarSyncPending?: boolean
  notificationIds?: string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

abstract class BaseItem {
  protected readonly _brand = 'Item' as const

  readonly id: string
  readonly title: string
  readonly description?: string
  readonly status: ItemStatus
  readonly important?: boolean
  readonly repeatRule?: RepeatRule
  readonly repeatConfig?: RepeatConfig
  readonly parentId?: string
  readonly categoryId?: string
  readonly location?: string
  readonly startDate?: string
  readonly startTime?: string
  readonly endDate?: string
  readonly endTime?: string
  readonly deadline?: string
  readonly reminderConfig?: ReminderConfig[]
  readonly travelConfig?: TravelConfig
  readonly academicConfig?: AcademicConfig
  readonly syncToCalendar?: boolean
  readonly calendarLink?: CalendarLink
  readonly calendarSyncPending?: boolean
  readonly notificationIds?: string[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt?: string

  protected constructor(props: BaseItemProps) {
    this.id = props.id
    this.title = props.title
    this.description = props.description
    this.status = props.status
    this.important = props.important
    this.repeatRule = props.repeatRule
    this.repeatConfig = props.repeatConfig
    this.parentId = props.parentId
    this.categoryId = props.categoryId
    this.location = props.location
    this.startDate = props.startDate
    this.startTime = props.startTime
    this.endDate = props.endDate
    this.endTime = props.endTime
    this.deadline = props.deadline
    this.reminderConfig = props.reminderConfig
    this.travelConfig = props.travelConfig
    this.academicConfig = props.academicConfig
    this.syncToCalendar = props.syncToCalendar
    this.calendarLink = props.calendarLink
    this.calendarSyncPending = props.calendarSyncPending
    this.notificationIds = props.notificationIds
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
    this.completedAt = props.completedAt
  }
}

// Single source of truth for every ItemType string value — every runtime comparison/assignment
// in this file and elsewhere references these instead of repeating the literal, so renaming a
// type is a one-line change here instead of a grep-and-replace across the codebase. The *type*
// declarations below (ScheduledItemType, ItemType) are the type-level canonical definition and
// derive from this same object via `typeof`, so there's exactly one place either has to change.
export const ITEM_TYPE = {
  TASK: 'task',
  EVENT: 'event',
  DEADLINE: 'deadline',
  GOAL: 'goal',
  DATE_WINDOW: 'date_window',
} as const

export type ScheduledItemType = typeof ITEM_TYPE.TASK | typeof ITEM_TYPE.EVENT | typeof ITEM_TYPE.DEADLINE

interface ScheduledItemProps extends BaseItemProps {
  type: ScheduledItemType
}

class ScheduledItem extends BaseItem {
  readonly type: ScheduledItemType
  private constructor(props: ScheduledItemProps) {
    super(props)
    this.type = props.type
  }
  static of(props: ScheduledItemProps): ScheduledItem {
    return new ScheduledItem(props)
  }
}

interface GoalItemProps extends BaseItemProps {
  type: typeof ITEM_TYPE.GOAL
  goalConfig: GoalConfig
}

class GoalItem extends BaseItem {
  readonly type = ITEM_TYPE.GOAL
  readonly goalConfig: GoalConfig
  private constructor(props: GoalItemProps) {
    super(props)
    this.goalConfig = props.goalConfig
  }
  static of(props: GoalItemProps): GoalItem {
    return new GoalItem(props)
  }
}

interface DateWindowItemProps extends BaseItemProps {
  type: typeof ITEM_TYPE.DATE_WINDOW
  dateWindow: DateWindow
}

class DateWindowItem extends BaseItem {
  readonly type = ITEM_TYPE.DATE_WINDOW
  readonly dateWindow: DateWindow
  private constructor(props: DateWindowItemProps) {
    super(props)
    this.dateWindow = props.dateWindow
  }
  static of(props: DateWindowItemProps): DateWindowItem {
    return new DateWindowItem(props)
  }
}

export type ItemType = ScheduledItemType | typeof ITEM_TYPE.GOAL | typeof ITEM_TYPE.DATE_WINDOW

// The domain entity — a union, not one flat bag of optionals. Narrow on `item.type` before
// reading `goalConfig` (only on the 'goal' branch) or `dateWindow` (only on 'date_window');
// every other field is common to all three variants.
export type Item = ScheduledItem | GoalItem | DateWindowItem

// Flat prop bag covering every field across all three variants — the shape you get from merging
// current+patch, from parsed persisted JSON, or from fresh input, before it's known (or
// re-confirmed) which variant it should become.
export interface ItemProps extends BaseItemProps {
  type: ItemType
  goalConfig?: GoalConfig
  dateWindow?: DateWindow
}

// Entity-level invariant (spans two loose fields, doesn't belong to any single value object):
// a task can't be due before it starts. Guards new input, not old persisted data — hydrateItem
// deliberately doesn't run this, so a legacy row from before this rule existed can still load.
const validateItemDates = (startDate: string | undefined, deadline: string | undefined): void => {
  if (startDate && deadline && deadline < startDate) {
    throw new Error('La fecha límite no puede ser anterior a la fecha de inicio.')
  }
}

const inferType = (input: NewItemInput): ItemType => {
  if (input.type) {
    return input.type
  }
  if (input.goalConfig) {
    return ITEM_TYPE.GOAL
  }
  if (input.dateWindow?.startDate || input.dateWindow?.endDate) {
    return ITEM_TYPE.DATE_WINDOW
  }
  if (input.startDate && input.startTime) {
    return ITEM_TYPE.EVENT
  }
  if (input.deadline) {
    return ITEM_TYPE.DEADLINE
  }
  return ITEM_TYPE.TASK
}

// Assembles the right variant from a flat prop bag, enforcing that a goal has goalConfig and a
// date_window has dateWindow — the one place that turns "a type label plus some optional fields"
// into something the compiler can prove is internally consistent. Extra fields that don't belong
// to the chosen variant (e.g. a stray goalConfig on a 'task') are silently dropped, not an error
// — only a *missing* required field for the chosen type is a real problem.
const buildItem = (flat: ItemProps): Item => {
  if (flat.type === ITEM_TYPE.GOAL) {
    if (!flat.goalConfig) {
      throw new Error('Falta la configuración de la meta.')
    }
    return GoalItem.of({ ...flat, type: ITEM_TYPE.GOAL, goalConfig: flat.goalConfig })
  }
  if (flat.type === ITEM_TYPE.DATE_WINDOW) {
    if (!flat.dateWindow) {
      throw new Error('Falta la ventana de fechas.')
    }
    return DateWindowItem.of({ ...flat, type: ITEM_TYPE.DATE_WINDOW, dateWindow: flat.dateWindow })
  }
  return ScheduledItem.of({ ...flat, type: flat.type })
}

const createItem = (input: NewItemInput): Item => {
  validateItemDates(input.startDate, input.deadline)
  const nowIso = new Date().toISOString()
  return buildItem({
    id: createId(),
    title: input.title.trim(),
    description: input.description?.trim(),
    type: inferType(input),
    status: 'active',
    important: input.important,
    repeatRule: input.repeatRule,
    repeatConfig: input.repeatConfig ? RepeatConfig.create(input.repeatConfig) : undefined,
    parentId: input.parentId,
    categoryId: input.categoryId,
    location: input.location,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
    endTime: input.endTime,
    deadline: input.deadline,
    dateWindow: input.dateWindow ? DateWindow.create(input.dateWindow) : undefined,
    reminderConfig: input.reminderConfig?.map((reminder) => ReminderConfig.create(reminder)),
    travelConfig: input.travelConfig ? TravelConfig.create(input.travelConfig) : undefined,
    goalConfig: input.goalConfig ? GoalConfig.create(input.goalConfig) : undefined,
    academicConfig: input.academicConfig ? AcademicConfig.create(input.academicConfig) : undefined,
    syncToCalendar: input.syncToCalendar ?? true,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
}

const updateItem = (current: Item, patch: ItemPatch): Item => {
  // 'field' in patch distinguishes "not mentioned, keep current" from "explicitly set to
  // undefined, clear it" — both are real cases callers rely on (e.g. clearing repeatConfig
  // when the user turns repeatRule back to 'none').
  const repeatConfig = 'repeatConfig' in patch
    ? (patch.repeatConfig ? RepeatConfig.create(patch.repeatConfig) : undefined)
    : current.repeatConfig
  const reminderConfig = 'reminderConfig' in patch
    ? patch.reminderConfig?.map((reminder) => ReminderConfig.create(reminder))
    : current.reminderConfig
  const dateWindow = 'dateWindow' in patch
    ? (patch.dateWindow ? DateWindow.create(patch.dateWindow) : undefined)
    : (current.type === ITEM_TYPE.DATE_WINDOW ? current.dateWindow : undefined)
  const goalConfig = 'goalConfig' in patch
    ? (patch.goalConfig ? GoalConfig.create(patch.goalConfig) : undefined)
    : (current.type === ITEM_TYPE.GOAL ? current.goalConfig : undefined)
  const academicConfig = 'academicConfig' in patch
    ? (patch.academicConfig ? AcademicConfig.create(patch.academicConfig) : undefined)
    : current.academicConfig
  const travelConfig = 'travelConfig' in patch
    ? (patch.travelConfig ? TravelConfig.create(patch.travelConfig) : undefined)
    : current.travelConfig
  const calendarLink = 'calendarLink' in patch
    ? (patch.calendarLink ? CalendarLink.create(patch.calendarLink) : undefined)
    : current.calendarLink

  const merged: ItemProps = {
    ...current,
    ...patch,
    type: patch.type ?? current.type,
    repeatConfig,
    reminderConfig,
    dateWindow,
    goalConfig,
    academicConfig,
    travelConfig,
    calendarLink,
    updatedAt: new Date().toISOString(),
  }
  validateItemDates(merged.startDate, merged.deadline)
  return buildItem(merged)
}

// Reconstructs an already-trusted Item from storage. Doesn't run validateItemDates (guards new
// input, not old data) and tolerates a type/exclusive-field mismatch that shouldn't be possible
// but could exist in old rows (e.g. a 'goal' whose goalConfig failed its own hydration and got
// dropped) by falling back to a plain ScheduledItem with the rest of the data intact, instead of
// losing the item entirely.
const hydrateItem = (props: ItemProps): Item => {
  try {
    return buildItem(props)
  } catch {
    return ScheduledItem.of({ ...props, type: ITEM_TYPE.TASK })
  }
}

// --- Aggregate rules: Item and its subtasks are one consistency unit ---
// Subtasks are stored as independent rows (not embedded), so the aggregate is assembled on
// demand by whoever fetched them — but the rules governing how they interact together belong
// here, on the root, not wherever happens to trigger a completion or a removal.

// A parent can't be marked complete while it still has open subtasks — it isn't actually
// finished yet. Every caller that can complete an item must go through this, not just the one
// screen that happened to add a button-disable check first.
const canCompleteItem = (item: Item, subtasks: Item[]): boolean => {
  return subtasks.every((subtask) => subtask.status === 'completed')
}

// Every id that must be removed together with this set of items — subtasks don't make sense
// without their parent (the Task list hides any item whose parentId no longer resolves), so
// removing an item always removes its subtasks with it. Takes arrays so the same rule serves
// both single-item removal and the batch auto-archive path.
const itemIdsToRemoveWith = (items: Item[], subtasks: Item[]): string[] => {
  return [...items.map((item) => item.id), ...subtasks.map((subtask) => subtask.id)]
}

// Item is a `type` (a union), which can't carry static methods the way a class can — this
// companion const lives alongside it under the same name instead (types and values occupy
// separate namespaces in TS, so both `Item` the type and `Item` the value coexist), so every
// existing `Item.create(...)` / `Item.update(...)` call site keeps working unchanged.
// eslint-disable-next-line @typescript-eslint/no-redeclare -- type Item and const Item are in separate namespaces, this is intentional
export const Item = {
  create: createItem,
  update: updateItem,
  hydrate: hydrateItem,
  canComplete: canCompleteItem,
  idsToRemoveWith: itemIdsToRemoveWith,
}
