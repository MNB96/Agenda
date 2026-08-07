import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { habitRepository } from '../../app/container'
import { Habit, type HabitPatch, type NewHabitInput } from '../../domain/habits'
import { cancelHabitReminders, scheduleHabitReminders } from '../../infrastructure/notifications/habitNotifications'

const HABITS_KEY = ['habits']
const HABIT_COMPLETIONS_KEY = ['habit-completions']

export const useHabits = () => {
  const queryClient = useQueryClient()

  const habitsQuery = useQuery({ queryKey: HABITS_KEY, queryFn: () => habitRepository.list() })
  const completionsQuery = useQuery({ queryKey: HABIT_COMPLETIONS_KEY, queryFn: () => habitRepository.listCompletions() })

  const completionsByHabitId = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const completion of completionsQuery.data ?? []) {
      const existing = map.get(completion.habitId) ?? []
      existing.push(completion.date)
      map.set(completion.habitId, existing)
    }
    return map
  }, [completionsQuery.data])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: HABITS_KEY })
    queryClient.invalidateQueries({ queryKey: HABIT_COMPLETIONS_KEY })
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

  // `completed` comes from the caller's own render, not read back here — avoids acting on a
  // stale closure of completionsByHabitId if this fires right after another toggle.
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

  return {
    habits: habitsQuery.data ?? [],
    completionsByHabitId,
    isLoading: habitsQuery.isLoading || completionsQuery.isLoading,
    createHabit: createMutation.mutateAsync,
    updateHabit: updateMutation.mutateAsync,
    removeHabit: removeMutation.mutateAsync,
    toggleCompletion: toggleCompletionMutation.mutateAsync,
  }
}
