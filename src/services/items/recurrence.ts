import { addDays, addMonths, addWeeks, addYears, format, getDay, isAfter, parseISO, subDays } from 'date-fns'
import type { Item, NewItemInput, RepeatConfig } from '../../domain/items/types'

export const computeNextDate = (base: Date, config: RepeatConfig): Date => {
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

/**
 * Builds the input for the next occurrence of a repeating item once the current one is
 * completed, or null if the series has no more occurrences (end date/count reached, or
 * the item has nothing to repeat).
 */
export const buildNextOccurrence = (item: Item): NewItemInput | null => {
  const config = item.repeatConfig
  if (!item.repeatRule || item.repeatRule === 'none' || !config) return null

  const baseDateStr = item.startDate ?? item.deadline
  if (!baseDateStr) return null

  const nextDate = computeNextDate(parseISO(baseDateStr), config)
  const nextDateStr = format(nextDate, 'yyyy-MM-dd')

  if (config.end === 'on_date' && config.endDate && isAfter(nextDate, parseISO(config.endDate))) {
    return null
  }

  const occurrencesDone = (config.occurrencesDone ?? 1) + 1
  if (config.end === 'after_occurrences' && config.occurrences && occurrencesDone > config.occurrences) {
    return null
  }

  return {
    title: item.title,
    description: item.description,
    type: item.type,
    important: item.important,
    repeatRule: item.repeatRule,
    repeatConfig: { ...config, occurrencesDone },
    categoryId: item.categoryId,
    location: item.location,
    startDate: item.startDate ? nextDateStr : undefined,
    startTime: item.startTime,
    deadline: item.startDate ? item.deadline : nextDateStr,
    reminderConfig: item.reminderConfig?.filter((reminder) => reminder.mode !== 'absolute'),
    travelConfig: item.travelConfig,
    goalConfig: item.goalConfig,
    academicConfig: item.academicConfig,
    syncToGoogleCalendar: item.syncToGoogleCalendar,
  }
}
