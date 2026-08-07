import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BarChart3, ChevronDown, ChevronUp, Flame } from 'lucide-react-native'
import type { Habit, WeekDayStatus } from '../../domain/habits'
import { HABIT_CATEGORIES } from '../../domain/settings/types'
import { CategoryGlyph } from '../theme/CategoryGlyph'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { ProgressRing } from './ProgressRing'

const REGULARITY_LABEL: Record<Habit['regularity'], string> = {
  daily: 'Todos los días',
  weekly: 'Cada semana',
  monthly: 'Cada mes',
  yearly: 'Cada año',
}

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface HabitCardProps {
  habit: Habit
  completedToday: boolean
  streak: number
  /** Only present for daily habits — this week's Monday-to-Sunday breakdown. */
  weekStatus?: WeekDayStatus[]
  onToggleToday: () => void
  onToggleDay: (date: string, done: boolean) => void
  onOpen: () => void
  onOpenStats: () => void
}

export const HabitCard = ({ habit, completedToday, streak, weekStatus, onToggleToday, onToggleDay, onOpen, onOpenStats }: HabitCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [expanded, setExpanded] = useState(false)

  const category = HABIT_CATEGORIES.find((cat) => cat.id === habit.categoryId)
  const accentColor = category?.color ?? colors.primary
  const doneThisWeek = weekStatus?.filter((day) => day.done).length ?? 0
  const showRing = Boolean(weekStatus) && !expanded

  return (
    <Pressable style={styles.card} onPress={onOpen}>
      <View style={styles.row}>
        <Pressable onPress={onToggleToday} style={styles.leading}>
          {showRing ? (
            <ProgressRing size={44} progress={doneThisWeek / 7} color={accentColor} label={`${doneThisWeek}/7`} />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: accentColor + '22' }]}>
              <CategoryGlyph iconName={category?.icon} size={20} color={accentColor} />
            </View>
          )}
        </Pressable>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{habit.title}</Text>
          </View>
          {category && (
            <View style={styles.categoryRow}>
              <CategoryGlyph iconName={category.icon} size={12} color={colors.textMuted} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}
          {weekStatus ? (
            <>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${(doneThisWeek / 7) * 100}%`, backgroundColor: accentColor }]} />
              </View>
              <Text style={styles.progressCaption}>{doneThisWeek} de 7 días esta semana</Text>
            </>
          ) : (
            <Text style={styles.progressCaption}>{REGULARITY_LABEL[habit.regularity]}</Text>
          )}
        </View>

        <View style={styles.trailing}>
          <View style={styles.streakBadge}>
            <Flame size={13} color={colors.accent} />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            {expanded ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={styles.accordion}>
          {weekStatus && (
            <View style={styles.weekRow}>
              {weekStatus.map((day, index) => (
                <Pressable key={day.date} onPress={() => onToggleDay(day.date, day.done)} style={styles.weekDay}>
                  <Text style={styles.weekDayLabel}>{WEEKDAY_LABELS[index]}</Text>
                  <View style={[styles.weekDot, day.done && { backgroundColor: accentColor, borderColor: accentColor }]} />
                </Pressable>
              ))}
            </View>
          )}
          <Pressable onPress={onOpenStats} style={styles.statsLinkRow}>
            <BarChart3 size={15} color={colors.primary} />
            <Text style={styles.statsLinkText}>Ver estadísticas</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    leading: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconCircle: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    categoryText: { fontSize: 12, color: colors.textMuted },
    progressBarTrack: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 8,
    },
    progressBarFill: { height: 4, borderRadius: 999 },
    progressCaption: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    trailing: { alignItems: 'flex-end', gap: 6 },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    streakText: { fontSize: 13, fontWeight: '700', color: colors.text },
    accordion: { marginTop: 14 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    weekDay: { alignItems: 'center', gap: 6 },
    weekDayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    weekDot: { width: 24, height: 24, borderRadius: 999, borderWidth: 1.6, borderColor: colors.borderStrong },
    statsLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 14 },
    statsLinkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  })
