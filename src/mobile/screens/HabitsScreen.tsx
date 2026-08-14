import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { format } from 'date-fns'
import { Flame } from 'lucide-react-native'
import { HabitCard } from '../components/HabitCard'
import { HabitStatsModal } from '../modals/HabitStatsModal'
import { useHabits } from '../../application/habits/useHabits'
import { computeStreaks, getCompletionCountForDate, isCompletedForCurrentPeriod, weekCompletionStatus, type Habit } from '../../domain/habits'
import { HABIT_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

const buildWeekStatusForHabit = (habit: Habit, completions: { date: string; count: number }[]): ReturnType<typeof weekCompletionStatus> => {
  if (habit.timesPerDay <= 1) {
    const completionDates = completions.filter((completion) => completion.count > 0).map((completion) => completion.date)
    return weekCompletionStatus(completionDates)
  }

  const countsByDate = new Map<string, number>()
  for (const completion of completions) {
    const previous = countsByDate.get(completion.date) ?? 0
    countsByDate.set(completion.date, previous + Math.max(0, Math.trunc(Number(completion.count) || 0)))
  }

  const today = new Date()
  const monday = new Date(today)
  const offsetFromMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - offsetFromMonday)

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const date = format(day, 'yyyy-MM-dd')
    const count = countsByDate.get(date) ?? 0
    const done = count >= habit.timesPerDay
    const partial = count > 0 && count < habit.timesPerDay
    return { date, done, partial }
  })
}

interface HabitsScreenProps {
  onOpenHabitEditor: (habitId: string) => void
}

export const HabitsScreen = ({ onOpenHabitEditor }: HabitsScreenProps) => {
  const { habits, completionsByHabitId, occurrencesByHabitId, toggleCompletion, setCompletionCount, addOccurrence, removeOccurrence } = useHabits()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')
  const [statsHabitId, setStatsHabitId] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<{ id: string; occurrenceId: string; time: string } | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastVersionRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  const dismissToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    toastVersionRef.current = null
    setToast(null)
  }

  const showToast = (nextToast: { id: string; occurrenceId: string; time: string }) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    toastVersionRef.current = nextToast.id
    setToast(nextToast)
    toastTimeoutRef.current = setTimeout(() => {
      if (toastVersionRef.current === nextToast.id) {
        dismissToast()
      }
    }, 3200)
  }

  const filteredHabits = useMemo(() => {
    const query = search.trim().toLowerCase()
    return habits.filter((habit) => {
      if (activeCategory !== 'all' && habit.categoryId !== activeCategory) return false
      if (query && !habit.title.toLowerCase().includes(query)) return false
      return true
    })
  }, [habits, search, activeCategory])

  const handleToggleToday = async (habit: Habit) => {
    const today = format(new Date(), 'yyyy-MM-dd')

    if (habit.timesPerDay > 1) {
      try {
        const created = await addOccurrence({
          habitId: habit.id,
          occurredAt: new Date().toISOString(),
          source: 'manual',
        })

        const createdAt = format(new Date(created.occurredAt), 'HH:mm')
        showToast({ id: created.id, occurrenceId: created.id, time: createdAt })
      } catch (error) {
        Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Intentá de nuevo.')
      }
      return
    }

    const todaysCompletions = completionsByHabitId.get(habit.id) ?? []
    const currentCount = getCompletionCountForDate(todaysCompletions, today)
    const nextCount = currentCount > 0 ? 0 : 1

    try {
      await setCompletionCount({ habitId: habit.id, date: today, count: nextCount })
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const handleToggleDay = async (habitId: string, date: string, completed: boolean) => {
    try {
      await toggleCompletion({ habitId, date, completed })
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const statsHabit = habits.find((habit) => habit.id === statsHabitId)

  if (habits.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Flame size={18} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sin hábitos todavía</Text>
        <Text style={styles.emptySubtitle}>Agregá uno con el botón +</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar hábitos o categorías"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <Pressable onPress={() => setActiveCategory('all')} style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>Todos</Text>
          </Pressable>
          {HABIT_CATEGORIES.map((category) => {
            const isCategoryActive = activeCategory === category.id
            const CategoryIcon = resolveCategoryIcon(category.icon)
            return (
              <Pressable
                key={category.id}
                onPress={() => setActiveCategory(category.id)}
                style={[
                  styles.filterChip,
                  { flexDirection: 'row', alignItems: 'center', gap: 6 },
                  isCategoryActive && [styles.filterChipActive, { backgroundColor: category.color, borderColor: category.color }],
                ]}
              >
                <CategoryIcon size={13} color={isCategoryActive ? '#FFFFFF' : colors.textMuted} />
                <Text style={[styles.filterChipText, isCategoryActive && styles.filterChipTextActive]}>{category.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filteredHabits.length === 0 ? (
          <Text style={styles.noResultsText}>No hay hábitos que coincidan.</Text>
        ) : (
          <>
            <Text style={styles.sectionHeader}>Hoy</Text>
            {filteredHabits.map((habit) => {
              const completions = completionsByHabitId.get(habit.id) ?? []
              const completionDates = completions.filter((completion) => completion.count > 0).map((completion) => completion.date)
              const streakDates = completions.filter((completion) => completion.count >= Math.max(1, habit.timesPerDay)).map((completion) => completion.date)
              const todayCount = getCompletionCountForDate(completions, format(new Date(), 'yyyy-MM-dd'))
              const todayOccurrences = (occurrencesByHabitId.get(habit.id) ?? []).filter((occurrence) => {
                const date = format(new Date(occurrence.occurredAt), 'yyyy-MM-dd')
                return date === format(new Date(), 'yyyy-MM-dd')
              })
              const weekStatus = habit.regularity === 'daily' ? buildWeekStatusForHabit(habit, completions) : undefined
              return (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  todayCount={todayCount}
                  completedToday={todayCount >= Math.max(1, habit.timesPerDay)}
                  streak={computeStreaks(streakDates, habit.regularity).current}
                  weekStatus={weekStatus}
                  todayOccurrences={todayOccurrences}
                  onToggleToday={() => void handleToggleToday(habit)}
                  onToggleDay={(date, done) => void handleToggleDay(habit.id, date, done)}
                  onDeleteOccurrence={(occurrenceId) => void removeOccurrence({ id: occurrenceId })}
                  onOpen={() => onOpenHabitEditor(habit.id)}
                  onOpenStats={() => setStatsHabitId(habit.id)}
                />
              )
            })}
          </>
        )}
      </ScrollView>

      {statsHabit && (
        <HabitStatsModal
          open={Boolean(statsHabitId)}
          habit={statsHabit}
          completions={(completionsByHabitId.get(statsHabit.id) ?? []).filter((completion) => completion.count > 0).map((completion) => completion.date)}
          onClose={() => setStatsHabitId(undefined)}
        />
      )}

      {toast && (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>✓ Registrado a las {toast.time}</Text>
            <Pressable
              onPress={() => {
                const occurrenceId = toast.occurrenceId
                dismissToast()
                void removeOccurrence({ id: occurrenceId })
              }}
              hitSlop={8}
            >
              <Text style={styles.toastActionText}>Deshacer</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 10 },
    content: { paddingBottom: 32 },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 12,
      color: colors.text,
      fontSize: 16,
    },
    filtersWrapper: { marginBottom: 4, paddingVertical: 4 },
    filtersRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 12 },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      minHeight: 36,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 0,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textSecondary },
    filterChipTextActive: { color: '#FFFFFF', fontWeight: '800' },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginTop: 6,
      marginBottom: 4,
      marginLeft: 2,
    },
    noResultsText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 40 },
    toastWrap: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      alignItems: 'center',
      pointerEvents: 'box-none',
    },
    toastBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      maxWidth: '100%',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    toastText: { color: colors.text, fontSize: 13, fontWeight: '700' },
    toastActionText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 72,
      paddingHorizontal: 28,
      backgroundColor: colors.background,
    },
    emptyIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
    emptySubtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 4, textAlign: 'center' },
  })
