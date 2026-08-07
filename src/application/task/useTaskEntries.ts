import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { COMPLETED_PAGE_SIZE, useItems } from '../items/useItems'
import { scoreItemsForToday, type TodayBucket } from '../../domain/items/services/relevance'
import { useGoogleEvents } from '../calendar/useGoogleCalendar'
import type { CalendarEvent } from '../../domain/calendar/types'
import { useHolidays } from '../holidays/useHolidays'
import type { Holiday, HolidayType } from '../../domain/holidays/types'
import { ITEM_TYPE, type Item } from '../../domain/items'
import { useAppTheme } from '../../mobile/theme/useAppTheme'
import type { ThemeTokens } from '../../mobile/theme/tokens'
import { assertNever } from '../../utils/assertNever'

export type TaskSectionKey = 'overdue' | 'next' | 'important' | 'later' | 'completed'
type ActiveSectionKey = 'overdue' | 'next' | 'important' | 'later'

export interface LocalEntry {
  kind: 'local'
  section: TaskSectionKey
  itemId: string
  completed?: boolean
}

export interface GoogleEntry {
  kind: 'google'
  section: ActiveSectionKey
  id: string
  title: string
  subtitle: string
  secondary?: string
  color: string
  dateKey: string
  timestamp: number
}

export interface HolidayEntry {
  kind: 'holiday'
  section: ActiveSectionKey
  id: string
  title: string
  subtitle: string
  typeLabel: string
  color: string
  dateKey: string
  timestamp: number
}

type TaskEntry = LocalEntry | GoogleEntry | HolidayEntry

// Tipado contra HolidayType, no Record<string,...>: un tipo nuevo no compila si falta acá.
const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  inamovible: 'Feriado',
  trasladable: 'Feriado trasladable',
  puente: 'Día puente',
}

const holidayColor = (type: HolidayType, colors: ThemeTokens): string => {
  switch (type) {
    case 'inamovible':
      return colors.accentStrong
    case 'trasladable':
      return colors.accent
    case 'puente':
      return colors.textSecondary
    default:
      return assertNever(type)
  }
}

// Regla de urgencia compartida por eventos de Google y feriados (no Items locales, que usan
// su propia noción en relevance.ts).
const NEXT_WITHIN_DAYS = 2
const IMPORTANT_WITHIN_DAYS = 7

type UpcomingSection = Exclude<ActiveSectionKey, 'overdue'>

const classifyUpcomingSection = (dayDiff: number): UpcomingSection => {
  if (dayDiff <= NEXT_WITHIN_DAYS) return 'next'
  if (dayDiff <= IMPORTANT_WITHIN_DAYS) return 'important'
  return 'later'
}

const googleEventColor = (section: UpcomingSection, colors: ThemeTokens): string => {
  switch (section) {
    case 'next':
      return colors.primary
    case 'important':
      return colors.accent
    case 'later':
      return colors.cream
    default:
      return assertNever(section)
  }
}

// "Hoy"/"Manana" son relativos a hoy, no fechas — a partir de pasado mañana ya se muestra la
// fecha real porque relativo deja de ser útil de un vistazo.
const formatUpcomingWhen = (date: Date, dayDiff: number): string => {
  if (dayDiff === 0) return 'Hoy'
  if (dayDiff === 1) return 'Manana'
  return format(date, 'd MMM', { locale: es })
}

// Las tareas sin ninguna fecha van directo a su propia sección "Sin fecha" al final,
// en vez de mezclarse con las de "Más adelante" que sí tienen una fecha real.
const hasAnyDate = (item: Item): boolean => Boolean(item.startDate || item.deadline)

const mapLocalBucketToSection = (bucket: TodayBucket): ActiveSectionKey => {
  if (bucket === 'overdue') return 'overdue'
  if (bucket === 'later' || bucket === 'long_term_goal') return 'later'
  return 'next'
}

const mapGoogleEventToEntry = (event: CalendarEvent, colors: ThemeTokens): GoogleEntry | null => {
  const start = parseISO(event.startDateTime)
  const dayDiff = differenceInCalendarDays(startOfDay(start), startOfDay(new Date()))

  if (dayDiff < 0) {
    return null
  }

  const section = classifyUpcomingSection(dayDiff)
  const relativeWhen = formatUpcomingWhen(start, dayDiff)
  const when = event.allDay ? relativeWhen : `${relativeWhen} · ${format(start, 'HH:mm')}`

  return {
    kind: 'google',
    section,
    id: `google-${event.calendarId}-${event.id}`,
    title: event.title,
    subtitle: when,
    secondary: event.location,
    color: googleEventColor(section, colors),
    dateKey: format(start, 'yyyy-MM-dd'),
    timestamp: start.getTime(),
  }
}

const mapHolidayToEntry = (holiday: Holiday, colors: ThemeTokens): HolidayEntry | null => {
  const start = parseISO(holiday.date)
  const dayDiff = differenceInCalendarDays(startOfDay(start), startOfDay(new Date()))

  if (dayDiff < 0) {
    return null
  }

  const section = classifyUpcomingSection(dayDiff)

  return {
    kind: 'holiday',
    section,
    id: `holiday-${holiday.date}`,
    title: `🇦🇷 ${holiday.name}`,
    subtitle: formatUpcomingWhen(start, dayDiff),
    typeLabel: HOLIDAY_TYPE_LABEL[holiday.type],
    color: holidayColor(holiday.type, colors),
    dateKey: format(start, 'yyyy-MM-dd'),
    timestamp: start.getTime(),
  }
}

interface UseTaskEntriesResult {
  search: string
  setSearch: (value: string) => void
  activeCategory: 'all' | string
  setActiveCategory: (value: 'all' | string) => void
  sections: [TaskSectionKey, TaskEntry[]][]
  localItemsById: Map<string, Item>
  subtasksByParent: Map<string, Item[]>
  hasMoreCompleted: boolean
  isLoadingMoreCompleted: boolean
  loadMoreCompleted: () => void
  /** True while items/events/holidays are still loading, so the screen shows one spinner
   * instead of sections popping in one at a time. */
  isInitialLoading: boolean
}

// Pure data transformation (no JSX) combining local items, Google events and holidays into sections.
export const useTaskEntries = (): UseTaskEntriesResult => {
  const { items, isLoading: itemsLoading, dataUpdatedAt, loadMoreCompleted: fetchMoreCompleted } = useItems()
  const googleEvents = useGoogleEvents(new Date())
  const holidayYears = useMemo(() => {
    const now = new Date()
    return [now.getFullYear(), addDays(now, 35).getFullYear()]
  }, [])
  const holidays = useHolidays(holidayYears)
  const { colors } = useAppTheme()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all')

  const [hasMoreCompleted, setHasMoreCompleted] = useState(true)
  const [isLoadingMoreCompleted, setIsLoadingMoreCompleted] = useState(false)
  // Cualquier invalidación de la query principal (crear/editar/completar/borrar un item en
  // cualquier lado) vuelve a traer solo la primera página de completadas y descarta lo que
  // se había cargado de más — hay que asumir de nuevo que puede haber más para pedir.
  const [lastSeenDataUpdatedAt, setLastSeenDataUpdatedAt] = useState(dataUpdatedAt)
  if (dataUpdatedAt !== lastSeenDataUpdatedAt) {
    setLastSeenDataUpdatedAt(dataUpdatedAt)
    setHasMoreCompleted(true)
  }

  const loadMoreCompleted = () => {
    if (isLoadingMoreCompleted || !hasMoreCompleted) return
    setIsLoadingMoreCompleted(true)
    fetchMoreCompleted()
      .then((loadedCount) => setHasMoreCompleted(loadedCount === COMPLETED_PAGE_SIZE))
      .finally(() => setIsLoadingMoreCompleted(false))
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (item.status === 'completed') return false
      if (item.parentId) return false
      if (item.type === ITEM_TYPE.GOAL) return false
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
      if (item.type === ITEM_TYPE.GOAL) return false
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (!query) return true
      return [item.title, item.description, item.location, item.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [activeCategory, items, search])

  const datedItems = useMemo(() => filteredItems.filter(hasAnyDate), [filteredItems])
  const noDateItems = useMemo(() => filteredItems.filter((item) => !hasAnyDate(item)), [filteredItems])

  const scored = scoreItemsForToday(datedItems)

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Item[]>()
    items.filter(item => item.parentId).forEach(sub => {
      const existing = map.get(sub.parentId!) ?? []
      existing.push(sub)
      map.set(sub.parentId!, existing)
    })
    return map
  }, [items])

  const localItemsById = useMemo(
    () => new Map([...filteredItems, ...completedItems].map((item) => [item.id, item])),
    [filteredItems, completedItems],
  )

  const sections = useMemo(() => {
    const map: Record<ActiveSectionKey, TaskEntry[]> = {
      overdue: [],
      next: [],
      important: [],
      later: [],
    }

    scored.forEach((entry) => {
      const section = mapLocalBucketToSection(entry.bucket)
      map[section].push({ kind: 'local', section, itemId: entry.item.id })
    })

    // Los eventos que la app misma subió a Google Calendar vuelven a aparecer al
    // traerlos de vuelta — hay que excluirlos para no duplicar la tarjeta local.
    const linkedEventKeys = new Set(
      items
        .filter((item) => item.calendarLink)
        .map((item) => `${item.calendarLink!.calendarId}:${item.calendarLink!.eventId}`),
    )

    ;(googleEvents.data ?? [])
      .filter((event) => !linkedEventKeys.has(`${event.calendarId}:${event.id}`))
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

    ;(holidays.data ?? [])
      .map((holiday) => mapHolidayToEntry(holiday, colors))
      .filter((entry): entry is HolidayEntry => Boolean(entry))
      .forEach((entry) => {
        const query = search.trim().toLowerCase()
        if (query && !entry.title.toLowerCase().includes(query)) return
        map[entry.section].push(entry)
      })

    const itemById = new Map(filteredItems.map(item => [item.id, item]))

    // Dentro de un mismo día, las tareas se ordenan por horario (sin hora = primero),
    // en vez de quedar en el orden en que se agregaron/editaron.
    const getEntryTimestamp = (entry: TaskEntry): number => {
      if (entry.kind === 'local') {
        const it = itemById.get(entry.itemId)
        const dateStr = it?.startDate ?? it?.deadline
        if (!dateStr) return Number.MAX_SAFE_INTEGER
        return new Date(`${dateStr}T${it?.startTime ?? '00:00'}:00`).getTime()
      }
      return entry.timestamp
    }
    const byTimestamp = (a: TaskEntry, b: TaskEntry) => getEntryTimestamp(a) - getEntryTimestamp(b)

    const splitByDate = (bucket: ActiveSectionKey): [TaskSectionKey, TaskEntry[]][] => {
      const byDate = new Map<string, TaskEntry[]>()
      map[bucket].forEach(entry => {
        let key = 'zzz-sin-fecha'
        if (entry.kind === 'local') {
          const it = itemById.get(entry.itemId)
          key = it?.startDate ?? it?.deadline ?? 'zzz-sin-fecha'
        } else {
          key = entry.dateKey
        }
        if (!byDate.has(key)) byDate.set(key, [])
        byDate.get(key)!.push(entry)
      })
      return Array.from(byDate.entries())
        .sort(([dateKeyA], [dateKeyB]) => dateKeyA.localeCompare(dateKeyB))
        .map(([, entries]) => [bucket, [...entries].sort(byTimestamp)])
    }

    const result: [TaskSectionKey, TaskEntry[]][] = []
    if (map.overdue.length > 0) result.push(['overdue', [...map.overdue].sort(byTimestamp)])
    result.push(...splitByDate('next'))
    result.push(...splitByDate('important'))
    result.push(...splitByDate('later'))

    if (noDateItems.length > 0) {
      const noDateEntries: LocalEntry[] = noDateItems.map((item) => ({
        kind: 'local',
        section: 'later',
        itemId: item.id,
      }))
      result.push(['later', noDateEntries])
    }

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
  }, [colors, completedItems, filteredItems, googleEvents.data, holidays.data, items, scored, noDateItems, search])

  return {
    search,
    setSearch,
    activeCategory,
    setActiveCategory,
    sections,
    localItemsById,
    subtasksByParent,
    // Si la última página cargada vino corta (o el total nunca llegó a una página completa),
    // ya sabemos que no hay más sin necesidad de pedirlas.
    hasMoreCompleted: hasMoreCompleted && completedItems.length > 0 && completedItems.length % COMPLETED_PAGE_SIZE === 0,
    isLoadingMoreCompleted,
    loadMoreCompleted,
    isInitialLoading: itemsLoading || googleEvents.isLoading || holidays.isLoading,
  }
}
