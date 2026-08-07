import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, Flame } from 'lucide-react-native'
import type { Habit } from '../../domain/habits'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import { CategoryGlyph } from '../theme/CategoryGlyph'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

const REGULARITY_LABEL: Record<Habit['regularity'], string> = {
  daily: 'Todos los días',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
}

interface HabitCardProps {
  habit: Habit
  completedToday: boolean
  streak: number
  weekStatus?: boolean[]
  onToggleToday: () => void
  onOpen: () => void
}

export const HabitCard = ({ habit, completedToday, streak, weekStatus, onToggleToday, onOpen }: HabitCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const category = DEFAULT_CATEGORIES.find((cat) => cat.id === habit.categoryId)
  const accentColor = category?.color ?? colors.primary

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <Pressable
        onPress={onToggleToday}
        style={[styles.checkbox, { borderColor: accentColor }, completedToday && { backgroundColor: accentColor }]}
      >
        {completedToday ? <Check size={16} color="#FFFFFF" /> : <CategoryGlyph iconName={category?.icon} size={16} color={accentColor} />}
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>{habit.title}</Text>
        {weekStatus ? (
          <View style={styles.dotsRow}>
            {weekStatus.map((done, index) => (
              <View key={index} style={[styles.dot, { backgroundColor: done ? accentColor : colors.border }]} />
            ))}
          </View>
        ) : (
          <Text style={styles.meta}>{REGULARITY_LABEL[habit.regularity]}</Text>
        )}
      </View>

      <View style={styles.streakBadge}>
        <Flame size={14} color={colors.accent} />
        <Text style={styles.streakText}>{streak}</Text>
      </View>
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    checkbox: {
      width: 32,
      height: 32,
      borderRadius: 10,
      borderWidth: 1.6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1 },
    title: { fontSize: 16, fontWeight: '500', color: colors.text },
    meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    dotsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
    dot: { width: 12, height: 12, borderRadius: 999 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    streakText: { fontSize: 14, fontWeight: '700', color: colors.text },
  })
