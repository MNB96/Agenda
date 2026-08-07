import { useMemo, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, Bell, CalendarCheck, Check, ChevronDown, ChevronUp, GraduationCap, Heart, Repeat, Star } from 'lucide-react-native'
import { ITEM_TYPE, type Item } from '../../domain/items'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface ItemCardProps {
  item: Item
  overdueLabel?: string
  overdueDeadlineLabel?: string
  subtasks?: Item[]
  onToggle?: (item: Item) => Promise<void>
  onToggleSubtask?: (subtask: Item) => Promise<void>
  onOpen?: (item: Item) => void
}

export const ItemCard = ({ item, overdueLabel, overdueDeadlineLabel, subtasks = [], onToggle, onToggleSubtask, onOpen }: ItemCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [expanded, setExpanded] = useState(false)

  const indicatorColor = resolveIndicatorColor(item, colors)
  const reminders = item.reminderConfig ?? []
  const hasAlarmReminder = reminders.some((reminder) => reminder.alarmType === 'alarm')
  const hasNotificationReminder = reminders.some((reminder) => reminder.alarmType !== 'alarm')
  const repeats = Boolean(item.repeatRule) && item.repeatRule !== 'none'
  const subtaskDone = subtasks.filter((sub) => sub.status === 'completed').length
  const ChevronIcon = expanded ? ChevronUp : ChevronDown
  const showCategoryIcon = item.type === ITEM_TYPE.GOAL && item.status !== 'completed'
  // Solo personal/facultad aplican a metas — ver validateGoalRestrictions en Item.ts.
  const CategoryIcon = showCategoryIcon && item.categoryId === 'facultad' ? GraduationCap : showCategoryIcon && item.categoryId === 'personal' ? Heart : undefined

  // La fecha ya la muestra el encabezado de sección; acá solo hora y fecha límite (otro dato).
  const dateLabel =
    [
      item.startTime,
      item.deadline ? `Fecha límite: ${format(parseISO(item.deadline), 'd MMM', { locale: es })}` : undefined,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' - ') || undefined

  return (
    <Pressable style={[styles.card, item.important && styles.cardImportant]} onPress={() => onOpen?.(item)}>
      <View style={styles.row}>
        <Pressable
          disabled={!onToggle}
          onPress={() => void onToggle?.(item)}
          style={[
            styles.checkbox,
            { borderColor: indicatorColor },
            item.status === 'completed' ? [styles.checkboxDone, { backgroundColor: colors.success }] : undefined,
          ]}
        >
          {CategoryIcon && <CategoryIcon size={14} color={indicatorColor} />}
        </Pressable>

        <View style={styles.content}>
          <Text style={[styles.title, item.status === 'completed' ? styles.done : undefined]}>{item.title}</Text>
          {overdueDeadlineLabel ? (
            <Text style={styles.overdueDeadlineLabel}>{overdueDeadlineLabel}</Text>
          ) : null}
          {overdueLabel ? (
            <Text style={styles.overdueLabel}>{overdueLabel}</Text>
          ) : null}
          {dateLabel ? (
            <Text style={styles.meta}>{dateLabel}</Text>
          ) : null}
          {item.description ? (
            <Text style={styles.meta} numberOfLines={1}>{item.description}</Text>
          ) : null}
          {item.location ? (
            <Pressable
              onPress={() => void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(item.location!)}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={styles.locationMeta} numberOfLines={1}>📍 {item.location}</Text>
            </Pressable>
          ) : null}

          {subtasks.length > 0 && (
            <>
              <Pressable style={styles.progressRow} onPress={() => setExpanded((v) => !v)} hitSlop={6}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${(subtaskDone / subtasks.length) * 100}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={styles.progressLabel}>{subtaskDone} de {subtasks.length}</Text>
                <ChevronIcon size={16} color={colors.textMuted} />
              </Pressable>
              {expanded && subtasks.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={styles.subtaskRow}
                  onPress={() => {
                    void onToggleSubtask?.(sub).catch((error: unknown) => {
                      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                    })
                  }}
                >
                  <View style={[styles.subtaskCheck, sub.status === 'completed' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {sub.status === 'completed' && <Check size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.subtaskTitle, sub.status === 'completed' && styles.done]}>{sub.title}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>

        {(item.important || repeats || hasAlarmReminder || hasNotificationReminder || item.calendarLink) && (
          <View style={styles.indicatorStack}>
            {item.important && <Star size={16} color="#F38630" fill="#F38630" />}
            {item.calendarLink && <CalendarCheck size={16} color="#4285F4" />}
            {repeats && <Repeat size={16} color={colors.textMuted} />}
            {hasAlarmReminder ? (
              <AlarmClock size={17} color={colors.accent} />
            ) : hasNotificationReminder ? (
              <Bell size={17} color={colors.primary} />
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  )
}

const resolveIndicatorColor = (item: Item, colors: ThemeTokens): string => {
  if (item.status === 'completed') {
    return colors.success
  }
  if (item.type === ITEM_TYPE.GOAL) {
    return resolveGoalUrgencyColor(item.deadline, colors)
  }
  if (item.deadline) {
    const days = differenceInCalendarDays(startOfDay(parseISO(item.deadline)), startOfDay(new Date()))
    if (days <= 0) {
      return colors.danger
    }
    if (days <= 3) {
      return colors.warning
    }
  }
  return colors.primary
}

// Va de neutro a rojo a medida que se acerca el deadline, llegando a danger el día que vence.
const resolveGoalUrgencyColor = (deadline: string | undefined, colors: ThemeTokens): string => {
  if (!deadline) return colors.cream
  const days = differenceInCalendarDays(startOfDay(parseISO(deadline)), startOfDay(new Date()))
  if (days <= 0) return colors.danger
  if (days <= 3) return colors.accentStrong
  if (days <= 7) return colors.accentSoft
  if (days <= 14) return colors.accent
  if (days <= 30) return colors.primary
  return colors.cream
}


const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 0,
      paddingVertical: 16,
      paddingHorizontal: 4,
      marginBottom: 0,
      borderBottomWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: 'transparent',
    },
    cardImportant: {
      borderLeftColor: '#F38630',
      backgroundColor: '#F38630' + '0D',
    },
    row: {
      flexDirection: 'row',
      gap: 14,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1.6,
      marginTop: 0,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      borderColor: colors.success,
    },
    content: {
      flex: 1,
    },
    indicatorStack: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 6,
    },
    title: {
      fontSize: 17,
      fontWeight: '500',
      color: colors.text,
    },
    done: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    overdueDeadlineLabel: {
      fontSize: 14,
      color: colors.danger,
      marginTop: 3,
      fontWeight: '600',
    },
    overdueLabel: {
      fontSize: 14,
      color: colors.danger,
      marginTop: 3,
      fontWeight: '400',
    },
    meta: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 3,
    },
    locationMeta: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 3,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    progressBarTrack: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 4,
      borderRadius: 999,
    },
    progressLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    subtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
      paddingLeft: 4,
      marginTop: 2,
    },
    subtaskCheck: {
      width: 18,
      height: 18,
      borderRadius: 999,
      borderWidth: 1.6,
      borderColor: colors.borderStrong,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtaskTitle: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
  })
