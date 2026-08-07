import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { format } from 'date-fns'
import { Flame } from 'lucide-react-native'
import { HabitCard } from '../components/HabitCard'
import { useHabits } from '../../application/habits/useHabits'
import { computeStreaks, isCompletedForCurrentPeriod, weekCompletionStatus, type Habit } from '../../domain/habits'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

interface HabitsScreenProps {
  onOpenHabitEditor: (habitId: string) => void
}

export const HabitsScreen = ({ onOpenHabitEditor }: HabitsScreenProps) => {
  const { habits, completionsByHabitId, toggleCompletion } = useHabits()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')

  const filteredHabits = useMemo(() => {
    const query = search.trim().toLowerCase()
    return habits.filter((habit) => {
      if (activeCategory !== 'all' && habit.categoryId !== activeCategory) return false
      if (query && !habit.title.toLowerCase().includes(query)) return false
      return true
    })
  }, [habits, search, activeCategory])

  const handleToggleToday = async (habit: Habit) => {
    const completed = isCompletedForCurrentPeriod(completionsByHabitId.get(habit.id) ?? [], habit.regularity)
    try {
      await toggleCompletion({ habitId: habit.id, date: format(new Date(), 'yyyy-MM-dd'), completed })
    } catch (error) {
      Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
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
          {DEFAULT_CATEGORIES.map((category) => {
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
              return (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  completedToday={isCompletedForCurrentPeriod(completions, habit.regularity)}
                  streak={computeStreaks(completions, habit.regularity).current}
                  weekStatus={habit.regularity === 'daily' ? weekCompletionStatus(completions) : undefined}
                  onToggleToday={() => void handleToggleToday(habit)}
                  onOpen={() => onOpenHabitEditor(habit.id)}
                />
              )
            })}
          </>
        )}
      </ScrollView>
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
