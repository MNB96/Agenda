import { addDays, addHours, addMonths, addWeeks, addYears, differenceInCalendarDays, format, getDay, isAfter, parseISO, startOfDay, subDays } from 'date-fns'
import { ITEM_TYPE, type Item } from '../Item'
import type { NewItemInput } from '../Item.inputs'
import { RepeatConfig } from '../valueObjects/RepeatConfig'

const MAX_CATCH_UP_STEPS = 20000 // Generous safety cap (~2 years of hourly gaps), not an expected case.

export const computeNextDate = (base: Date, config: RepeatConfig): Date => {
  if (config.unit === 'hour') return addHours(base, config.interval)
  if (config.unit === 'day') return addDays(base, config.interval)
  if (config.unit === 'month') return addMonths(base, config.interval)
  if (config.unit === 'year') return addYears(base, config.interval)

  const days = config.daysOfWeek?.length ? [...config.daysOfWeek].sort((dayA, dayB) => dayA - dayB) : undefined
  if (!days) return addWeeks(base, config.interval)

  const baseDow = (getDay(base) + 6) % 7 // Monday = 0
  const nextInSameWeek = days.find((dayOfWeek) => dayOfWeek > baseDow)
  if (nextInSameWeek !== undefined) return addDays(base, nextInSameWeek - baseDow)

  const mondayOfBaseWeek = subDays(base, baseDow)
  const cycleStart = addWeeks(mondayOfBaseWeek, config.interval)
  return addDays(cycleStart, days[0])
}

interface OccurrenceStep {
  startDate: string | undefined
  startTime: string | undefined
  endDate: string | undefined
  deadline: string | undefined
  occurrencesDone: number
}

// The moment this step is anchored to — startDate+startTime when there's a start (so an hourly
// repeat can cross midnight correctly), otherwise deadline. Undefined if there's nothing to anchor to.
const resolveBaseMoment = (step: OccurrenceStep): Date | undefined => {
  if (step.startDate) {
    return step.startTime ? parseISO(`${step.startDate}T${step.startTime}:00`) : parseISO(step.startDate)
  }
  return step.deadline ? parseISO(step.deadline) : undefined
}

// One repeat interval forward from `step`, or null if the series ends there (end date/count
// reached, or nothing to anchor the next occurrence to).
const advanceOccurrence = (step: OccurrenceStep, config: RepeatConfig): OccurrenceStep | null => {
  const baseMoment = resolveBaseMoment(step)
  if (!baseMoment) return null

  const nextMoment = computeNextDate(baseMoment, config)
  if (config.end === 'on_date' && config.endDate && isAfter(nextMoment, parseISO(config.endDate))) {
    return null
  }
  const completedOccurrences = step.occurrencesDone + 1
  if (config.end === 'after_occurrences' && config.occurrences !== undefined && completedOccurrences >= config.occurrences) {
    return null
  }

  // endDate/deadline have no anchor of their own, so they just shift by the same day delta.
  const shiftedDays = differenceInCalendarDays(startOfDay(nextMoment), startOfDay(baseMoment))
  const shiftDate = (dateStr: string | undefined): string | undefined =>
    dateStr ? format(addDays(parseISO(dateStr), shiftedDays), 'yyyy-MM-dd') : undefined

  return {
    startDate: step.startDate ? format(nextMoment, 'yyyy-MM-dd') : undefined,
    startTime: step.startDate && step.startTime ? format(nextMoment, 'HH:mm') : step.startTime,
    endDate: shiftDate(step.endDate),
    deadline: step.startDate ? shiftDate(step.deadline) : format(nextMoment, 'yyyy-MM-dd'),
    occurrencesDone: completedOccurrences,
  }
}

const toNewItemInput = (item: Item, step: OccurrenceStep, config: RepeatConfig): NewItemInput => ({
  title: item.title,
  description: item.description,
  type: item.type,
  important: item.important,
  repeatRule: item.repeatRule,
  repeatConfig: { ...config, daysOfWeek: config.daysOfWeek ? [...config.daysOfWeek] : undefined, occurrencesDone: step.occurrencesDone },
  categoryId: item.categoryId,
  location: item.location,
  startDate: step.startDate,
  startTime: step.startTime,
  endDate: step.endDate,
  endTime: item.endTime,
  deadline: step.deadline,
  reminderConfig: item.reminderConfig ? [...item.reminderConfig] : undefined,
  travelConfig: item.travelConfig,
  academicConfig: item.academicConfig,
  syncToCalendar: item.syncToCalendar,
})

const currentStep = (item: Item, config: RepeatConfig): OccurrenceStep => ({
  startDate: item.startDate,
  startTime: item.startTime,
  endDate: item.endDate,
  deadline: item.deadline,
  occurrencesDone: config.occurrencesDone ?? 0,
})

// Next occurrence once the current one is completed, or null if the series has no more (end
// date/count reached, or the item has nothing to repeat).
export const buildNextOccurrence = (item: Item): NewItemInput | null => {
  if (item.type === ITEM_TYPE.GOAL) return null

  const config = item.repeatConfig
  if (!item.repeatRule || item.repeatRule === 'none' || !config) return null

  const stepped = advanceOccurrence(currentStep(item, config), config)
  return stepped ? toNewItemInput(item, stepped, config) : null
}

export type CatchUpResult =
  | { status: 'unchanged' }
  | { status: 'ended' }
  | { status: 'advanced'; input: NewItemInput }

const isPast = (step: OccurrenceStep, now: Date): boolean => {
  const moment = resolveBaseMoment(step)
  if (!moment) return false
  return step.startDate && step.startTime ? moment < now : isAfter(startOfDay(now), moment)
}

// Rolls a missed occurrence forward to the next one that isn't in the past — no lingering
// "missed" instance. 'ended' if the series runs out before catching up to now.
export const catchUpOverdueOccurrence = (item: Item, now: Date = new Date()): CatchUpResult => {
  if (item.type === ITEM_TYPE.GOAL) return { status: 'unchanged' }

  const config = item.repeatConfig
  if (!item.repeatRule || item.repeatRule === 'none' || !config) return { status: 'unchanged' }

  let step = currentStep(item, config)
  if (!isPast(step, now)) return { status: 'unchanged' }

  for (let i = 0; i < MAX_CATCH_UP_STEPS; i++) {
    const advanced = advanceOccurrence(step, config)
    if (!advanced) return { status: 'ended' }
    step = advanced
    if (!isPast(step, now)) {
      return { status: 'advanced', input: toNewItemInput(item, step, config) }
    }
  }
  return { status: 'ended' }
}
