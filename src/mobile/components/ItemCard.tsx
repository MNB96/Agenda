import { useMemo } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface ItemCardProps {
  item: Item
  categoryName?: string
  overdueLabel?: string
  overdueDeadlineLabel?: string
  onToggle?: (item: Item) => Promise<void>
  onOpen?: (item: Item) => void
}

export const ItemCard = ({ item, categoryName, overdueLabel, overdueDeadlineLabel, onToggle, onOpen }: ItemCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const indicatorColor = resolveIndicatorColor(item, colors)

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
            <Text style={[styles.title, item.status === 'completed' ? styles.done : undefined]}>{item.title}</Text>
          </View>
          {overdueDeadlineLabel ? (
            <Text style={styles.overdueDeadlineLabel}>{overdueDeadlineLabel}</Text>
          ) : null}
          {overdueLabel ? (
            <Text style={styles.overdueLabel}>{overdueLabel}</Text>
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
  })
