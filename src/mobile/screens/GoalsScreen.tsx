import { useMemo } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { differenceInCalendarDays } from 'date-fns'
import { Target } from 'lucide-react-native'
import { ItemCard } from '../components/ItemCard'
import { useItems } from '../../application/items/useItems'
import { ITEM_TYPE } from '../../domain/items'
import { isGoalPastDeadlineUnfulfilled } from '../../domain/items/services/goalDeadline'
import { useAppTheme } from '../theme/useAppTheme'
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
  const { items, toggleCompleted } = useItems()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const { overdueGoals, activeGoals, completedGoals } = useMemo(() => {
    // Submetas no van en el listado principal — solo cuentan para el progreso de su meta padre.
    const goals = items.filter((item) => item.type === ITEM_TYPE.GOAL && !item.parentId)
    const active = goals
      .filter((goal) => goal.status === 'active')
      .sort((goalA, goalB) => (goalA.deadline ?? 'zzz').localeCompare(goalB.deadline ?? 'zzz'))
    const overdue = active.filter((goal) => isGoalPastDeadlineUnfulfilled(goal))
    const notOverdue = active.filter((goal) => !isGoalPastDeadlineUnfulfilled(goal))
    const completed = goals
      .filter((goal) => goal.status === 'completed')
      .sort((goalA, goalB) => (goalB.completedAt ?? '').localeCompare(goalA.completedAt ?? ''))
    return { overdueGoals: overdue, activeGoals: notOverdue, completedGoals: completed }
  }, [items])

  const subgoalMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    items.filter((item) => item.parentId).forEach((sub) => {
      const existing = map.get(sub.parentId!) ?? { total: 0, done: 0 }
      map.set(sub.parentId!, {
        total: existing.total + 1,
        done: existing.done + (sub.status === 'completed' ? 1 : 0),
      })
    })
    return map
  }, [items])

  const handleToggle = async (item: Parameters<typeof toggleCompleted>[0]) => {
    try {
      await toggleCompleted(item)
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
    }
  }

  if (overdueGoals.length === 0 && activeGoals.length === 0 && completedGoals.length === 0) {
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {overdueGoals.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.danger }]}>Vencidas</Text>
          {overdueGoals.map((goal) => (
            <ItemCard
              key={goal.id}
              item={goal}
              overdueDeadlineLabel={goal.deadline ? formatOverdueDays(goal.deadline) : undefined}
              subtaskTotal={subgoalMap.get(goal.id)?.total}
              subtaskDone={subgoalMap.get(goal.id)?.done}
              onToggle={handleToggle}
              onOpen={() => onOpenGoalEditor(goal.id)}
            />
          ))}
        </>
      )}

      {activeGoals.length > 0 && (
        <>
          {overdueGoals.length > 0 && <Text style={styles.sectionHeader}>Activas</Text>}
          {activeGoals.map((goal) => (
            <ItemCard
              key={goal.id}
              item={goal}
              subtaskTotal={subgoalMap.get(goal.id)?.total}
              subtaskDone={subgoalMap.get(goal.id)?.done}
              onToggle={handleToggle}
              onOpen={() => onOpenGoalEditor(goal.id)}
            />
          ))}
        </>
      )}

      {completedGoals.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Cumplidas</Text>
          {completedGoals.map((goal) => (
            <ItemCard key={goal.id} item={goal} onToggle={handleToggle} onOpen={() => onOpenGoalEditor(goal.id)} />
          ))}
        </>
      )}
    </ScrollView>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 10 },
    content: { paddingBottom: 32 },
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
