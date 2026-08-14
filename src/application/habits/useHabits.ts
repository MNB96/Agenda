import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitRepository } from '../../app/container'
import { Habit, type HabitCompletion, type HabitPatch, type NewHabitInput } from '../../domain/habits'
import { cancelHabitReminders, scheduleHabitReminders } from '../../infrastructure/notifications/habitNotifications'

const HABITS_KEY = ['habits']
const HABIT_COMPLETIONS_KEY = ['habit-completions']
const HABIT_OCCURRENCES_TODAY_KEY = ['habit-occurrences-today']

export const useHabits = () => {
  const queryClient = useQueryClient()

  const habitsQuery = useQuery({ queryKey: HABITS_KEY, queryFn: () => habitRepository.list() })
  const completionsQuery = useQuery({ queryKey: HABIT_COMPLETIONS_KEY, queryFn: () => habitRepository.listCompletions() })

  // Memoize date calculations to avoid query key changes on every render
  const { startOfTodayIso, startOfTomorrowIso } = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    return { startOfTodayIso: startOfToday.toISOString(), startOfTomorrowIso: startOfTomorrow.toISOString() }
  }, [])

  const occurrencesQuery = useQuery({
    queryKey: [...HABIT_OCCURRENCES_TODAY_KEY, startOfTodayIso, startOfTomorrowIso],
    queryFn: () => habitRepository.listOccurrencesBetween(startOfTodayIso, startOfTomorrowIso),
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
    const map = new Map<string, ReturnType<typeof habitRepository.listOccurrences> extends Promise<infer T> ? T : never>()
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

  const createMutation = useMutation({
    mutationFn: async (input: NewHabitInput) => {
      let habit = Habit.create(input)
      const notificationIds = await scheduleHabitReminders(habit)
      habit = { ...habit, notificationIds }
      return habitRepository.save(habit)
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
    onSuccess: invalidateAll,
  })

  const setCompletionCountMutation = useMutation({
    mutationFn: async ({ habitId, date, count }: { habitId: string; date: string; count: number }) => {
      await habitRepository.setCompletionCount(habitId, date, count)
    },
    onSuccess: invalidateAll,
  })

  const addOccurrenceMutation = useMutation({
    mutationFn: async ({ habitId, occurredAt, source }: { habitId: string; occurredAt: string; source: 'manual' | 'notification' }) => {
      return habitRepository.addOccurrence(habitId, occurredAt, source)
    },
    onSuccess: invalidateAll,
  })

  const removeOccurrenceMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await habitRepository.removeOccurrence(id)
    },
    onSuccess: invalidateAll,
  })

  const updateOccurrenceTimeMutation = useMutation({
    mutationFn: async ({ id, occurredAt }: { id: string; occurredAt: string }) => {
      return habitRepository.updateOccurrenceTime(id, occurredAt)
    },
    onSuccess: invalidateAll,
  })

  return {
    habits: habitsQuery.data ?? [],
    completionsByHabitId,
    occurrencesByHabitId,
    isLoading: habitsQuery.isLoading || completionsQuery.isLoading || occurrencesQuery.isLoading,
    createHabit: createMutation.mutateAsync,
    updateHabit: updateMutation.mutateAsync,
    removeHabit: removeMutation.mutateAsync,
    toggleCompletion: toggleCompletionMutation.mutateAsync,
    setCompletionCount: setCompletionCountMutation.mutateAsync,
    addOccurrence: addOccurrenceMutation.mutateAsync,
    removeOccurrence: removeOccurrenceMutation.mutateAsync,
    updateOccurrenceTime: updateOccurrenceTimeMutation.mutateAsync,
  }
}
