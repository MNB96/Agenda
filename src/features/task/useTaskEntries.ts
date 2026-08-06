import { useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { COMPLETED_PAGE_SIZE, useItems } from '../items/useItems'
import { scoreItemsForToday, type TodayBucket } from '../../services/items/relevance'
import { useGoogleEvents } from '../calendar/useGoogleCalendar'
import type { CalendarEvent } from '../../domain/calendar/types'
import { useHolidays } from '../holidays/useHolidays'
import type { Holiday } from '../../domain/holidays/types'
import type { Item } from '../../domain/items/types'
import { useAppTheme } from '../../mobile/theme/useAppTheme'
import type { ThemeTokens } from '../../mobile/theme/tokens'

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

// "inamovible" es el feriado real; "trasladable" es un feriado que se movió a un lunes
// para hacer fin de semana largo; "puente" es un día no laborable extra, no un feriado en
// sí — se distinguen con una etiqueta y un color de intensidad decreciente.
const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  inamovible: 'Feriado',
  trasladable: 'Feriado trasladable',
  puente: 'Día puente',
}

// Las tareas sin ninguna fecha van directo a su propia sección "Sin fecha" al final,
// en vez de mezclarse con las de "Más adelante" que sí tienen una fecha real.
const hasAnyDate = (item: Item): boolean =>
  Boolean(item.startDate || item.deadline || item.dateWindow?.startDate || item.dateWindow?.endDate)

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

  const section: TaskSectionKey = dayDiff <= 2 ? 'next' : dayDiff <= 7 ? 'important' : 'later'
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
          ? format(start, 'd MMM', { locale: es })
          : `${format(start, 'd MMM', { locale: es })} · ${format(start, 'HH:mm')}`

  return {
    kind: 'google',
    section,
    id: `google-${event.calendarId}-${event.id}`,
    title: event.title,
    subtitle: when,
    secondary: event.location,
    color: section === 'important' ? colors.accent : section === 'later' ? colors.cream : colors.primary,
    dateKey: format(start, 'yyyy-MM-dd'),
    timestamp: start.getTime(),
  }
}

const mapHolidayToEntry = (holiday: Holiday, colors: ThemeTokens): HolidayEntry | null => {
  const start = parseISO(holiday.fecha)
  const dayDiff = differenceInCalendarDays(startOfDay(start), startOfDay(new Date()))

  if (dayDiff < 0) {
    return null
  }

  const section: ActiveSectionKey = dayDiff <= 2 ? 'next' : dayDiff <= 7 ? 'important' : 'later'
  const when = dayDiff === 0 ? 'Hoy' : dayDiff === 1 ? 'Manana' : format(start, 'd MMM', { locale: es })
  const color =
    holiday.tipo === 'inamovible'
      ? colors.accentStrong
      : holiday.tipo === 'trasladable'
        ? colors.accent
        : colors.textSecondary

  return {
    kind: 'holiday',
    section,
    id: `holiday-${holiday.fecha}`,
    title: `🇦🇷 ${holiday.nombre}`,
    subtitle: when,
    typeLabel: HOLIDAY_TYPE_LABEL[holiday.tipo] ?? holiday.tipo,
    color,
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
  subtaskMap: Map<string, { total: number; done: number }>
  hasMoreCompleted: boolean
  isLoadingMoreCompleted: boolean
  loadMoreCompleted: () => void
}

// Pulls together local items, Google Calendar events and public holidays into the sectioned,
// sorted list the Task screen renders — pure data transformation, no JSX, so it's testable
// without mounting the screen.
export const useTaskEntries = (): UseTaskEntriesResult => {
  const { items, dataUpdatedAt, loadMoreCompleted: fetchMoreCompleted } = useItems()
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

  const datedItems = useMemo(() => filteredItems.filter(hasAnyDate), [filteredItems])
  const noDateItems = useMemo(() => filteredItems.filter((item) => !hasAnyDate(item)), [filteredItems])

  const scored = scoreItemsForToday(datedItems)

  const subtaskMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    items.filter(item => item.parentId).forEach(sub => {
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
        .filter((item) => item.googleCalendarLink)
        .map((item) => `${item.googleCalendarLink!.calendarId}:${item.googleCalendarLink!.eventId}`),
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
    subtaskMap,
    // Si la última página cargada vino corta (o el total nunca llegó a una página completa),
    // ya sabemos que no hay más sin necesidad de pedirlas.
    hasMoreCompleted: hasMoreCompleted && completedItems.length > 0 && completedItems.length % COMPLETED_PAGE_SIZE === 0,
    isLoadingMoreCompleted,
    loadMoreCompleted,
  }
}
