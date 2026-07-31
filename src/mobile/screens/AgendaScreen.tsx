import { addMonths, format, parseISO, subMonths } from 'date-fns'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useGoogleEvents } from '../../features/calendar/useGoogleCalendar'
import { useItems } from '../../features/items/useItems'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'

interface AgendaScreenProps {
  onOpenItemEditor: (itemId: string) => void
}

const itemDate = (item: Item): string | undefined =>
  item.startDate ?? item.deadline ?? item.dateWindow?.startDate ?? item.dateWindow?.endDate

export const AgendaScreen = ({ onOpenItemEditor }: AgendaScreenProps) => {
  const [month, setMonth] = useState(new Date())
  const { items } = useItems()
  const googleEvents = useGoogleEvents(month)
  const { colors } = useAppTheme()

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
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.monthHeader}>
        <Pressable
          style={[styles.monthButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setMonth((current) => subMonths(current, 1))}
        >
          <ChevronLeft size={16} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{format(month, 'MMMM yyyy')}</Text>
        <Pressable
          style={[styles.monthButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setMonth((current) => addMonths(current, 1))}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      <FlatList
        data={dates}
        keyExtractor={(date) => date}
        renderItem={({ item: date }) => (
          <View style={[styles.dayGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.dayTitle, { color: colors.textSecondary }]}>{new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            {grouped[date].map((entry) => (
              <Pressable
                key={entry.id}
                style={[styles.entryCard, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                onPress={() => (entry.source === 'local' ? onOpenItemEditor(entry.id) : undefined)}
              >
                <View style={styles.entryHead}>
                  <View
                    style={[
                      styles.entryDot,
                      {
                        backgroundColor:
                          entry.source === 'google'
                            ? colors.primary
                            : entry.subtitle?.includes('Ventana')
                              ? colors.accent
                              : colors.secondary,
                      },
                    ]}
                  />
                  <Text style={[styles.entryTitle, { color: colors.text }]}>{entry.title}</Text>
                </View>
                <Text style={[styles.entryMeta, { color: colors.textSecondary }]}>
                  {entry.time ? `${entry.time} · ` : ''}
                  {entry.subtitle || (entry.source === 'google' ? 'Google Calendar' : 'Agenda')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 999,
    borderWidth: 1,
    padding: 8,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  dayGroup: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  dayTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  entryDot: { width: 8, height: 8, borderRadius: 999 },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  entryMeta: {
    marginTop: 2,
    fontSize: 12,
  },
})
