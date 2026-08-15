import { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears, format, parseISO } from 'date-fns'
import { X } from 'lucide-react-native'
import { computeStreaks, type Habit } from '../../domain/habits'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface HabitStatsModalProps {
  open: boolean
  habit: Habit
  completions: string[]
  historicalCompletions?: { date: string; count: number }[]
  onClose: () => void
}

const PERIOD_LABEL: Record<Habit['regularity'], string> = {
  daily: 'por día',
  weekly: 'por semana',
  monthly: 'por mes',
  yearly: 'por año',
}

const activeForLabel = (createdAt: string): string => {
  const years = differenceInCalendarYears(new Date(), parseISO(createdAt))
  if (years >= 1) return `${years} ${years === 1 ? 'año' : 'años'}`
  const months = Math.max(1, differenceInCalendarMonths(new Date(), parseISO(createdAt)) + 1)
  return `${months} ${months === 1 ? 'mes' : 'meses'}`
}

const periodLabel = (count: number, regularity: Habit['regularity']): string => {
  switch (regularity) {
    case 'daily': return `${count} ${count === 1 ? 'día' : 'días'}`
    case 'weekly': return `${count} ${count === 1 ? 'semana' : 'semanas'}`
    case 'monthly': return `${count} ${count === 1 ? 'mes' : 'meses'}`
    case 'yearly': return `${count} ${count === 1 ? 'año' : 'años'}`
  }
}

const periodAverageLabel = (totalCompletions: number, createdAt: string, regularity: Exclude<Habit['regularity'], 'yearly'>): string => {
  switch (regularity) {
    case 'daily': {
      const weeks = Math.max(1, differenceInCalendarWeeks(new Date(), parseISO(createdAt), { weekStartsOn: 1 }) + 1)
      return `${(totalCompletions / weeks).toFixed(1)} días/sem.`
    }
    case 'weekly': {
      const months = Math.max(1, differenceInCalendarMonths(new Date(), parseISO(createdAt)) + 1)
      return `${(totalCompletions / months).toFixed(1)} por mes`
    }
    case 'monthly': {
      const years = Math.max(1, differenceInCalendarYears(new Date(), parseISO(createdAt)) + 1)
      return `${(totalCompletions / years).toFixed(1)} por año`
    }
  }
}

export const HabitStatsModal = ({ open, habit, completions, historicalCompletions, onClose }: HabitStatsModalProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const streaks = computeStreaks(completions, habit.regularity)

  return (
    <Modal visible={open} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]} onPress={onClose} />
      <View style={styles.sheetAnchor} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]} onStartShouldSetResponder={() => true}>
          <View style={styles.dragHandle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Estadísticas</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{habit.title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {completions.length === 0 ? (
            <Text style={styles.emptyText}>{`Todavía no completaste ningún período completo. Para sumar estadísticas necesitás registrar ${habit.timesPerDay} ${habit.timesPerDay === 1 ? 'vez' : 'veces'} ${PERIOD_LABEL[habit.regularity]}.`}</Text>
          ) : (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Racha actual</Text>
                  <Text style={styles.statValue}>{periodLabel(streaks.current, habit.regularity)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Mejor racha</Text>
                  <Text style={styles.statValue}>{periodLabel(streaks.best, habit.regularity)}</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Totales</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Períodos completados</Text>
                  <Text style={styles.statValue}>{periodLabel(completions.length, habit.regularity)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>{habit.regularity === 'daily' ? 'Promedio semanal' : habit.regularity === 'weekly' ? 'Promedio mensual' : habit.regularity === 'monthly' ? 'Promedio anual' : 'Activo desde'}</Text>
                  <Text style={styles.statValue}>{habit.regularity === 'yearly' ? activeForLabel(habit.createdAt) : periodAverageLabel(completions.length, habit.createdAt, habit.regularity)}</Text>
                </View>
              </View>
            </>
          )}

          {historicalCompletions && historicalCompletions.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Historial anterior</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Días registrados</Text>
                  <Text style={styles.statValue}>{historicalCompletions.filter((c) => c.count > 0).length}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Período</Text>
                  <Text style={[styles.statValue, { fontSize: 14 }]} numberOfLines={1}>
                    {`${format(parseISO(historicalCompletions[0].date), 'd/M/yy')} – ${format(parseISO(historicalCompletions[historicalCompletions.length - 1].date), 'd/M/yy')}`}
                  </Text>
                </View>
              </View>
            </>
          )}
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
    headerText: { flex: 1, marginRight: 12 },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
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
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 28, marginBottom: 12, lineHeight: 20 },
  })
