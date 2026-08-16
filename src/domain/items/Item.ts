import { createId } from '../../utils/id'
import type { ItemStatus, RepeatRule } from './Item.types'
import type { ItemPatch, NewItemInput } from './Item.inputs'
import { RepeatConfig } from './valueObjects/RepeatConfig'
import { ReminderConfig } from './valueObjects/ReminderConfig'
import { AcademicConfig } from './valueObjects/AcademicConfig'
import { TravelConfig } from './valueObjects/TravelConfig'
import { CalendarLink, type CalendarLinkInput } from './valueObjects/CalendarLink'

// Fields shared by every variant; each subtype below adds only what's exclusive to it.
interface BaseItemProps {
  id: string
  title: string
  description?: string
  status: ItemStatus
  important?: boolean
  reminderOnly?: boolean
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
  reminderConfig?: readonly ReminderConfig[]
  travelConfig?: TravelConfig
  academicConfig?: AcademicConfig
  syncToCalendar?: boolean
  calendarLink?: CalendarLink
  calendarSyncPending?: boolean
  notificationIds?: readonly string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

abstract class BaseItem {
  // Type-only, erased by the compiler — keeps nominal typing without a real field to leak.
  protected declare readonly _brand: void

  readonly id: string
  readonly title: string
  readonly description?: string
  readonly status: ItemStatus
  readonly important?: boolean
  readonly reminderOnly: boolean
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
  readonly reminderConfig?: readonly ReminderConfig[]
  readonly travelConfig?: TravelConfig
  readonly academicConfig?: AcademicConfig
  readonly syncToCalendar?: boolean
  readonly calendarLink?: CalendarLink
  readonly calendarSyncPending?: boolean
  readonly notificationIds?: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly completedAt?: string

  protected constructor(props: BaseItemProps) {
    this.id = props.id
    this.title = props.title
    this.description = props.description
    this.status = props.status
    this.important = props.important
    this.reminderOnly = props.reminderOnly ?? false
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
    // Copy, not the caller's reference, so external mutation can't bypass Item.update.
    this.reminderConfig = props.reminderConfig ? [...props.reminderConfig] : undefined
    this.travelConfig = props.travelConfig
    this.academicConfig = props.academicConfig
    this.syncToCalendar = props.syncToCalendar
    this.calendarLink = props.calendarLink
    this.calendarSyncPending = props.calendarSyncPending
    this.notificationIds = props.notificationIds ? [...props.notificationIds] : undefined
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
    this.completedAt = props.completedAt
  }
}

// Single source of truth for every ItemType string — ItemType derives from it.
export const ITEM_TYPE = {
  TASK: 'task',
  GOAL: 'goal',
} as const

interface TaskItemProps extends BaseItemProps {
  type: typeof ITEM_TYPE.TASK
}

class TaskItem extends BaseItem {
  readonly type = ITEM_TYPE.TASK
  private constructor(props: TaskItemProps) {
    super(props)
  }
  static of(props: TaskItemProps): TaskItem {
    return new TaskItem(props)
  }
}

interface GoalItemProps extends BaseItemProps {
  type: typeof ITEM_TYPE.GOAL
}

class GoalItem extends BaseItem {
  readonly type = ITEM_TYPE.GOAL
  private constructor(props: GoalItemProps) {
    super(props)
  }
  static of(props: GoalItemProps): GoalItem {
    return new GoalItem(props)
  }
}

export type ItemType = typeof ITEM_TYPE.TASK | typeof ITEM_TYPE.GOAL

// A union, not one flat bag of optionals — narrow on `item.type` before reading a variant-only field.
export type Item = TaskItem | GoalItem

// Flat prop bag for merging current+patch or parsed JSON, before it's known which variant it becomes.
export interface ItemProps extends BaseItemProps {
  type: ItemType
}

// A task can't be due before it starts. New input only — hydrateItem skips this for old rows.
const validateItemDates = (startDate: string | undefined, deadline: string | undefined): void => {
  if (startDate && deadline && deadline < startDate) {
    throw new Error('La fecha límite no puede ser anterior a la fecha de inicio.')
  }
}

// A task's own end can't be before (or exactly when) it starts. New input only — hydrateItem skips this.
const validateTimeRange = (
  startDate: string | undefined,
  startTime: string | undefined,
  endDate: string | undefined,
  endTime: string | undefined,
): void => {
  if (!startDate || !startTime) return
  const resolvedEndDate = endDate ?? startDate
  if (resolvedEndDate < startDate) {
    throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.')
  }
  if (resolvedEndDate === startDate && endTime && endTime <= startTime) {
    throw new Error('La hora de fin debe ser posterior a la hora de inicio.')
  }
}

const normalizeTitle = (title: string): string => {
  const normalized = title.trim()
  if (!normalized) {
    throw new Error('El título no puede estar vacío.')
  }
  return normalized
}

const inferType = (input: NewItemInput): ItemType => input.type ?? ITEM_TYPE.TASK

const RULE_UNIT: Record<Exclude<RepeatRule, 'none'>, RepeatConfig['unit']> = {
  hourly: 'hour',
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

// repeatConfig, repeatRule and its unit must all agree. New input only — old rows still load.
const validateRecurrence = (repeatRule: RepeatRule | undefined, repeatConfig: RepeatConfig | undefined): void => {
  if ((!repeatRule || repeatRule === 'none') && repeatConfig) {
    throw new Error('No puede haber configuración de repetición sin una regla de repetición activa.')
  }
  if (repeatRule && repeatRule !== 'none' && !repeatConfig) {
    throw new Error('Falta la configuración de repetición.')
  }
  if (repeatRule && repeatRule !== 'none' && repeatConfig && RULE_UNIT[repeatRule] !== repeatConfig.unit) {
    throw new Error('La regla y la configuración de repetición no coinciden.')
  }
}

// A subtask completing on its own doesn't compose with buildNextOccurrence, which doesn't carry
// parentId forward — a recurring subtask's next instance would end up orphaned at the top level.
const validateSubtaskHasNoRecurrence = (parentId: string | undefined, repeatConfig: RepeatConfig | undefined): void => {
  if (parentId && repeatConfig) {
    throw new Error('Una subtarea no puede repetirse.')
  }
}

// Only these categories apply to goals. Single source of truth — domain/settings/types.ts
// derives its GOAL_CATEGORIES list from this same array.
export const GOAL_CATEGORY_IDS = ['personal', 'facultad', 'trabajo'] as const

// A goal has no place of its own and no schedule of its own — just título, detalles, deadline,
// categoría, submetas y importancia. Reminders are still deadline-driven, handled separately.
const validateGoalRestrictions = (
  type: ItemType,
  repeatRule: RepeatRule | undefined,
  repeatConfig: RepeatConfig | undefined,
  startDate: string | undefined,
  location: string | undefined,
  reminderConfig: readonly ReminderConfig[] | undefined,
  categoryId: string | undefined,
): void => {
  if (type !== ITEM_TYPE.GOAL) return
  if ((repeatRule && repeatRule !== 'none') || repeatConfig) {
    throw new Error('Una meta no puede repetirse. Al cumplirla, creá una meta nueva.')
  }
  if (startDate) {
    throw new Error('Una meta no puede tener fecha de inicio.')
  }
  if (location) {
    throw new Error('Una meta no puede tener ubicación.')
  }
  if (reminderConfig?.length) {
    throw new Error('Una meta no puede tener recordatorios.')
  }
  if (categoryId && !(GOAL_CATEGORY_IDS as readonly string[]).includes(categoryId)) {
    throw new Error('Una meta solo puede tener categoría Personal, Facultad o Trabajo.')
  }
}

// Assembles the right variant from a flat prop bag, rejecting an unrecognized `type` instead of
// silently defaulting it.
const buildItem = (flat: ItemProps): Item => {
  if (flat.type === ITEM_TYPE.GOAL) {
    return GoalItem.of({ ...flat, type: ITEM_TYPE.GOAL })
  }
  // Reachable at runtime even though ItemType says it shouldn't be: a stored row's `type`
  // could be a legacy value this domain no longer has.
  if ((flat.type as string) !== ITEM_TYPE.TASK) {
    throw new Error(`Tipo de item desconocido: "${flat.type}". Puede ser un dato de una versión anterior de la app.`)
  }
  return TaskItem.of({ ...flat, type: ITEM_TYPE.TASK })
}

const createItem = (input: NewItemInput): Item => {
  validateItemDates(input.startDate, input.deadline)
  const repeatConfig = input.repeatConfig ? RepeatConfig.create(input.repeatConfig) : undefined
  validateRecurrence(input.repeatRule, repeatConfig)
  validateSubtaskHasNoRecurrence(input.parentId, repeatConfig)
  const type = inferType(input)
  const reminderConfig = input.reminderConfig?.map((reminder) => ReminderConfig.create(reminder))
  validateGoalRestrictions(type, input.repeatRule, repeatConfig, input.startDate, input.location, reminderConfig, input.categoryId)
  validateTimeRange(input.startDate, input.startTime, input.endDate, input.endTime)
  const nowIso = new Date().toISOString()
  const reminderOnly = input.reminderOnly ?? false
  return buildItem({
    id: createId(),
    title: normalizeTitle(input.title),
    description: input.description?.trim() || undefined,
    type,
    status: 'active',
    important: input.important,
    reminderOnly,
    repeatRule: input.repeatRule,
    repeatConfig,
    parentId: input.parentId,
    categoryId: input.categoryId,
    location: input.location,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate: input.endDate,
    endTime: input.endTime,
    deadline: input.deadline,
    reminderConfig,
    travelConfig: input.travelConfig ? TravelConfig.create(input.travelConfig) : undefined,
    academicConfig: input.academicConfig ? AcademicConfig.create(input.academicConfig) : undefined,
    syncToCalendar: reminderOnly ? false : input.syncToCalendar ?? true,
    createdAt: nowIso,
    updatedAt: nowIso,
  })
}

const updateItem = (current: Item, patch: ItemPatch): Item => {
  // 'field' in patch distinguishes "not mentioned" from "explicitly cleared".
  const repeatConfig = 'repeatConfig' in patch
    ? (patch.repeatConfig ? RepeatConfig.create(patch.repeatConfig) : undefined)
    : current.repeatConfig
  const reminderConfig = 'reminderConfig' in patch
    ? patch.reminderConfig?.map((reminder) => ReminderConfig.create(reminder))
    : current.reminderConfig
  const academicConfig = 'academicConfig' in patch
    ? (patch.academicConfig ? AcademicConfig.create(patch.academicConfig) : undefined)
    : current.academicConfig
  const travelConfig = 'travelConfig' in patch
    ? (patch.travelConfig ? TravelConfig.create(patch.travelConfig) : undefined)
    : current.travelConfig
  const title = patch.title !== undefined ? normalizeTitle(patch.title) : current.title
  const description = 'description' in patch ? (patch.description?.trim() || undefined) : current.description

  const merged: ItemProps = {
    ...current,
    ...patch,
    type: patch.type ?? current.type,
    title,
    description,
    reminderOnly: patch.reminderOnly ?? current.reminderOnly,
    repeatConfig,
    reminderConfig,
    academicConfig,
    travelConfig,
    // Editing an item already linked to Calendar leaves it stale until the next sync.
    calendarSyncPending: current.calendarLink ? true : current.calendarSyncPending,
    updatedAt: new Date().toISOString(),
  }
  validateItemDates(merged.startDate, merged.deadline)
  validateRecurrence(merged.repeatRule, merged.repeatConfig)
  validateSubtaskHasNoRecurrence(merged.parentId, merged.repeatConfig)
  validateGoalRestrictions(merged.type, merged.repeatRule, merged.repeatConfig, merged.startDate, merged.location, merged.reminderConfig, merged.categoryId)
  validateTimeRange(merged.startDate, merged.startTime, merged.endDate, merged.endTime)
  return buildItem({
    ...merged,
    syncToCalendar: merged.reminderOnly ? false : merged.syncToCalendar ?? true,
  })
}

// Doesn't run validateItemDates (old data). Returns a result instead of throwing or silently
// reinterpreting a corrupted row as some other item type.
export type HydrationResult =
  | { success: true; item: Item }
  | { success: false; error: Error }

const hydrateItem = (props: ItemProps): HydrationResult => {
  try {
    return { success: true, item: buildItem(props) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid persisted item') }
  }
}

// Item and its subtasks are one consistency unit, even though subtasks are stored as separate rows.
const canCompleteItem = (item: Item, subtasks: Item[]): boolean => {
  return subtasks.every((subtask) => subtask.parentId === item.id && subtask.status === 'completed')
}

// Filters subtasks to the ones actually belonging to these items — a caller isn't trusted to
// have pre-filtered, same as canCompleteItem's own parentId check.
const itemIdsToRemoveWith = (items: Item[], subtasks: Item[]): string[] => {
  const parentIds = new Set(items.map((item) => item.id))
  const relatedSubtaskIds = subtasks.filter((subtask) => subtask.parentId && parentIds.has(subtask.parentId)).map((subtask) => subtask.id)
  return [...new Set([...parentIds, ...relatedSubtaskIds])]
}

// Narrower than updateItem: each owns one system-managed field a generic ItemPatch can't reach.
const withProps = (current: Item, overrides: Partial<ItemProps>): Item => {
  return buildItem({ ...current, ...overrides, updatedAt: new Date().toISOString() })
}

const getReminderOnlyDueMoment = (item: Item): Date | undefined => {
  const dueDate = item.startDate ?? item.deadline
  if (!dueDate) return undefined
  const dueTime = item.startTime ?? '00:00'
  return new Date(`${dueDate}T${dueTime}:00`)
}

export const isReminderOnlyDue = (item: Item, now: Date = new Date()): boolean => {
  if (!item.reminderOnly || item.status !== 'active') return false
  const dueMoment = getReminderOnlyDueMoment(item)
  if (!dueMoment) return false
  return now >= new Date(dueMoment.getTime() + 24 * 60 * 60 * 1000)
}

const completeItem = (current: Item, subtasks: Item[]): Item => {
  if (current.status !== 'active') {
    throw new Error('Solo se puede completar un item activo.')
  }
  if (!current.reminderOnly && !canCompleteItem(current, subtasks)) {
    throw new Error('Completá todas las subtareas primero.')
  }
  return withProps(current, { status: 'completed', completedAt: new Date().toISOString() })
}

const reopenItem = (current: Item): Item => {
  if (current.status !== 'completed') {
    throw new Error('Solo se puede reabrir un item completado.')
  }
  return withProps(current, { status: 'active', completedAt: undefined })
}

const linkCalendarItem = (current: Item, calendarLink: Omit<CalendarLinkInput, 'lastSyncedAt'> | undefined): Item => {
  const now = new Date().toISOString()
  return buildItem({
    ...current,
    calendarLink: calendarLink ? CalendarLink.create({ ...calendarLink, lastSyncedAt: now }) : undefined,
    calendarSyncPending: undefined,
    updatedAt: now,
  })
}

// Only ever sets it to true — clearing it requires an actual successful linkCalendar.
const markSyncPendingItem = (current: Item): Item => {
  return withProps(current, { calendarSyncPending: true })
}

// Doesn't bump updatedAt — scheduled notification ids are bookkeeping, not a content change.
const linkNotificationsItem = (current: Item, notificationIds: string[]): Item => {
  return buildItem({ ...current, notificationIds })
}

// eslint-disable-next-line @typescript-eslint/no-redeclare -- type Item and const Item are in separate namespaces
export const Item = {
  create: createItem,
  update: updateItem,
  hydrate: hydrateItem,
  canComplete: canCompleteItem,
  idsToRemoveWith: itemIdsToRemoveWith,
  isReminderOnlyDue,
  complete: completeItem,
  reopen: reopenItem,
  linkCalendar: linkCalendarItem,
  markSyncPending: markSyncPendingItem,
  linkNotifications: linkNotificationsItem,
}
