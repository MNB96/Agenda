import { Pressable, StyleSheet, Text, View } from 'react-native'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'

interface ItemCardProps {
  item: Item
  categoryName?: string
  onToggle?: (item: Item) => Promise<void>
  onOpen?: (item: Item) => void
}

export const ItemCard = ({ item, categoryName, onToggle, onOpen }: ItemCardProps) => {
  const { colors } = useAppTheme()

  const getIndicatorColor = () => {
    if (item.status === 'completed') {
      return colors.secondary
    }

    if (item.deadline) {
      const days = differenceInCalendarDays(startOfDay(parseISO(item.deadline)), startOfDay(new Date()))
      if (days <= 0) {
        return colors.accentStrong
      }
      if (days <= 2) {
        return colors.accent
      }
    }

    if (item.type === 'important_date' || item.type === 'date_window') {
      return colors.accent
    }
    if (item.type === 'goal') {
      return colors.cream
    }
    return colors.primary
  }

  const indicatorColor = getIndicatorColor()

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onOpen?.(item)}
    >
      <View style={styles.row}>
        <View style={[styles.indicator, { backgroundColor: indicatorColor }]} />

        <Pressable
          disabled={!onToggle || item.type === 'event' || item.type === 'important_date' || item.type === 'date_window'}
          onPress={() => void onToggle?.(item)}
          style={[
            styles.checkbox,
            { borderColor: colors.interactiveMuted },
            item.status === 'completed' ? [styles.checkboxDone, { backgroundColor: colors.secondary, borderColor: colors.secondary }] : undefined,
          ]}
        />

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }, item.status === 'completed' ? [styles.done, { color: colors.textMuted }] : undefined]}>{item.title}</Text>
          {item.description ? <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.description}</Text> : null}
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {item.startDate ? item.startDate : ''}
            {item.startTime ? ` ${item.startTime}` : ''}
            {item.deadline ? ` · Vence ${item.deadline}` : ''}
          </Text>
          <View style={styles.chipsRow}>
            {categoryName ? <Text style={[styles.chip, { backgroundColor: colors.secondarySoft, color: colors.textSecondary }]}>{categoryName}</Text> : null}
            {item.location ? <Text style={[styles.chip, { backgroundColor: colors.primarySoft, color: colors.textSecondary }]}>📍 {item.location}</Text> : null}
            {item.goalConfig ? (
              <Text style={[styles.chip, { backgroundColor: colors.creamSoft, color: colors.textSecondary }]}>{`${item.goalConfig.currentValue}/${item.goalConfig.targetValue}`}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  indicator: {
    width: 4,
    borderRadius: 999,
    height: '100%',
    minHeight: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  checkboxDone: {
    transform: [{ scale: 1.04 }],
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  done: {
    textDecorationLine: 'line-through',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  chip: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
})
