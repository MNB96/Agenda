import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isToday, startOfMonth, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import type { ThemeTokens } from '../theme/tokens'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const buildCalendarCells = (month: Date): (Date | null)[] => {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const days = eachDayOfInterval({ start: first, end: last })
  const offset = (getDay(first) + 6) % 7 // Monday = 0
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

interface MonthCalendarProps {
  selectedDate?: string
  onSelectDate: (dateStr: string) => void
  colors: ThemeTokens
  accentColor?: string
}

export const MonthCalendar = ({ selectedDate, onSelectDate, colors, accentColor }: MonthCalendarProps) => {
  const [viewMonth, setViewMonth] = useState(() => (selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()))
  const cells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])
  const styles = useMemo(() => createStyles(colors), [colors])
  const accent = accentColor ?? colors.primary

  return (
    <View>
      <View style={styles.monthNav}>
        <Pressable onPress={() => setViewMonth((m) => subMonths(m, 1))} hitSlop={12}>
          <ChevronLeft size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.monthLabel}>{format(viewMonth, 'MMMM yyyy', { locale: es })}</Text>
        <Pressable onPress={() => setViewMonth((m) => addMonths(m, 1))} hitSlop={12}>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <Text key={i} style={styles.weekdayLabel}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={styles.calCell} />
          const dayStr = format(day, 'yyyy-MM-dd')
          const isSel = dayStr === selectedDate
          const today = isToday(day)
          return (
            <Pressable key={idx} style={styles.calCell} onPress={() => onSelectDate(dayStr)} hitSlop={2}>
              <View
                style={[
                  styles.calDayMarker,
                  isSel && { backgroundColor: accent },
                  today && !isSel && { borderWidth: 1, borderColor: accent },
                ]}
              >
                <Text
                  style={[
                    styles.calDayText,
                    isSel && styles.calDayTextSelected,
                    today && !isSel && { color: accent, fontWeight: '700' },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    monthLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekdayLabel: {
      width: '14.2857%',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      paddingVertical: 4,
    },
    calGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    calCell: {
      width: '14.2857%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayMarker: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayText: {
      fontSize: 14,
      color: colors.text,
    },
    calDayTextSelected: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
  })
