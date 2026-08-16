import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { Habit } from '../../domain/habits'
import { resolveReminderTimes } from '../../domain/habits'

export const HABIT_COMPLETION_ACTION_ID = 'mark_habit_complete'
export const HABIT_COMPLETION_CATEGORY_ID = 'habit_completion'

export const registerHabitNotificationActions = async (): Promise<void> => {
  await Notifications.setNotificationCategoryAsync(HABIT_COMPLETION_CATEGORY_ID, [
    {
      identifier: HABIT_COMPLETION_ACTION_ID,
      buttonTitle: 'Marcar como completado',
      options: { opensAppToForeground: true },
    },
  ])
}

// DAILY triggers repeat natively forever — no per-day rescheduling needed, and they keep
// firing even if the app is never reopened (unlike a "reroll every day" approach would).
export const scheduleHabitReminders = async (habit: Habit): Promise<string[]> => {
  if (!habit.reminder) return []
  const times = resolveReminderTimes(habit.reminder)

  const results = await Promise.all(
    times.map(async (hhmm): Promise<string | null> => {
      const [hour, minute] = hhmm.split(':').map(Number)
      try {
        return await Notifications.scheduleNotificationAsync({
          content: {
            title: habit.title,
            body: '¡Es hora de tu hábito!',
            data: { habitId: habit.id },
            sound: true,
            categoryIdentifier: HABIT_COMPLETION_CATEGORY_ID,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
          },
        })
      } catch {
        return null
      }
    }),
  )

  return results.filter((id): id is string => id !== null)
}

export const cancelHabitReminders = async (habit: { notificationIds?: readonly string[] }): Promise<void> => {
  const toCancel = habit.notificationIds ?? []
  await Promise.all(
    toCancel.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id)
      } catch {}
    }),
  )
}
