import { useMemo } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, Bell, CalendarCheck, Repeat } from 'lucide-react-native'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface ItemCardProps {
  item: Item
  overdueLabel?: string
  overdueDeadlineLabel?: string
  subtaskTotal?: number
  subtaskDone?: number
  onToggle?: (item: Item) => Promise<void>
  onOpen?: (item: Item) => void
}

export const ItemCard = ({ item, overdueLabel, overdueDeadlineLabel, subtaskTotal, subtaskDone, onToggle, onOpen }: ItemCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const indicatorColor = resolveIndicatorColor(item, colors)
  const reminders = item.reminderConfig ?? []
  const hasAlarmReminder = reminders.some((r) => r.alarmType === 'alarm')
  const hasNotificationReminder = reminders.some((r) => r.alarmType !== 'alarm')
  const repeats = Boolean(item.repeatRule) && item.repeatRule !== 'none'

  // La fecha ya la muestra el encabezado de sección (agrupa por día exacto), así que acá
  // abajo del título va la hora y, si tiene una fecha límite propia, esa también —
  // repetir la fecha del encabezado sería redundante, pero la fecha límite es otro dato.
  const dateLabel =
    item.type === 'date_window' && (item.dateWindow?.startDate || item.dateWindow?.endDate)
      ? [item.dateWindow.startDate, item.dateWindow.endDate]
          .filter((d): d is string => Boolean(d))
          .map((d) => format(parseISO(d), 'd MMM', { locale: es }))
          .join(' - ')
      : !overdueDeadlineLabel && !overdueLabel
        ? [
            item.startTime,
            item.deadline ? `Fecha límite: ${format(parseISO(item.deadline), 'd MMM', { locale: es })}` : undefined,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' - ') || undefined
        : undefined

  return (
    <Pressable style={styles.card} onPress={() => onOpen?.(item)}>
      <View style={styles.row}>
        <Pressable
          disabled={!onToggle || item.type === 'event' || item.type === 'important_date' || item.type === 'date_window'}
          onPress={() => void onToggle?.(item)}
          style={[
            styles.checkbox,
            { borderColor: indicatorColor },
            item.status === 'completed' ? [styles.checkboxDone, { backgroundColor: colors.success }] : undefined,
          ]}
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, item.status === 'completed' ? styles.done : undefined, { flex: 1 }]}>{item.title}</Text>
            {(subtaskTotal ?? 0) > 0 && (
              <View style={[styles.subtaskBadge, subtaskDone === subtaskTotal && { backgroundColor: colors.success + '22', borderColor: colors.success + '55' }]}>
                <Text style={[styles.subtaskBadgeText, subtaskDone === subtaskTotal && { color: colors.success }]}>
                  {subtaskDone}/{subtaskTotal}
                </Text>
              </View>
            )}
          </View>
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
          {item.goalConfig ? (
            <Text style={styles.meta}>
              {`${item.goalConfig.currentValue}/${item.goalConfig.targetValue}`}
            </Text>
          ) : null}
        </View>

        {(repeats || hasAlarmReminder || hasNotificationReminder || item.googleCalendarLink) && (
          <View style={styles.indicatorStack}>
            {item.googleCalendarLink && <CalendarCheck size={16} color="#4285F4" />}
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
  if (item.deadline) {
    const days = differenceInCalendarDays(startOfDay(parseISO(item.deadline)), startOfDay(new Date()))
    if (days <= 0) {
      return colors.danger
    }
    if (days <= 3) {
      return colors.warning
    }
  }
  if (item.type === 'goal') {
    return colors.cream
  }
  if (item.type === 'important_date' || item.type === 'date_window') {
    return colors.accent
  }
  return colors.primary
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
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
    subtaskBadge: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginLeft: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.surfaceSecondary,
    },
    subtaskBadgeText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
  })
