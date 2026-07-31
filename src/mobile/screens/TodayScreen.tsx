import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ItemCard } from '../components/ItemCard'
import { useItems } from '../../features/items/useItems'
import { useSettings } from '../../features/settings/useSettings'
import { scoreItemsForToday, type TodayBucket } from '../../services/items/relevance'
import { useGoogleEvents } from '../../features/calendar/useGoogleCalendar'
import { useAppTheme } from '../theme/useAppTheme'

const bucketLabel: Record<TodayBucket, string> = {
  overdue: 'Atrasado',
  now: 'Ahora',
  next: 'Proximo',
  important: 'Importante',
  later: 'Mas adelante',
  long_term_goal: 'Objetivos',
}

interface TodayScreenProps {
  onOpenItemEditor: (itemId: string) => void
  onOpenQuickAdd: () => void
}

export const TodayScreen = ({ onOpenItemEditor, onOpenQuickAdd }: TodayScreenProps) => {
  const { items, toggleCompleted } = useItems()
  const { data: settings } = useSettings()
  const googleEvents = useGoogleEvents(new Date())
  const { colors } = useAppTheme()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!settings?.showCompletedItems && item.status === 'completed') {
        return false
      }
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) {
        return false
      }
      if (!query) {
        return true
      }
      return [item.title, item.description, item.location, item.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [activeCategory, items, search, settings?.showCompletedItems])

  const scored = scoreItemsForToday(filteredItems)
  const sections = Object.entries(
    scored.reduce<Record<TodayBucket, typeof scored>>(
      (acc, current) => {
        acc[current.bucket].push(current)
        return acc
      },
      { overdue: [], now: [], next: [], important: [], later: [], long_term_goal: [] },
    ),
  ) as Array<[TodayBucket, typeof scored]>

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.dateTitle, { color: colors.textSecondary }]}>{format(new Date(), 'EEEE d MMMM', { locale: es })}</Text>
      <TextInput
        placeholder="Buscar por titulo, categoria o ubicacion"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.textMuted}
        style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
      />

      <View style={styles.filtersRow}>
        <Pressable
          onPress={() => setActiveCategory('all')}
          style={[
            styles.filterChip,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeCategory === 'all' && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <Text style={[styles.filterChipText, { color: colors.textSecondary }, activeCategory === 'all' && { color: colors.text, fontWeight: '700' }]}>Todo</Text>
        </Pressable>
        {(settings?.categories ?? []).map((category) => (
          <Pressable
            key={category.id}
            onPress={() => setActiveCategory(category.id)}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              activeCategory === category.id && { backgroundColor: colors.secondarySoft, borderColor: colors.secondary },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary },
                activeCategory === category.id && { color: colors.text, fontWeight: '700' },
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={sections}
        keyExtractor={([bucket]) => bucket}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: [bucket, entries] }) => (
          <View style={styles.section}>
            {entries.length ? <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{bucketLabel[bucket]}</Text> : null}
            {entries.map(({ item: row }) => (
              <ItemCard
                key={row.id}
                item={row}
                categoryName={settings?.categories.find((category) => category.id === row.categoryId)?.name}
                onToggle={async (item) => {
                  await toggleCompleted(item)
                }}
                onOpen={() => onOpenItemEditor(row.id)}
              />
            ))}
          </View>
        )}
        ListFooterComponent={
          <View style={styles.googleSection}>
            <Text style={[styles.googleTitle, { color: colors.textSecondary }]}>Google Calendar</Text>
            {(googleEvents.data ?? []).slice(0, 5).map((event) => (
              <View key={`${event.calendarId}-${event.id}`} style={[styles.googleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                <View style={styles.googleRow}>
                  <View style={[styles.googleDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.googleCardTitle, { color: colors.text }]}>{event.title}</Text>
                </View>
                <Text style={[styles.googleCardMeta, { color: colors.textSecondary }]}>
                  {new Date(event.startDateTime).toLocaleString('es-AR')}
                  {event.location ? ` · ${event.location}` : ''}
                </Text>
              </View>
            ))}

            <Pressable
              style={[styles.quickButton, { backgroundColor: colors.primary, borderColor: colors.secondarySoft }]}
              onPress={onOpenQuickAdd}
            >
              <Text style={[styles.quickButtonText, { color: colors.text }]}>+ Agregar rapido</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  dateTitle: {
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipText: { fontSize: 12 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 3,
  },
  googleSection: {
    marginVertical: 16,
  },
  googleTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  googleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  googleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  googleDot: { width: 8, height: 8, borderRadius: 999 },
  googleCardTitle: { fontSize: 14, fontWeight: '600' },
  googleCardMeta: { fontSize: 12, marginTop: 2 },
  quickButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  quickButtonText: { fontWeight: '700' },
})
