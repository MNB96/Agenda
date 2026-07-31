import { addMonths, format, parseISO, subMonths } from 'date-fns'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useGoogleEvents } from '../../features/calendar/useGoogleCalendar'
import { useItems } from '../../features/items/useItems'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface AgendaScreenProps {
  onOpenItemEditor: (itemId: string) => void
}

const itemDate = (item: Item): string | undefined =>
  item.startDate ?? item.deadline ?? item.dateWindow?.startDate ?? item.dateWindow?.endDate

const resolveAgendaEntryColor = (
  entry: { source: 'local' | 'google'; subtitle?: string },
  colors: ThemeTokens,
): string => {
  if (entry.source === 'google') {
    return colors.primary
  }
  const subtitle = entry.subtitle?.toLowerCase() ?? ''
  if (subtitle.includes('urgente') || subtitle.includes('atras')) {
    return colors.accentStrong
  }
  if (subtitle.includes('deadline') || subtitle.includes('fecha')) {
    return colors.accent
  }
  if (subtitle.includes('meta') || subtitle.includes('objetivo')) {
    return colors.cream
  }
  return colors.secondary
}

export const AgendaScreen = ({ onOpenItemEditor }: AgendaScreenProps) => {
  const [month, setMonth] = useState(new Date())
  const { items } = useItems()
  const googleEvents = useGoogleEvents(month)
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const localEntries = useMemo(
    () =>
      items
        .map((item) => {
          const date = itemDate(item)
          if (!date) {
            return null
          }
          return {
            id: item.id,
            title: item.title,
            source: 'local' as const,
            date,
            time: item.startTime,
            subtitle: item.type === 'date_window' ? 'Ventana de fecha' : undefined,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [items],
  )

  const externalEntries = useMemo(
    () =>
      (googleEvents.data ?? []).map((event) => ({
        id: `google-${event.calendarId}-${event.id}`,
        title: event.title,
        source: 'google' as const,
        date: event.startDateTime.slice(0, 10),
        time: event.allDay ? undefined : format(parseISO(event.startDateTime), 'HH:mm'),
        subtitle: event.location,
      })),
    [googleEvents.data],
  )

  const allEntries = [...localEntries, ...externalEntries].sort((a, b) =>
    `${a.date} ${a.time ?? '00:00'}`.localeCompare(`${b.date} ${b.time ?? '00:00'}`),
  )

  const grouped = allEntries.reduce<Record<string, typeof allEntries>>((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = []
    }
    acc[entry.date].push(entry)
    return acc
  }, {})

  const dates = Object.keys(grouped)

  return (
    <View style={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable style={styles.monthButton} onPress={() => setMonth((current) => subMonths(current, 1))}>
          <ChevronLeft size={16} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.monthTitle}>{format(month, 'MMMM yyyy')}</Text>
        <Pressable style={styles.monthButton} onPress={() => setMonth((current) => addMonths(current, 1))}>
          <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <FlatList
        data={dates}
        keyExtractor={(date) => date}
        renderItem={({ item: date }) => (
          <View style={styles.dayGroup}>
            <View style={styles.dayTitleRow}>
              <Text style={styles.dayTitle}>{new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
              {date === new Date().toISOString().slice(0, 10) ? <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Hoy</Text></View> : null}
            </View>
            {grouped[date].map((entry) => (
              <Pressable
                key={entry.id}
                style={styles.entryCard}
                onPress={() => (entry.source === 'local' ? onOpenItemEditor(entry.id) : undefined)}
              >
                <View style={styles.entryRow}>
                  <View
                    style={[
                      styles.entryDot,
                      {
                        backgroundColor: resolveAgendaEntryColor(entry, colors),
                      },
                    ]}
                  />
                  <View style={styles.entryContent}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryMeta}>
                      {entry.time ? `${entry.time} · ` : ''}
                      {entry.subtitle || (entry.source === 'google' ? 'Google Calendar' : 'Agenda')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  )
}

const createStyles = (colors: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: colors.text,
  },
  dayGroup: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    marginBottom: 12,
  },
  dayTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  todayBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayBadgeText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  entryCard: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  entryContent: {
    flex: 1,
  },
  entryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
  },
  entryMeta: {
    marginTop: 3,
    fontSize: 14,
    color: colors.textSecondary,
  },
})
