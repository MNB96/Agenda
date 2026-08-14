import { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { differenceInCalendarWeeks, parseISO } from 'date-fns'
import { X } from 'lucide-react-native'
import { HABIT_REGULARITY, computeStreaks, type Habit } from '../../domain/habits'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface HabitStatsModalProps {
  open: boolean
  habit: Habit
  completions: string[]
  onClose: () => void
}

const daysLabel = (count: number): string => `${count} ${count === 1 ? 'día' : 'días'}`

// Only a meaningful denominator for daily habits, so others just show the raw weekly average.
const weeklyAverageLabel = (totalCompletions: number, createdAt: string, regularity: Habit['regularity']): string => {
  const weeksSinceCreated = Math.max(1, differenceInCalendarWeeks(new Date(), parseISO(createdAt), { weekStartsOn: 1 }) + 1)
  const average = totalCompletions / weeksSinceCreated
  return regularity === HABIT_REGULARITY.DAILY ? `${average.toFixed(1)}/7 días` : `${average.toFixed(1)} por semana`
}

export const HabitStatsModal = ({ open, habit, completions, onClose }: HabitStatsModalProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const streaks = computeStreaks(completions, habit.regularity)
  const targetLabel = `${habit.timesPerDay} ${habit.timesPerDay === 1 ? 'vez' : 'veces'} al día`

  return (
    <Modal visible={open} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]} onPress={onClose} />
      <View style={styles.sheetAnchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.dragHandle} />
          <View style={styles.header}>
            <Text style={styles.title}>Estadísticas</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Meta diaria</Text>
            <Text style={styles.metaValue}>{targetLabel}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Racha actual</Text>
              <Text style={styles.statValue}>{daysLabel(streaks.current)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Mejor racha</Text>
              <Text style={styles.statValue}>{daysLabel(streaks.best)}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Totales</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Completados</Text>
              <Text style={styles.statValue}>{daysLabel(completions.length)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Promedio semanal</Text>
              <Text style={styles.statValue}>{weeklyAverageLabel(completions.length, habit.createdAt, habit.regularity)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    sheetAnchor: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    metaBox: {
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginTop: 10,
      marginBottom: 4,
    },
    metaLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    metaValue: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 4 },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 18,
      marginBottom: 10,
    },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
    statBox: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    statLabel: { fontSize: 12, color: colors.textMuted },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
  })
