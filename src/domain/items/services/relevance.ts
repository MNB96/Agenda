import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { ITEM_TYPE, type Item } from '../Item'

export type TodayBucket =
  | 'overdue'
  | 'now'
  | 'next'
  | 'later'
  | 'long_term_goal'

interface ScoredItem {
  item: Item
  bucket: TodayBucket
  score: number
}

// Near-term urgency (next/later) prefers deadline over startDate.
const itemDate = (item: Item): Date | undefined => {
  const raw = item.deadline ?? item.startDate ?? item.endDate
  return raw ? parseISO(raw) : undefined
}

// startDate alone decides overdue-ness when it exists — deadline is only the fallback signal for
// items with no startDate at all (deadline-only tasks, and Goals, which never have a startDate).
const isOverdue = (item: Item, now: Date): boolean => {
  const today = startOfDay(now)
  if (!item.startDate) {
    return Boolean(item.deadline) && differenceInCalendarDays(startOfDay(parseISO(item.deadline!)), today) < 0
  }
  const startDays = differenceInCalendarDays(startOfDay(parseISO(item.startDate)), today)
  if (startDays < 0) return true
  if (startDays === 0 && item.startTime) {
    return parseISO(`${item.startDate}T${item.startTime}:00`) < now
  }
  return false
}

export const scoreItemsForToday = (items: Item[]): ScoredItem[] => {
  const now = new Date()
  const today = startOfDay(now)

  return items
    .filter((item) => item.status !== 'completed')
    .map((item) => {
      const date = itemDate(item)
      const days = date ? differenceInCalendarDays(startOfDay(date), today) : 365

      let bucket: TodayBucket = 'later'
      let score = 10

      if (item.type === ITEM_TYPE.GOAL && (!date || days > 30)) {
        bucket = 'long_term_goal'
        score = 90
      } else if (isOverdue(item, now)) {
        bucket = 'overdue'
        score = 0
      } else if (days === 0 && item.startTime) {
        bucket = 'next'
        score = 15
      } else if (days === 0) {
        bucket = 'now'
        score = 20
      } else if (days <= 3) {
        bucket = 'next'
        score = 30 + days
      } else {
        bucket = 'later'
        score = 50 + days
      }

      return { item, bucket, score }
    })
    .sort((entryA, entryB) => entryA.score - entryB.score)
}