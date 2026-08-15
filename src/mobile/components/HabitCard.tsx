import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { format } from 'date-fns'
import { BarChart3, Check, ChevronDown, ChevronUp, Edit2, Flame } from 'lucide-react-native'
import type { Habit, WeekDayStatus } from '../../domain/habits'
import { HABIT_CATEGORIES } from '../../domain/settings/types'
import { CategoryGlyph } from '../theme/CategoryGlyph'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { ProgressRing } from './ProgressRing'

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WEEKDAY_FULL_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

interface HabitCardProps {
  habit: Habit
  todayCount: number
  /** For non-daily habits: total completions in the current period (week/month/year). */
  periodSummary?: { count: number; label: string }
  streak: number
  /** Only present for daily habits — this week's Monday-to-Sunday breakdown. */
  weekStatus?: WeekDayStatus[]
  todayOccurrences?: { id: string; occurredAt: string }[]
  onToggleToday: () => void
  onToggleDay: (date: string, done: boolean) => void
  onDeleteOccurrence: (occurrenceId: string) => void
  onOpen: () => void
  onOpenStats: () => void
}

export const HabitCard = ({ habit, todayCount, periodSummary, streak, weekStatus, todayOccurrences = [], onToggleToday, onToggleDay, onDeleteOccurrence, onOpen, onOpenStats }: HabitCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [expanded, setExpanded] = useState(false)
  const [showAllOccurrences, setShowAllOccurrences] = useState(false)
  const [isEditingOccurrences, setIsEditingOccurrences] = useState(false)

  const category = HABIT_CATEGORIES.find((cat) => cat.id === habit.categoryId)
  const accentColor = category?.color ?? colors.primary
  const isMultiDay = habit.timesPerDay > 1

  // For display: use period count for non-daily habits, today count for daily
  const displayCount = periodSummary ? periodSummary.count : todayCount
  const isDoneForPeriod = displayCount >= habit.timesPerDay
  // Leading icon and quick-add button reflect period completion (consistent with progress bar)
  const isTodayDone = !isMultiDay && isDoneForPeriod
  const hasTodayEntry = !isMultiDay && todayCount > 0

  const handleToggleExpanded = () => {
    setExpanded((previous) => {
      const next = !previous
      if (!next) {
        setIsEditingOccurrences(false)
        setShowAllOccurrences(false)
      }
      return next
    })
  }

  const progressPercent = Math.min((displayCount / Math.max(habit.timesPerDay, 1)) * 100, 100)
  const doneThisWeek = weekStatus?.filter((day) => day.done).length ?? 0
  const showRing = Boolean(weekStatus) && !expanded && !isMultiDay
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const orderedOccurrences = useMemo(
    () => [...todayOccurrences].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    [todayOccurrences],
  )
  const displayOccurrences = isEditingOccurrences ? orderedOccurrences : showAllOccurrences ? orderedOccurrences : orderedOccurrences.slice(0, 4)
  const hiddenOccurrencesCount = Math.max(0, orderedOccurrences.length - displayOccurrences.length)

  const renderOccurrenceChip = (occurrence: { id: string; occurredAt: string }) => {
    const time = format(new Date(occurrence.occurredAt), 'HH:mm')
    return isEditingOccurrences ? (
      <Pressable
        key={occurrence.id}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar registro de las ${time}`}
        onPress={(event) => {
          event.stopPropagation()
          onDeleteOccurrence(occurrence.id)
        }}
        style={styles.occurrenceChipEdit}
      >
        <Text style={styles.occurrenceChipText}>{time}</Text>
        <Text style={styles.occurrenceDeleteText}>×</Text>
      </Pressable>
    ) : (
      <View key={occurrence.id} style={styles.occurrenceChip}>
        <Text style={styles.occurrenceChipText}>{time}</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          onPress={onToggleToday}
          style={styles.leading}
          accessibilityRole="button"
          accessibilityLabel={
            isMultiDay
              ? `Registrar una vez ${habit.title}`
              : hasTodayEntry
              ? `Desmarcar ${habit.title}`
              : `Marcar ${habit.title} como completado`
          }
        >
          {showRing ? (
            <ProgressRing size={44} progress={doneThisWeek / 7} color={accentColor} label={isTodayDone ? '✓' : `${doneThisWeek}/7`} />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: isMultiDay ? accentColor + '18' : accentColor + '22' }]}>
              {isMultiDay ? (
                <Text style={[styles.plusIcon, { color: accentColor }]}>＋</Text>
              ) : isTodayDone ? (
                <Check size={20} color={accentColor} strokeWidth={3} />
              ) : (
                <CategoryGlyph iconName={category?.icon} size={20} color={accentColor} />
              )}
            </View>
          )}
        </Pressable>

        <Pressable onPress={onOpen} style={styles.content} accessibilityRole="button" accessibilityLabel={`Abrir ${habit.title}`}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{habit.title}</Text>
            <Text style={[styles.todayValue, displayCount > habit.timesPerDay && { color: colors.accent }]}>{displayCount}/{habit.timesPerDay}</Text>
          </View>
          {category && (
            <View style={styles.categoryRow}>
              <CategoryGlyph iconName={category.icon} size={12} color={colors.textMuted} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}
          {isMultiDay ? (
            <>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: accentColor }]} />
              </View>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressCaption}>
                  {periodSummary
                    ? `${displayCount} de ${habit.timesPerDay} veces ${periodSummary.label}`
                    : `${todayCount} de ${habit.timesPerDay} veces hoy`}
                </Text>
                {isDoneForPeriod && <Text style={styles.metaCaption}>Meta cumplida</Text>}
              </View>
            </>
          ) : weekStatus ? (
            <>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min((todayCount / Math.max(habit.timesPerDay, 1)) * 100, 100)}%`, backgroundColor: accentColor }]} />
              </View>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressCaption}>{todayCount} de {habit.timesPerDay} {habit.timesPerDay === 1 ? 'vez' : 'veces'} hoy</Text>
              </View>
            </>
          ) : periodSummary ? (
            <>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: accentColor }]} />
              </View>
              <View style={styles.progressMetaRow}>
                <Text style={styles.progressCaption}>
                  {displayCount} de {habit.timesPerDay} {habit.timesPerDay === 1 ? 'vez' : 'veces'} {periodSummary.label}
                </Text>
                {isDoneForPeriod && <Text style={styles.metaCaption}>Meta cumplida</Text>}
              </View>
            </>
          ) : null}
        </Pressable>

        <View style={styles.trailing}>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={13} color={colors.accent} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          )}
          <Pressable
            onPress={handleToggleExpanded}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? `Contraer ${habit.title}` : `Expandir ${habit.title}`}
          >
            {expanded ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={styles.accordion}>
          {isMultiDay && (
            <View style={styles.expandedSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Hoy</Text>
                {orderedOccurrences.length > 0 ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation()
                      setIsEditingOccurrences((value) => !value)
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={isEditingOccurrences ? 'Finalizar edición de registros de hoy' : 'Editar registros de hoy'}
                    style={styles.inlineAction}
                  >
                    <Text style={styles.inlineActionText}>{isEditingOccurrences ? 'Listo' : 'Editar'}</Text>
                  </Pressable>
                ) : null}
              </View>

              {orderedOccurrences.length > 0 ? (
                <View style={styles.occurrencesRow}>
                  {displayOccurrences.map(renderOccurrenceChip)}
                  {!isEditingOccurrences && hiddenOccurrencesCount > 0 && (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation()
                        setShowAllOccurrences((value) => !value)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Mostrar ${hiddenOccurrencesCount} registros más`}
                      style={styles.occurrenceChipMore}
                    >
                      <Text style={styles.occurrenceChipText}>+{hiddenOccurrencesCount}</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyOccurrencesText}>No hay registros hoy</Text>
              )}
            </View>
          )}

          {weekStatus && (
            <View style={styles.expandedSection}>
              <Text style={styles.sectionTitle}>Esta semana</Text>
              <View style={styles.weekRow}>
                {weekStatus.map((day, index) => {
                  const isPartial = day.partial && !day.done
                  const isDone = day.done
                  const isFuture = day.date > todayStr
                  return (
                    <Pressable
                      key={day.date}
                      onPress={() => onToggleDay(day.date, day.done)}
                      style={[styles.weekDay, isFuture && { opacity: 0.35 }]}
                      accessibilityRole="button"
                      accessibilityLabel={isFuture ? `${WEEKDAY_FULL_LABELS[index]} (fecha futura)` : `${isDone ? 'Desmarcar' : 'Marcar'} ${WEEKDAY_FULL_LABELS[index]}`}
                    >
                      <Text style={styles.weekDayLabel}>{WEEKDAY_LABELS[index]}</Text>
                      <View
                        style={[
                          styles.weekDot,
                          isDone && { backgroundColor: accentColor, borderColor: accentColor },
                          isPartial && { backgroundColor: accentColor + '33', borderColor: accentColor },
                        ]}
                      />
                    </Pressable>
                  )
                })}
              </View>
              <Text style={styles.weekSummaryText}>
                {doneThisWeek} de 7 {isMultiDay ? 'metas alcanzadas' : 'días completados'}
              </Text>
            </View>
          )}

          {periodSummary && (
            <View style={styles.expandedSection}>
              <Text style={styles.sectionTitle}>{periodSummary.label.charAt(0).toUpperCase() + periodSummary.label.slice(1)}</Text>
              <View style={styles.periodProgressTrack}>
                <View style={[styles.periodProgressFill, { width: `${Math.min(100, (periodSummary.count / Math.max(habit.timesPerDay, 1)) * 100)}%`, backgroundColor: accentColor }]} />
              </View>
              <Text style={styles.weekSummaryText}>
                {periodSummary.count} de {habit.timesPerDay} {habit.timesPerDay === 1 ? 'vez' : 'veces'} {periodSummary.label}
                {isDoneForPeriod ? '  ✓' : ''}
              </Text>
            </View>
          )}

          <View style={styles.daySummaryRow}>
            <Text style={styles.daySummaryText}>
              {isMultiDay && periodSummary
                ? `${periodSummary.count} de ${habit.timesPerDay} veces ${periodSummary.label}${isDoneForPeriod ? '  ✓' : ''}`
                : isMultiDay
                ? `${todayCount} de ${habit.timesPerDay} veces hoy${todayCount >= Math.max(1, habit.timesPerDay) ? '  ✓' : ''}`
                : isTodayDone && !hasTodayEntry
                ? `Meta${periodSummary ? ` de ${periodSummary.label}` : ''} cumplida  ✓`
                : `Hoy: ${todayCount}/${habit.timesPerDay}`}
            </Text>
            <Pressable
              style={[
                styles.quickAddButton,
                !isMultiDay && hasTodayEntry && isTodayDone && { backgroundColor: accentColor },
                !isMultiDay && !hasTodayEntry && isTodayDone && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: accentColor },
              ]}
              onPress={(event) => {
                event.stopPropagation()
                onToggleToday()
              }}
              accessibilityLabel={
                isMultiDay
                  ? `Registrar una vez ${habit.title}`
                  : hasTodayEntry
                  ? `Desmarcar ${habit.title}`
                  : isDoneForPeriod
                  ? `Registrar ${habit.title} de nuevo`
                  : `Marcar ${habit.title} como completado`
              }
            >
              {hasTodayEntry && isTodayDone ? (
                <Check size={20} color="#FFFFFF" strokeWidth={3} />
              ) : isTodayDone ? (
                <Text style={[styles.quickAddButtonText, { color: accentColor }]}>＋</Text>
              ) : (
                <Text style={styles.quickAddButtonText}>＋</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.accordionActions}>
            <Pressable
              onPress={(event) => { event.stopPropagation(); onOpenStats() }}
              style={styles.statsLinkRow}
              accessibilityRole="button"
              accessibilityLabel={`Ver estadísticas de ${habit.title}`}
            >
              <BarChart3 size={15} color={colors.primary} />
              <Text style={styles.statsLinkText}>Ver estadísticas</Text>
            </Pressable>
            <Pressable
              onPress={(event) => { event.stopPropagation(); onOpen() }}
              style={styles.statsLinkRow}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${habit.title}`}
            >
              <Edit2 size={15} color={colors.primary} />
              <Text style={styles.statsLinkText}>Editar hábito</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
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
    todayValue: { fontSize: 13, color: colors.primary, fontWeight: '700' },
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
    progressMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 8 },
    progressCaption: { fontSize: 12, color: colors.textMuted },
    metaCaption: { fontSize: 12, color: colors.primary, fontWeight: '700' },
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
    expandedSection: { marginBottom: 14 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
    weekDay: { alignItems: 'center', gap: 6 },
    weekDayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    weekDot: { width: 24, height: 24, borderRadius: 999, borderWidth: 1.6, borderColor: colors.borderStrong },
    periodProgressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 8,
    },
    periodProgressFill: { height: 8, borderRadius: 999 },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    inlineAction: { paddingVertical: 2, paddingHorizontal: 4 },
    inlineActionText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
    occurrencesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    occurrenceChip: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    occurrenceChipEdit: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingLeft: 8,
      paddingRight: 6,
      paddingVertical: 5,
      gap: 6,
    },
    occurrenceChipMore: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    occurrenceChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    occurrenceDeleteText: { fontSize: 15, fontWeight: '700', color: colors.textMuted, lineHeight: 15, paddingHorizontal: 1 },
    emptyOccurrencesText: { fontSize: 12, color: colors.textMuted },
    daySummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    daySummaryText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700', flexShrink: 1 },
    quickAddButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAddButtonText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', lineHeight: 24 },
    weekSummaryText: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
    accordionActions: { flexDirection: 'row', gap: 20, paddingTop: 4 },
    statsLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 12 },
    statsLinkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    plusIcon: { fontSize: 22, fontWeight: '800' },
  })
