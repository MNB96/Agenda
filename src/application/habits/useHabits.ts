import { useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, startOfISOWeek } from 'date-fns'
import { habitRepository } from '../../app/container'
import { Habit, type HabitCompletion, type HabitOccurrence, type HabitPatch, type NewHabitInput } from '../../domain/habits'
import { HABIT_COMPLETION_ACTION_ID, cancelHabitReminders, scheduleHabitReminders } from '../../infrastructure/notifications/habitNotifications'

const processedNotificationIds = new Set<string>()

const HABITS_KEY = ['habits']
const HABIT_COMPLETIONS_KEY = ['habit-completions']
const HABIT_OCCURRENCES_TODAY_KEY = ['habit-occurrences-today']

const computeTodayBounds = () => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { startOfTodayIso: startOfToday.toISOString(), startOfTomorrowIso: startOfTomorrow.toISOString() }
}

const getCurrentPeriodCount = (completions: HabitCompletion[], habit: Habit): number => {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  if (habit.regularity === 'daily') {
    return completions.find((c) => c.habitId === habit.id && c.date === todayStr)?.count ?? 0
  }
  let periodStart: string
  if (habit.regularity === 'monthly') {
    periodStart = todayStr.slice(0, 7) + '-01'
  } else if (habit.regularity === 'yearly') {
    periodStart = todayStr.slice(0, 4) + '-01-01'
  } else {
    periodStart = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
  }
  return completions
    .filter((c) => c.habitId === habit.id && c.date >= periodStart && c.date <= todayStr)
    .reduce((sum, c) => sum + c.count, 0)
}

export const useHabits = () => {
  const queryClient = useQueryClient()

  const habitsQuery = useQuery({ queryKey: HABITS_KEY, queryFn: () => habitRepository.list() })
  const completionsQuery = useQuery({ queryKey: HABIT_COMPLETIONS_KEY, queryFn: () => habitRepository.listCompletions() })

  const [todayBounds, setTodayBounds] = useState(computeTodayBounds)

  useEffect(() => {
    let lastDay = format(new Date(), 'yyyy-MM-dd')

    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        setTodayBounds(computeTodayBounds())
        const newDay = format(new Date(), 'yyyy-MM-dd')
        if (newDay !== lastDay) {
          lastDay = newDay
          try {
            const habits = await habitRepository.list()
            for (const habit of habits) {
              if (habit.reminder) await checkAndManageNotifications(habit.id)
            }
          } catch {}
        }
      }
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (response.actionIdentifier !== HABIT_COMPLETION_ACTION_ID) return
      const notifId = response.notification.request.identifier
      if (processedNotificationIds.has(notifId)) return
      processedNotificationIds.add(notifId)
      setTimeout(() => processedNotificationIds.delete(notifId), 10_000)
      const habitId = response.notification.request.content.data?.habitId as string | undefined
      if (!habitId) return
      try {
        const habit = await habitRepository.getById(habitId)
        if (!habit) return
        const today = format(new Date(), 'yyyy-MM-dd')
        if (habit.timesPerDay > 1) {
          await habitRepository.addOccurrence(habitId, new Date().toISOString(), 'notification')
        } else {
          await habitRepository.setCompletionCount(habitId, today, 1)
        }
        invalidateAll()
        void checkAndManageNotifications(habitId)
      } catch {}
    })
    return () => subscription.remove()
  }, [])

  const occurrencesQuery = useQuery({
    queryKey: [...HABIT_OCCURRENCES_TODAY_KEY, todayBounds.startOfTodayIso, todayBounds.startOfTomorrowIso],
    queryFn: () => habitRepository.listOccurrencesBetween(todayBounds.startOfTodayIso, todayBounds.startOfTomorrowIso),
  })

  const completionsByHabitId = useMemo(() => {
    const map = new Map<string, HabitCompletion[]>()
    for (const completion of completionsQuery.data ?? []) {
      const existing = map.get(completion.habitId) ?? []
      existing.push(completion)
      map.set(completion.habitId, existing)
    }
    return map
  }, [completionsQuery.data])

  const occurrencesByHabitId = useMemo(() => {
    const map = new Map<string, HabitOccurrence[]>()
    for (const occurrence of occurrencesQuery.data ?? []) {
      const existing = map.get(occurrence.habitId) ?? []
      existing.push(occurrence)
      map.set(occurrence.habitId, existing)
    }
    return map
  }, [occurrencesQuery.data])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: HABITS_KEY })
    queryClient.invalidateQueries({ queryKey: HABIT_COMPLETIONS_KEY })
    queryClient.invalidateQueries({ queryKey: HABIT_OCCURRENCES_TODAY_KEY })
  }

  const checkAndManageNotifications = async (habitId: string) => {
    try {
      const habit = await habitRepository.getById(habitId)
      if (!habit?.reminder) return
      const allCompletions = await habitRepository.listCompletions()
      const periodCount = getCurrentPeriodCount(allCompletions, habit)
      const periodMet = periodCount >= Math.max(1, habit.timesPerDay)
      if (periodMet && habit.notificationIds && habit.notificationIds.length > 0) {
        await cancelHabitReminders(habit)
        await habitRepository.save({ ...habit, notificationIds: [] })
        queryClient.invalidateQueries({ queryKey: HABITS_KEY })
      } else if (!periodMet && habit.reminder && (!habit.notificationIds || habit.notificationIds.length === 0)) {
        const notificationIds = await scheduleHabitReminders(habit)
        if (notificationIds.length > 0) {
          await habitRepository.save({ ...habit, notificationIds })
          queryClient.invalidateQueries({ queryKey: HABITS_KEY })
        }
      }
    } catch {}
  }

  const createMutation = useMutation({
    mutationFn: async (input: NewHabitInput) => {
      const habit = Habit.create(input)
      await habitRepository.save(habit)
      const notificationIds = await scheduleHabitReminders(habit)
      if (notificationIds.length > 0) {
        await habitRepository.save({ ...habit, notificationIds })
      }
      return habit
    },
    onSuccess: invalidateAll,
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: HabitPatch }) => {
      const current = await habitRepository.getById(input.id)
      if (!current) throw new Error('No se encontró el hábito para actualizar.')
      let next = Habit.update(current, input.patch)
      await cancelHabitReminders(current)
      const notificationIds = await scheduleHabitReminders(next)
      next = { ...next, notificationIds }
      return habitRepository.save(next)
    },
    onSuccess: invalidateAll,
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = await habitRepository.getById(id)
      if (current) await cancelHabitReminders(current)
      await habitRepository.remove(id)
    },
    onSuccess: invalidateAll,
  })

  const toggleCompletionMutation = useMutation({
    mutationFn: async ({ habitId, date, completed }: { habitId: string; date: string; completed: boolean }) => {
      if (completed) {
        await habitRepository.removeCompletion(habitId, date)
      } else {
        await habitRepository.addCompletion(habitId, date)
      }
    },
    onSuccess: (_, variables) => {
      invalidateAll()
      void checkAndManageNotifications(variables.habitId)
    },
  })

  const setCompletionCountMutation = useMutation({
    mutationFn: async ({ habitId, date, count }: { habitId: string; date: string; count: number }) => {
      await habitRepository.setCompletionCount(habitId, date, count)
    },
    onSuccess: (_, variables) => {
      invalidateAll()
      void checkAndManageNotifications(variables.habitId)
    },
  })

  const addOccurrenceMutation = useMutation({
    mutationFn: async ({ habitId, occurredAt, source }: { habitId: string; occurredAt: string; source: 'manual' | 'notification' }) => {
      return habitRepository.addOccurrence(habitId, occurredAt, source)
    },
    onSuccess: (_, variables) => {
      invalidateAll()
      void checkAndManageNotifications(variables.habitId)
    },
  })

  const removeOccurrenceMutation = useMutation({
    mutationFn: async ({ id, habitId }: { id: string; habitId: string }) => {
      await habitRepository.removeOccurrence(id)
      return habitId
    },
    onSuccess: (habitId) => {
      invalidateAll()
      void checkAndManageNotifications(habitId)
    },
  })

  return {
    habits: habitsQuery.data ?? [],
    isLoading: habitsQuery.isLoading || completionsQuery.isLoading,
    completionsByHabitId,
    occurrencesByHabitId,
    createHabit: createMutation.mutateAsync,
    updateHabit: updateMutation.mutateAsync,
    removeHabit: removeMutation.mutateAsync,
    toggleCompletion: toggleCompletionMutation.mutateAsync,
    setCompletionCount: setCompletionCountMutation.mutateAsync,
    addOccurrence: addOccurrenceMutation.mutateAsync,
    removeOccurrence: removeOccurrenceMutation.mutateAsync,
  }
}
