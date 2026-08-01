import { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { differenceInCalendarDays, differenceInHours, format, isToday, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react-native'
import { ItemCard } from '../components/ItemCard'
import { useItems } from '../../features/items/useItems'
import { useSettings } from '../../features/settings/useSettings'
import { scoreItemsForToday, type TodayBucket } from '../../services/items/relevance'
import { useGoogleEvents } from '../../features/calendar/useGoogleCalendar'
import type { CalendarEvent } from '../../domain/calendar/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

type TodaySectionKey = 'overdue' | 'next' | 'important' | 'later' | 'completed'

const sectionLabel: Record<TodaySectionKey, string> = {
  overdue: 'Vencidas',
  next: 'Proximo',
  important: 'Importante',
  later: 'Mas adelante',
  completed: 'Completadas',
}

const resolveSectionColor = (bucket: TodaySectionKey, colors: ThemeTokens): string => {
  if (bucket === 'overdue') return colors.danger
  if (bucket === 'important') return colors.accent
  if (bucket === 'later') return colors.secondary
  if (bucket === 'completed') return colors.textMuted
  return colors.primary
}

const resolveCategoryChip = (categoryId: string, colors: ThemeTokens) => {
  if (categoryId === 'facultad' || categoryId === 'salud') {
    return { backgroundColor: colors.secondarySoft, borderColor: colors.secondary, textColor: colors.text }
  }
  if (categoryId === 'trabajo' || categoryId === 'compras') {
    return { backgroundColor: colors.creamSoft, borderColor: colors.cream, textColor: colors.text }
  }
  if (categoryId === 'casa') {
    return { backgroundColor: colors.primarySoft, borderColor: colors.primary, textColor: colors.text }
  }
  return { backgroundColor: '#FFFFFF', borderColor: colors.borderStrong, textColor: colors.textSecondary }
}

const resolveDarkChipText = (
  categoryId: 'all' | string,
  isActive: boolean,
  colors: ThemeTokens,
): string => {
  if (isActive) {
    return colors.onPrimary
  }
  if (categoryId === 'trabajo' || categoryId === 'compras') {
    return '#263238'
  }
  if (categoryId === 'facultad' || categoryId === 'salud') {
    return colors.secondary
  }
  if (categoryId === 'casa') {
    return colors.primarySoft
  }
  return colors.textSecondary
}

const formatOverdueDuration = (dateStr: string): string => {
  const past = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const hours = differenceInHours(now, past)
  if (hours < 24) return hours <= 1 ? 'hace 1 hora' : `hace ${hours} horas`
  const days = differenceInCalendarDays(startOfDay(now), startOfDay(past))
  if (days === 1) return 'hace 1 día'
  if (days < 7) return `hace ${days} días`
  if (days < 14) return 'hace 1 semana'
  if (days < 21) return 'hace 2 semanas'
  if (days < 28) return 'hace 3 semanas'
  if (days < 60) return 'hace 1 mes'
  return `hace ${Math.floor(days / 30)} meses`
}

interface LocalEntry {
  kind: 'local'
  section: TodaySectionKey
  itemId: string
  completed?: boolean
}

interface GoogleEntry {
  kind: 'google'
  section: ActiveSectionKey
  id: string
  title: string
  subtitle: string
  secondary?: string
  color: string
}

type TodayEntry = LocalEntry | GoogleEntry

type ActiveSectionKey = 'overdue' | 'next' | 'important' | 'later'

const mapLocalBucketToSection = (bucket: TodayBucket): ActiveSectionKey => {
  if (bucket === 'overdue') return 'overdue'
  if (bucket === 'important') return 'important'
  if (bucket === 'later' || bucket === 'long_term_goal') return 'later'
  return 'next'
}

const mapGoogleEventToEntry = (event: CalendarEvent, colors: ThemeTokens): GoogleEntry | null => {
  const start = parseISO(event.startDateTime)
  const dayDiff = differenceInCalendarDays(startOfDay(start), startOfDay(new Date()))

  if (dayDiff < 0) {
    return null
  }

  const section: TodaySectionKey = dayDiff <= 2 ? 'next' : dayDiff <= 7 ? 'important' : 'later'
  const when =
    dayDiff === 0
      ? event.allDay
        ? 'Hoy'
        : `Hoy · ${format(start, 'HH:mm')}`
      : dayDiff === 1
        ? event.allDay
          ? 'Manana'
          : `Manana · ${format(start, 'HH:mm')}`
        : event.allDay
          ? format(start, 'EEE d MMM', { locale: es })
          : `${format(start, 'EEE d MMM', { locale: es })} · ${format(start, 'HH:mm')}`

  return {
    kind: 'google',
    section,
    id: `google-${event.calendarId}-${event.id}`,
    title: event.title,
    subtitle: when,
    secondary: event.location,
    color: section === 'important' ? colors.accent : section === 'later' ? colors.cream : colors.primary,
  }
}

interface TodayScreenProps {
  onOpenItemEditor: (itemId: string) => void
}

export const TodayScreen = ({ onOpenItemEditor }: TodayScreenProps) => {
  const { items, toggleCompleted } = useItems()
  const { data: settings } = useSettings()
  const googleEvents = useGoogleEvents(new Date())
  const { colors, isDark } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (item.status === 'completed') return false
      if (item.parentId) return false
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (!query) return true
      return [item.title, item.description, item.location, item.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [activeCategory, items, search])

  const completedItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (item.status !== 'completed') return false
      if (item.parentId) return false
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (!query) return true
      return [item.title, item.description, item.location, item.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [activeCategory, items, search])

  const scored = scoreItemsForToday(filteredItems)

  const subtaskMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    items.filter(i => i.parentId).forEach(sub => {
      const existing = map.get(sub.parentId!) ?? { total: 0, done: 0 }
      map.set(sub.parentId!, {
        total: existing.total + 1,
        done: existing.done + (sub.status === 'completed' ? 1 : 0),
      })
    })
    return map
  }, [items])

  const localItemsById = useMemo(
    () => new Map([...filteredItems, ...completedItems].map((item) => [item.id, item])),
    [filteredItems, completedItems],
  )

  const sections = useMemo(() => {
    const map: Record<ActiveSectionKey, TodayEntry[]> = {
      overdue: [],
      next: [],
      important: [],
      later: [],
    }

    scored.forEach((entry) => {
      const section = mapLocalBucketToSection(entry.bucket)
      map[section].push({ kind: 'local', section, itemId: entry.item.id })
    })

    ;(googleEvents.data ?? [])
      .map((event) => mapGoogleEventToEntry(event, colors))
      .filter((entry): entry is GoogleEntry => Boolean(entry))
      .forEach((entry) => {
        const query = search.trim().toLowerCase()
        if (query) {
          const haystack = `${entry.title} ${entry.secondary ?? ''}`.toLowerCase()
          if (!haystack.includes(query)) return
        }
        map[entry.section].push(entry)
      })

    const itemById = new Map(filteredItems.map(i => [i.id, i]))

    const splitByDate = (bucket: ActiveSectionKey): [TodaySectionKey, TodayEntry[]][] => {
      const byDate = new Map<string, TodayEntry[]>()
      map[bucket].forEach(entry => {
        let key = 'zzz-sin-fecha'
        if (entry.kind === 'local') {
          const it = itemById.get(entry.itemId)
          key = it?.startDate ?? it?.deadline ?? 'zzz-sin-fecha'
        }
        if (!byDate.has(key)) byDate.set(key, [])
        byDate.get(key)!.push(entry)
      })
      return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, entries]) => [bucket, entries])
    }

    const result: [TodaySectionKey, TodayEntry[]][] = []
    if (map.overdue.length > 0) result.push(['overdue', map.overdue])
    result.push(...splitByDate('next'))
    if (map.important.length > 0) result.push(['important', map.important])
    result.push(...splitByDate('later'))

    if (completedItems.length > 0) {
      const completedEntries: LocalEntry[] = completedItems.map((item) => ({
        kind: 'local',
        section: 'completed',
        itemId: item.id,
        completed: true,
      }))
      result.push(['completed', completedEntries])
    }

    return result
  }, [colors, completedItems, filteredItems, googleEvents.data, scored, search])

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar por titulo, categoria o ubicacion"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      <View style={styles.filtersWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        <Pressable onPress={() => setActiveCategory('all')} style={[styles.filterChip, activeCategory === 'all' && styles.filterChipActive]}>
          <Text
            style={[
              styles.filterChipText,
              isDark && { color: resolveDarkChipText('all', activeCategory === 'all', colors) },
              activeCategory === 'all' && styles.filterChipTextActive,
            ]}
          >
            Todo
          </Text>
        </Pressable>
        {(settings?.categories ?? []).map((category) => {
          const isCategoryActive = activeCategory === category.id
          const chip = resolveCategoryChip(category.id, colors)
          const darkChipBackground =
            isDark
              ? category.id === 'personal'
                ? colors.surfaceSecondary
                : category.id === 'facultad' || category.id === 'salud'
                  ? 'rgba(167, 219, 216, 0.25)'
                  : category.id === 'trabajo' || category.id === 'compras'
                    ? 'rgba(224, 228, 204, 0.9)'
                    : 'rgba(105, 210, 231, 0.25)'
              : chip.backgroundColor

          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveCategory(category.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: darkChipBackground,
                  borderColor: isDark && category.id === 'personal' ? colors.borderStrong : chip.borderColor,
                },
                isCategoryActive && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isDark
                      ? resolveDarkChipText(category.id, isCategoryActive, colors)
                      : chip.textColor,
                  },
                  isCategoryActive && styles.filterChipTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
      </View>

      <FlatList
        data={sections}
        keyExtractor={([bucket], index) => `section-${bucket}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <CalendarDays size={18} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Todo tranquilo por ahora</Text>
            <Text style={styles.emptySubtitle}>No tenes nada pendiente para hoy.</Text>
          </View>
        }
        renderItem={({ item: [bucket, entries] }) => {
          const label = (() => {
            if (bucket === 'overdue' || bucket === 'important' || bucket === 'completed') {
              return sectionLabel[bucket]
            }
            const firstLocal = entries.find((e): e is LocalEntry => e.kind === 'local')
            if (firstLocal) {
              const it = localItemsById.get(firstLocal.itemId)
              const dateStr = it?.startDate ?? it?.deadline
              if (dateStr) {
                const d = new Date(dateStr + 'T00:00:00')
                return isToday(d) ? 'HOY' : format(d, "d 'de' MMMM", { locale: es })
              }
              return 'Sin fecha'
            }
            const firstGoogle = entries.find((e): e is GoogleEntry => e.kind === 'google')
            if (firstGoogle) return firstGoogle.subtitle
            return sectionLabel[bucket]
          })()
          return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: resolveSectionColor(bucket, colors) }]}>{label}</Text>
            {entries.map((entry) => {
              if (entry.kind === 'local') {
                const localItem = localItemsById.get(entry.itemId)
                if (!localItem) {
                  return null
                }
                const overdueDeadlineLabel = (() => {
                  if (bucket !== 'overdue' || !localItem.deadline) return undefined
                  const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(localItem.deadline + 'T00:00:00')))
                  return days > 0 ? `Venció ${formatOverdueDuration(localItem.deadline)}` : undefined
                })()
                const overdueLabel = (() => {
                  if (bucket !== 'overdue' || !localItem.startDate) return undefined
                  const days = differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(localItem.startDate + 'T00:00:00')))
                  return days > 0 ? formatOverdueDuration(localItem.startDate) : undefined
                })()
                const subtaskInfo = subtaskMap.get(localItem.id)
                const isActiveItem = localItem.status !== 'completed'
                const card = (
                  <ItemCard
                    key={localItem.id}
                    item={localItem}
                    overdueDeadlineLabel={overdueDeadlineLabel}
                    overdueLabel={overdueLabel}
                    subtaskTotal={subtaskInfo?.total}
                    subtaskDone={subtaskInfo?.done}
                    onToggle={async (item) => {
                      await toggleCompleted(item)
                    }}
                    onOpen={() => onOpenItemEditor(localItem.id)}
                  />
                )
                if (!isActiveItem) return card
                return (
                  <Swipeable
                    key={localItem.id}
                    friction={2}
                    rightThreshold={80}
                    renderRightActions={() => (
                      <View style={styles.swipeCompleteAction}>
                        <Text style={styles.swipeCompleteText}>✓</Text>
                      </View>
                    )}
                    onSwipeableOpen={(dir) => {
                      if (dir === 'right') void toggleCompleted(localItem)
                    }}
                  >
                    {card}
                  </Swipeable>
                )
              }

              return (
                <View key={entry.id} style={styles.googleInlineRow}>
                  <View style={[styles.googleDot, { backgroundColor: entry.color }]} />
                  <View style={styles.googleInlineContent}>
                    <Text style={styles.googleCardTitle}>{entry.title}</Text>
                    <Text style={styles.googleCardMeta}>{entry.subtitle}</Text>
                    {entry.secondary ? <Text style={styles.googleCardMeta}>{entry.secondary}</Text> : null}
                  </View>
                </View>
              )
            })}
          </View>
          )
        }}
      />
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 12,
      color: colors.text,
      fontSize: 15,
    },
    filtersWrapper: {
      marginBottom: 14,
      paddingVertical: 4,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingRight: 12,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      minHeight: 36,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 0,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
    filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
    section: { marginBottom: 10 },
    sectionTitle: {
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 3,
      fontWeight: '700',
    },
    listContent: {
      paddingBottom: 104,
      minHeight: '78%',
    },
    googleInlineRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
    },
    googleInlineContent: { flex: 1 },
    googleDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginTop: 5,
    },
    googleCardTitle: { fontSize: 17, fontWeight: '500', color: colors.text },
    googleCardMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 72,
      paddingHorizontal: 28,
    },
    emptyIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    emptySubtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' },
    swipeCompleteAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      width: 72,
    },
    swipeCompleteText: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
    },
  })
