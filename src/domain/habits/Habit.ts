import { createId } from '../../utils/id'
import { validateHabitReminder, type HabitReminderConfig } from './HabitReminder'

export const HABIT_REGULARITY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const

export type HabitRegularity = (typeof HABIT_REGULARITY)[keyof typeof HABIT_REGULARITY]

// Only these categories apply to habits. Single source of truth — domain/settings/types.ts
// derives its HABIT_CATEGORIES list from this same array.
export const HABIT_CATEGORY_IDS = ['personal', 'facultad', 'casa', 'salud'] as const

export interface Habit {
  readonly id: string
  readonly title: string
  readonly categoryId?: string
  readonly regularity: HabitRegularity
  readonly reminder?: HabitReminderConfig
  readonly notificationIds?: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface NewHabitInput {
  title: string
  categoryId?: string
  regularity: HabitRegularity
  reminder?: HabitReminderConfig
}

export type HabitPatch = Partial<NewHabitInput>

const normalizeTitle = (title: string): string => {
  const normalized = title.trim()
  if (!normalized) {
    throw new Error('El título no puede estar vacío.')
  }
  return normalized
}

const REGULARITIES: readonly string[] = Object.values(HABIT_REGULARITY)

const validateRegularity = (regularity: string): void => {
  if (!REGULARITIES.includes(regularity)) {
    throw new Error(`Regularidad desconocida: "${regularity}".`)
  }
}

const validateCategory = (categoryId: string | undefined): void => {
  if (categoryId && !(HABIT_CATEGORY_IDS as readonly string[]).includes(categoryId)) {
    throw new Error('Categoría no válida para un hábito.')
  }
}

const createHabit = (input: NewHabitInput): Habit => {
  validateRegularity(input.regularity)
  validateCategory(input.categoryId)
  if (input.reminder) validateHabitReminder(input.reminder)
  const nowIso = new Date().toISOString()
  return {
    id: createId(),
    title: normalizeTitle(input.title),
    categoryId: input.categoryId,
    regularity: input.regularity,
    reminder: input.reminder,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

const updateHabit = (current: Habit, patch: HabitPatch): Habit => {
  const title = patch.title !== undefined ? normalizeTitle(patch.title) : current.title
  const regularity = patch.regularity ?? current.regularity
  validateRegularity(regularity)
  const categoryId = 'categoryId' in patch ? patch.categoryId : current.categoryId
  validateCategory(categoryId)
  const reminder = 'reminder' in patch ? patch.reminder : current.reminder
  if (reminder) validateHabitReminder(reminder)
  return { ...current, ...patch, title, regularity, reminder, updatedAt: new Date().toISOString() }
}

export type HabitHydrationResult = { success: true; habit: Habit } | { success: false; error: Error }

// Reminder isn't re-validated here — decorative data whose corruption shouldn't sink the habit.
const hydrateHabit = (props: Habit): HabitHydrationResult => {
  try {
    validateRegularity(props.regularity)
    normalizeTitle(props.title)
    return { success: true, habit: props }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid persisted habit') }
  }
}

// eslint-disable-next-line @typescript-eslint/no-redeclare -- type Habit and const Habit are in separate namespaces
export const Habit = {
  create: createHabit,
  update: updateHabit,
  hydrate: hydrateHabit,
}
