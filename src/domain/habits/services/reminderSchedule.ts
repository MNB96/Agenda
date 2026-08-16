import { HABIT_REMINDER_MODE, type HabitReminderConfig } from '../HabitReminder'

const DEFAULT_WINDOW_START = '00:00'
const DEFAULT_WINDOW_END = '23:59'

const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

const toHHMM = (minutes: number): string => {
  const m = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(m / 60).toString().padStart(2, '0')
  const mins = (m % 60).toString().padStart(2, '0')
  return `${hours}:${mins}`
}

const computeIntervalTimes = (config: HabitReminderConfig): string[] => {
  const start = toMinutes(config.windowStart ?? DEFAULT_WINDOW_START)
  const end = toMinutes(config.windowEnd ?? DEFAULT_WINDOW_END)
  const stepMinutes = Math.max(1, Math.round((config.intervalHours ?? 1) * 60))
  const effectiveEnd = start > end ? end + 1440 : end
  const times: string[] = []
  for (let t = start; t <= effectiveEnd; t += stepMinutes) {
    times.push(toHHMM(t))
  }
  return times
}

// Rolled once by the caller (not every render) — persisted on HabitReminderConfig.randomTimes
// so the schedule stays fixed day to day instead of reshuffling on every edit.
export const generateRandomTimes = (config: Pick<HabitReminderConfig, 'timesPerDay' | 'windowStart' | 'windowEnd'>): string[] => {
  const start = toMinutes(config.windowStart ?? DEFAULT_WINDOW_START)
  const end = toMinutes(config.windowEnd ?? DEFAULT_WINDOW_END)
  const count = Math.max(1, config.timesPerDay ?? 1)
  const overnight = start > end
  const span = Math.max(1, overnight ? (1440 - start) + end + 1 : end - start + 1)
  const chosen = new Set<number>()
  let attempts = 0
  while (chosen.size < count && attempts < count * 30) {
    chosen.add((start + Math.floor(Math.random() * span)) % 1440)
    attempts++
  }
  return [...chosen].sort((a, b) => a - b).map(toHHMM)
}

export const resolveReminderTimes = (config: HabitReminderConfig): string[] =>
  config.mode === HABIT_REMINDER_MODE.INTERVAL ? computeIntervalTimes(config) : [...(config.randomTimes ?? [])]
