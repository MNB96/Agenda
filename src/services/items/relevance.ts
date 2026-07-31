import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Item } from '../../domain/items/types'

export type TodayBucket =
  | 'overdue'
  | 'now'
  | 'next'
  | 'important'
  | 'later'
  | 'long_term_goal'

export interface ScoredItem {
  item: Item
  bucket: TodayBucket
  score: number
}

const itemDate = (item: Item): Date | undefined => {
  const raw = item.startDate ?? item.deadline ?? item.dateWindow?.startDate ?? item.endDate
  return raw ? parseISO(raw) : undefined
}

export const scoreItemsForToday = (items: Item[]): ScoredItem[] => {
  const today = startOfDay(new Date())

  return items
    .filter((item) => item.status !== 'archived' && item.status !== 'completed')
    .map((item) => {
      const date = itemDate(item)
      const days = date ? differenceInCalendarDays(startOfDay(date), today) : 365

      let bucket: TodayBucket = 'later'
      let score = 10

      if (item.type === 'goal' && (!date || days > 30)) {
        bucket = 'long_term_goal'
        score = 90
      } else if (days < 0 || (item.deadline && days < 0)) {
        bucket = 'overdue'
        score = 0
      } else if (days === 0 && item.startTime) {
        bucket = 'next'
        score = 15
      } else if (days === 0) {
        bucket = 'now'
        score = 20
      } else if (item.type === 'important_date' || item.type === 'date_window') {
        bucket = 'important'
        score = 25 + Math.min(days, 30)
      } else if (days <= 3) {
        bucket = 'next'
        score = 30 + days
      } else {
        bucket = 'later'
        score = 50 + days
      }

      return { item, bucket, score }
    })
    .sort((a, b) => a.score - b.score)
}