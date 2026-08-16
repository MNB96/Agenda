import {
  addDays,
  addMonths,
  endOfYear,
  format,
  isValid,
  nextDay,
  parse,
  startOfDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import type { NewItemInput } from '../Item.inputs'
import { isValidCalendarDate } from '../../../utils/calendarDate'

const months: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

const weekdays: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 0,
}

interface ParsedQuickInput {
  normalizedTitle: string
  inferred: NewItemInput
  detectedType: string
  hints: string[]
}

const parseDatePiece = (raw: string, now: Date): Date | undefined => {
  const text = raw.trim().toLowerCase()

  if (text.includes('hoy')) {
    return startOfDay(now)
  }
  if (text.includes('manana') || text.includes('mañana')) {
    return startOfDay(addDays(now, 1))
  }

  const dm = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)?.slice(1)
  if (dm) {
    const day = Number(dm[0])
    const month = Number(dm[1])
    const year = dm[2] ? Number(dm[2].length === 2 ? `20${dm[2]}` : dm[2]) : now.getFullYear()
    // isValid() alone isn't enough — new Date(2026, 1, 31) doesn't fail, it silently becomes
    // March 3rd. Checking the constructed date's own fields against the inputs catches that.
    if (isValidCalendarDate(year, month, day)) {
      return new Date(year, month - 1, day)
    }
  }

  const monthRegex = new RegExp(`(\\d{1,2})\\s+de?\\s*(${Object.keys(months).join('|')})(?:\\s+(\\d{4}))?`)
  const monthMatch = text.match(monthRegex)
  if (monthMatch) {
    const day = Number(monthMatch[1])
    const month = months[monthMatch[2]]
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear()
    if (isValidCalendarDate(year, month, day)) {
      return new Date(year, month - 1, day)
    }
  }

  const weekDayMatch = Object.keys(weekdays).find((dayName) => text.includes(dayName))
  if (weekDayMatch) {
    return startOfDay(nextDay(now, weekdays[weekDayMatch]))
  }

  if (
    text.includes('fin de ano') ||
    text.includes('fin de año') ||
    text.includes('terminar el ano') ||
    text.includes('terminar el año')
  ) {
    return endOfYear(now)
  }

  const monthOnlyEntry = Object.entries(months).find(([name]) => text.includes(name))
  if (monthOnlyEntry) {
    const [, monthNumber] = monthOnlyEntry
    return new Date(now.getFullYear(), monthNumber - 1, 1)
  }

  if (text.includes('mes que viene')) {
    return startOfDay(addMonths(now, 1))
  }

  const parsed = parse(text, 'd/M/yyyy', now, { locale: es })
  if (isValid(parsed)) {
    return startOfDay(parsed)
  }

  return undefined
}

const parseTime = (text: string): string | undefined => {
  const match = text.match(/(\d{1,2})[:.](\d{2})/)
  if (!match) {
    return undefined
  }
  const hours = String(Number(match[1])).padStart(2, '0')
  const mins = String(Number(match[2])).padStart(2, '0')
  if (Number(hours) > 23 || Number(mins) > 59) {
    return undefined
  }
  return `${hours}:${mins}`
}

export const parseQuickInput = (text: string, now = new Date()): ParsedQuickInput => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const lower = normalized.toLowerCase()
  const hints: string[] = []

  const inferred: NewItemInput = {
    title: normalized,
  }

  const deadlineMatch = lower.match(/(antes de|hasta)\s+(.+)/)
  if (deadlineMatch) {
    const parsedDeadline = parseDatePiece(deadlineMatch[2], now)
    if (parsedDeadline) {
      inferred.deadline = format(parsedDeadline, 'yyyy-MM-dd')
      hints.push('Fecha limite detectada')
    }
  }

  if (!inferred.deadline) {
    const directDate = parseDatePiece(lower, now)
    if (directDate) {
      inferred.startDate = format(directDate, 'yyyy-MM-dd')
      hints.push('Fecha detectada')
    }
  }

  const parsedTime = parseTime(lower)
  if (parsedTime) {
    inferred.startTime = parsedTime
    hints.push('Hora detectada')
  }

  const locationMatch = lower.match(/(?:en|@)\s+([a-zA-Z0-9\s]+)$/)
  if (locationMatch) {
    inferred.location = locationMatch[1].trim()
    hints.push('Ubicacion detectada')
  }

  let detectedType = 'Tarea'
  if (inferred.startDate && inferred.startTime) {
    detectedType = 'Evento'
  } else if (inferred.deadline) {
    detectedType = 'Deadline'
  }

  return {
    normalizedTitle: normalized,
    inferred,
    detectedType,
    hints,
  }
}