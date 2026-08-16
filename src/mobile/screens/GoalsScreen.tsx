import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { differenceInCalendarDays } from 'date-fns'
import { Target } from 'lucide-react-native'
import { SwipeableItemCard } from '../components/SwipeableItemCard'
import { useItems } from '../../application/items/useItems'
import { ITEM_TYPE, type Item } from '../../domain/items'
import { isGoalPastDeadlineUnfulfilled } from '../../domain/items/services/goalDeadline'
import { GOAL_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

interface GoalsScreenProps {
  onOpenGoalEditor: (itemId: string) => void
}

const formatOverdueDays = (deadline: string): string => {
  const days = differenceInCalendarDays(new Date(), new Date(`${deadline}T00:00:00`))
  if (days <= 0) return 'Venció hoy'
  return days === 1 ? 'Venció hace 1 día' : `Venció hace ${days} días`
}

export const GoalsScreen = ({ onOpenGoalEditor }: GoalsScreenProps) => {
  const { items, toggleCompleted, removeItem } = useItems()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')
  const [undoGoal, setUndoGoal] = useState<Item | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    }
  }, [])

  const { overdueGoals, activeGoals, completedGoals } = useMemo(() => {
    const query = search.trim().toLowerCase()
    // Submetas no van en el listado principal — solo cuentan para el progreso de su meta padre.
    const goals = items.filter((item) => {
      if (item.type !== ITEM_TYPE.GOAL || item.parentId) return false
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (!query) return true
      return [item.title, item.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
    })
    const active = goals
      .filter((goal) => goal.status === 'active')
      .sort((goalA, goalB) => (goalA.deadline ?? 'zzz').localeCompare(goalB.deadline ?? 'zzz'))
    const overdue = active.filter((goal) => isGoalPastDeadlineUnfulfilled(goal))
    const notOverdue = active.filter((goal) => !isGoalPastDeadlineUnfulfilled(goal))
    const completed = goals
      .filter((goal) => goal.status === 'completed')
      .sort((goalA, goalB) => (goalB.completedAt ?? '').localeCompare(goalA.completedAt ?? ''))
    return { overdueGoals: overdue, activeGoals: notOverdue, completedGoals: completed }
  }, [items, search, activeCategory])

  const subgoalsByParent = useMemo(() => {
    const map = new Map<string, Item[]>()
    items.filter((item) => item.parentId).forEach((sub) => {
      const existing = map.get(sub.parentId!) ?? []
      existing.push(sub)
      map.set(sub.parentId!, existing)
    })
    return map
  }, [items])

  const handleToggle = async (item: Parameters<typeof toggleCompleted>[0]) => {
    try {
      await toggleCompleted(item)
      if (item.status !== 'completed') {
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
        setUndoGoal(item)
        undoTimeoutRef.current = setTimeout(() => setUndoGoal(null), 4000)
      }
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const handleUndoGoal = async () => {
    if (!undoGoal) return
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
    setUndoGoal(null)
    try {
      await toggleCompleted(undoGoal)
    } catch (error) {
      Alert.alert('No se pudo deshacer', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const handleDelete = async (item: Parameters<typeof removeItem>[0]) => {
    try {
      await removeItem(item)
    } catch (error) {
      Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  const hasAnyGoals = items.some((item) => item.type === ITEM_TYPE.GOAL && !item.parentId)
  const isEmptyResult = overdueGoals.length === 0 && activeGoals.length === 0 && completedGoals.length === 0

  const filters = (
    <>
      <TextInput
        placeholder="Buscar metas o categorías"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <Pressable onPress={() => setActiveCategory('all')} style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, activeCategory === 'all' && styles.filterChipTextActive]}>Todas</Text>
          </Pressable>
          {GOAL_CATEGORIES.map((category) => {
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
    </>
  )

  if (!hasAnyGoals) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Target size={18} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sin metas todavía</Text>
        <Text style={styles.emptySubtitle}>Agregá una con el botón +</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        {filters}
        <ScrollView contentContainerStyle={styles.content}>
          {isEmptyResult ? (
            <Text style={styles.noResultsText}>No hay metas que coincidan.</Text>
          ) : (
            <>
              {overdueGoals.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: colors.danger }]}>Vencidas</Text>
                  {overdueGoals.map((goal) => (
                    <SwipeableItemCard
                      key={goal.id}
                      item={goal}
                      overdueDeadlineLabel={goal.deadline ? formatOverdueDays(goal.deadline) : undefined}
                      subtasks={subgoalsByParent.get(goal.id)}
                      onToggle={handleToggle}
                      onToggleSubtask={handleToggle}
                      onOpen={() => onOpenGoalEditor(goal.id)}
                      onDelete={handleDelete}
                      deleteConfirmTitle="Eliminar meta"
                      deleteConfirmMessage="¿Eliminar esta meta?"
                    />
                  ))}
                </>
              )}

              {activeGoals.length > 0 && (
                <>
                  {overdueGoals.length > 0 && <Text style={styles.sectionHeader}>Activas</Text>}
                  {activeGoals.map((goal) => (
                    <SwipeableItemCard
                      key={goal.id}
                      item={goal}
                      subtasks={subgoalsByParent.get(goal.id)}
                      onToggle={handleToggle}
                      onToggleSubtask={handleToggle}
                      onOpen={() => onOpenGoalEditor(goal.id)}
                      onDelete={handleDelete}
                      deleteConfirmTitle="Eliminar meta"
                      deleteConfirmMessage="¿Eliminar esta meta?"
                    />
                  ))}
                </>
              )}

              {completedGoals.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Cumplidas</Text>
                  {completedGoals.map((goal) => (
                    <SwipeableItemCard
                      key={goal.id}
                      item={goal}
                      onToggle={handleToggle}
                      onOpen={() => onOpenGoalEditor(goal.id)}
                      onDelete={handleDelete}
                      deleteConfirmTitle="Eliminar meta"
                      deleteConfirmMessage="¿Eliminar esta meta?"
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
      {undoGoal && (
        <Pressable style={styles.undoToast} onPress={() => void handleUndoGoal()}>
          <Text style={styles.undoToastText}>Meta completada</Text>
          <Text style={styles.undoToastAction}>Deshacer</Text>
        </Pressable>
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
      marginTop: 16,
      marginBottom: 4,
      marginLeft: 2,
    },
    noResultsText: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 40,
    },
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
    undoToast: {
      position: 'absolute',
      bottom: 96,
      left: 16,
      right: 16,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    undoToastText: { fontSize: 14, color: colors.text, fontWeight: '500' },
    undoToastAction: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  })
