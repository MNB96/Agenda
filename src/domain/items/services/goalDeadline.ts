import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { ITEM_TYPE, type Item } from '../Item'

export const MISSED_GOAL_TITLE_SUFFIX = ' [No cumplida]'

// Never touches item.title itself — only the Calendar Task's synced title gets the suffix.
export const isGoalPastDeadlineUnfulfilled = (item: Item, now: Date = new Date()): boolean => {
  if (item.type !== ITEM_TYPE.GOAL || item.status !== 'active' || !item.deadline) return false
  return differenceInCalendarDays(startOfDay(parseISO(item.deadline)), startOfDay(now)) < 0
}
