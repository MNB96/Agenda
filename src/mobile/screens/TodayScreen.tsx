import { useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
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

type TodaySectionKey = 'next' | 'important' | 'later'

const sectionLabel: Record<TodaySectionKey, string> = {
  next: 'Proximo',
  important: 'Importante',
  later: 'Mas adelante',
}

const resolveSectionColor = (bucket: TodaySectionKey, colors: ThemeTokens): string => {
  if (bucket === 'important') {
    return colors.accent
  }
  if (bucket === 'later') {
    return colors.secondary
  }
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

interface LocalEntry {
  kind: 'local'
  section: TodaySectionKey
  itemId: string
}

interface GoogleEntry {
  kind: 'google'
  section: TodaySectionKey
  id: string
  title: string
  subtitle: string
  secondary?: string
  color: string
}

type TodayEntry = LocalEntry | GoogleEntry

const mapLocalBucketToSection = (bucket: TodayBucket): TodaySectionKey => {
  if (bucket === 'overdue' || bucket === 'important') {
    return 'important'
  }
  if (bucket === 'later' || bucket === 'long_term_goal') {
    return 'later'
  }
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

  const localItemsById = useMemo(
    () => new Map(filteredItems.map((entry) => [entry.id, entry])),
    [filteredItems],
  )

  const sections = useMemo(() => {
    const map: Record<TodaySectionKey, TodayEntry[]> = {
      next: [],
      important: [],
      later: [],
    }

    scored.forEach((entry) => {
      const section = mapLocalBucketToSection(entry.bucket)
      map[section].push({
        kind: 'local',
        section,
        itemId: entry.item.id,
      })
    })

    ;(googleEvents.data ?? [])
      .map((event) => mapGoogleEventToEntry(event, colors))
      .filter((entry): entry is GoogleEntry => Boolean(entry))
      .forEach((entry) => {
        const query = search.trim().toLowerCase()
        if (query) {
          const haystack = `${entry.title} ${entry.secondary ?? ''}`.toLowerCase()
          if (!haystack.includes(query)) {
            return
          }
        }
        map[entry.section].push(entry)
      })

    return (['next', 'important', 'later'] as TodaySectionKey[])
      .map((key) => [key, map[key]] as const)
      .filter(([, entries]) => entries.length > 0)
  }, [colors, googleEvents.data, scored, search])

  return (
    <View style={styles.container}>
      <Text style={styles.dateTitle}>{format(new Date(), 'EEEE d MMMM', { locale: es })}</Text>
      <TextInput
        placeholder="Buscar por titulo, categoria o ubicacion"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
        style={styles.filtersScroller}
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

      <FlatList
        data={sections}
        keyExtractor={([bucket]) => `section-${bucket}`}
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
        renderItem={({ item: [bucket, entries] }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: resolveSectionColor(bucket, colors) }]}>{sectionLabel[bucket]}</Text>
            {entries.map((entry) => {
              if (entry.kind === 'local') {
                const localItem = localItemsById.get(entry.itemId)
                if (!localItem) {
                  return null
                }
                return (
                  <ItemCard
                    key={localItem.id}
                    item={localItem}
                    categoryName={settings?.categories.find((category) => category.id === localItem.categoryId)?.name}
                    onToggle={async (item) => {
                      await toggleCompleted(item)
                    }}
                    onOpen={() => onOpenItemEditor(localItem.id)}
                  />
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
        )}
      />
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    dateTitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'capitalize',
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      color: colors.text,
    },
    filtersScroller: {
      marginBottom: 12,
      maxHeight: 44,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      paddingVertical: 2,
      paddingRight: 12,
    },
    filterChip: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      minHeight: 34,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 0,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
    filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
    section: { marginBottom: 8 },
    sectionTitle: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
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
      gap: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 9,
    },
    googleInlineContent: { flex: 1 },
    googleDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      marginTop: 6,
    },
    googleCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    googleCardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 72,
      paddingHorizontal: 28,
    },
    emptyIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
    emptySubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  })
