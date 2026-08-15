import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { format, startOfISOWeek } from 'date-fns'
import { Flame, X } from 'lucide-react-native'
import { HabitCard } from '../components/HabitCard'
import { HabitStatsModal } from '../modals/HabitStatsModal'
import { useHabits } from '../../application/habits/useHabits'
import { HABIT_OCCURRENCE_SOURCE, computeStreaks, getCompletionCountForDate, weekCompletionStatus, type Habit } from '../../domain/habits'
import { HABIT_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

const TODAY = () => format(new Date(), 'yyyy-MM-dd')

const getStreakDates = (completions: { date: string; count: number }[], habit: Habit): string[] => {
  if (habit.regularity === 'daily') {
    return completions
      .filter((c) => c.count >= Math.max(1, habit.timesPerDay))
      .map((c) => c.date)
  }

  const toPeriodKey = (date: string): string => {
    if (habit.regularity === 'monthly') return date.slice(0, 7)
    if (habit.regularity === 'yearly') return date.slice(0, 4)
    return format(startOfISOWeek(new Date(`${date}T00:00:00`)), 'yyyy-MM-dd')
  }

  const periodTotals = new Map<string, { repDate: string; total: number }>()
  for (const c of completions) {
    if (c.count <= 0) continue
    const key = toPeriodKey(c.date)
    const prev = periodTotals.get(key) ?? { repDate: c.date, total: 0 }
    periodTotals.set(key, { repDate: prev.repDate, total: prev.total + c.count })
  }

  return [...periodTotals.values()]
    .filter(({ total }) => total >= Math.max(1, habit.timesPerDay))
    .map(({ repDate }) => repDate)
}

const getPeriodCount = (completions: { date: string; count: number }[], regularity: Habit['regularity']): number => {
  const today = TODAY()
  if (regularity === 'monthly') {
    return completions
      .filter((c) => c.date.slice(0, 7) === today.slice(0, 7))
      .reduce((sum, c) => sum + c.count, 0)
  }
  if (regularity === 'yearly') {
    return completions
      .filter((c) => c.date.slice(0, 4) === today.slice(0, 4))
      .reduce((sum, c) => sum + c.count, 0)
  }
  const mondayStr = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
  return completions
    .filter((c) => c.date >= mondayStr && c.date <= today)
    .reduce((sum, c) => sum + c.count, 0)
}

const PERIOD_LABEL: Record<Habit['regularity'], string> = {
  daily: 'hoy',
  weekly: 'esta semana',
  monthly: 'este mes',
  yearly: 'este año',
}

const SECTION_LABEL: Record<Habit['regularity'], string> = {
  daily: 'Hoy',
  weekly: 'Esta semana',
  monthly: 'Este mes',
  yearly: 'Este año',
}

const REGULARITY_ORDER: Habit['regularity'][] = ['daily', 'weekly', 'monthly', 'yearly']

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

  const monday = startOfISOWeek(new Date())

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
  const { habits, isLoading, completionsByHabitId, occurrencesByHabitId, toggleCompletion, setCompletionCount, addOccurrence, removeOccurrence } = useHabits()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')
  const [statsHabitId, setStatsHabitId] = useState<string | undefined>(undefined)
  const [toast, setToast] = useState<{ id: string; message: string; undo: () => Promise<void> } | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastVersionRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
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

  const showToast = (nextToast: { id: string; message: string; undo: () => Promise<void> }) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastVersionRef.current = nextToast.id
    setToast(nextToast)
    toastTimeoutRef.current = setTimeout(() => {
      if (toastVersionRef.current === nextToast.id) dismissToast()
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

  const usedCategoryIds = useMemo(() => {
    const ids = new Set<string>()
    for (const habit of habits) {
      if (habit.categoryId) ids.add(habit.categoryId)
    }
    return ids
  }, [habits])

  const habitsByRegularity = useMemo(() => {
    const groups = new Map<Habit['regularity'], Habit[]>()
    for (const habit of filteredHabits) {
      const list = groups.get(habit.regularity) ?? []
      list.push(habit)
      groups.set(habit.regularity, list)
    }
    return REGULARITY_ORDER.filter((r) => groups.has(r)).map((r) => ({ regularity: r, label: SECTION_LABEL[r], habits: groups.get(r)! }))
  }, [filteredHabits])

  const handleToggleToday = async (habit: Habit) => {
    const today = TODAY()

    if (habit.timesPerDay > 1) {
      try {
        const created = await addOccurrence({
          habitId: habit.id,
          occurredAt: new Date().toISOString(),
          source: HABIT_OCCURRENCE_SOURCE.MANUAL,
        })
        showToast({
          id: created.id,
          message: `✓ ${habit.title} · ${format(new Date(created.occurredAt), 'HH:mm')}`,
          undo: async () => { await removeOccurrence({ id: created.id, habitId: habit.id }) },
        })
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
    if (date > TODAY()) {
      Alert.alert('Fecha futura', 'No podés registrar hábitos en fechas futuras.')
      return
    }

    if (completed) {
      const habit = habits.find((h) => h.id === habitId)
      if (habit && habit.timesPerDay > 1) {
        const completions = completionsByHabitId.get(habitId) ?? []
        const dayCount = getCompletionCountForDate(completions, date)
        if (dayCount > 1) {
          Alert.alert(
            'Eliminar registros',
            `Se eliminarán los ${dayCount} registros de ese día. ¿Confirmar?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await toggleCompletion({ habitId, date, completed })
                  } catch (error) {
                    Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                  }
                },
              },
            ],
          )
          return
        }
      }
    }

    try {
      await toggleCompletion({ habitId, date, completed })
      if (completed) {
        showToast({
          id: `${habitId}-${date}`,
          message: 'Día desmarcado',
          undo: async () => { await toggleCompletion({ habitId, date, completed: false }) },
        })
      }
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const renderHabitCard = (habit: Habit) => {
    const completions = completionsByHabitId.get(habit.id) ?? []
    const changeDate = habit.regularityChangedAt?.slice(0, 10)
    const completionsForStreak = changeDate ? completions.filter((c) => c.date >= changeDate) : completions
    const streakDates = getStreakDates(completionsForStreak, habit)
    const todayCount = getCompletionCountForDate(completions, TODAY())
    const periodCount = habit.regularity === 'daily' ? todayCount : getPeriodCount(completions, habit.regularity)
    const todayOccurrences = occurrencesByHabitId.get(habit.id) ?? []
    const weekStatus = habit.regularity === 'daily' ? buildWeekStatusForHabit(habit, completions) : undefined
    const periodSummary = habit.regularity !== 'daily'
      ? { count: periodCount, label: PERIOD_LABEL[habit.regularity] }
      : undefined
    return (
      <HabitCard
        key={habit.id}
        habit={habit}
        todayCount={todayCount}
        periodSummary={periodSummary}
        streak={computeStreaks(streakDates, habit.regularity).current}
        weekStatus={weekStatus}
        todayOccurrences={todayOccurrences}
        onToggleToday={() => void handleToggleToday(habit)}
        onToggleDay={(date, done) => void handleToggleDay(habit.id, date, done)}
        onDeleteOccurrence={async (occurrenceId) => {
          const occurrence = todayOccurrences.find((o) => o.id === occurrenceId)
          try {
            await removeOccurrence({ id: occurrenceId, habitId: habit.id })
            if (occurrence) {
              showToast({
                id: occurrenceId,
                message: `✕ ${habit.title} · ${format(new Date(occurrence.occurredAt), 'HH:mm')}`,
                undo: async () => { await addOccurrence({ habitId: habit.id, occurredAt: occurrence.occurredAt, source: HABIT_OCCURRENCE_SOURCE.MANUAL }) },
              })
            }
          } catch {
            Alert.alert('No se pudo eliminar', 'Intentá de nuevo.')
          }
        }}
        onOpen={() => onOpenHabitEditor(habit.id)}
        onOpenStats={() => setStatsHabitId(habit.id)}
      />
    )
  }

  const statsHabit = habits.find((habit) => habit.id === statsHabitId)

  if (isLoading) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

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
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar hábitos"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { flex: 1 }]}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8} style={styles.searchClear} accessibilityLabel="Limpiar búsqueda">
            <X size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <Pressable onPress={() => setActiveCategory('all')} style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>Todos</Text>
          </Pressable>
          {HABIT_CATEGORIES.filter((cat) => usedCategoryIds.has(cat.id)).map((category) => {
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
          <Text style={styles.noResultsText}>
            {search.trim()
              ? `Sin resultados para "${search.trim()}".`
              : activeCategory !== 'all'
              ? 'No hay hábitos en esta categoría.'
              : 'No hay hábitos que coincidan.'}
          </Text>
        ) : (
          habitsByRegularity.map(({ regularity, label, habits: group }) => {
            const doneCount = group.filter((habit) => {
              const completions = completionsByHabitId.get(habit.id) ?? []
              const count = habit.regularity === 'daily'
                ? getCompletionCountForDate(completions, TODAY())
                : getPeriodCount(completions, habit.regularity)
              return count >= habit.timesPerDay
            }).length
            return (
              <View key={regularity}>
                <Text style={styles.sectionHeader}>{label} · {doneCount}/{group.length}</Text>
                {group.map(renderHabitCard)}
              </View>
            )
          })
        )}
      </ScrollView>

      {statsHabit && (() => {
        const allCompletions = completionsByHabitId.get(statsHabit.id) ?? []
        const changeDate = statsHabit.regularityChangedAt?.slice(0, 10)
        const completionsForStats = changeDate ? allCompletions.filter((c) => c.date >= changeDate) : allCompletions
        const historicalCompletions = changeDate ? allCompletions.filter((c) => c.date < changeDate) : []
        return (
          <HabitStatsModal
            open={Boolean(statsHabitId)}
            habit={statsHabit}
            completions={getStreakDates(completionsForStats, statsHabit)}
            historicalCompletions={historicalCompletions.length > 0 ? historicalCompletions : undefined}
            onClose={() => setStatsHabitId(undefined)}
          />
        )
      })()}

      {toast && (
        <View style={styles.toastWrap} pointerEvents="box-none">
          <View style={styles.toastBox}>
            <Text style={styles.toastText}>{toast.message}</Text>
            <Pressable
              onPress={async () => {
                const { undo } = toast
                dismissToast()
                try {
                  await undo()
                } catch {
                  Alert.alert('No se pudo deshacer', 'El registro no pudo revertirse.')
                }
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
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    searchInput: {
      paddingVertical: 11,
      color: colors.text,
      fontSize: 16,
    },
    searchClear: { padding: 4 },
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
      marginTop: 10,
      marginBottom: 4,
      marginLeft: 2,
    },
    noResultsText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 40 },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
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
