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
import type { NewItemInput } from '../../domain/items/types'

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
    const year = dm[2] ? Number(dm[2].length === 2 ? `20${dm[2]}` : dm[2]) : now.getFullYear()
    const parsed = new Date(year, Number(dm[1]) - 1, Number(dm[0]))
    if (isValid(parsed)) {
      return parsed
    }
  }

  const monthRegex = new RegExp(`(\\d{1,2})\\s+de?\\s*(${Object.keys(months).join('|')})(?:\\s+(\\d{4}))?`)
  const monthMatch = text.match(monthRegex)
  if (monthMatch) {
    const day = Number(monthMatch[1])
    const month = months[monthMatch[2]]
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear()
    const parsed = new Date(year, month - 1, day)
    if (isValid(parsed)) {
      return parsed
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

  if (text.includes('septiembre')) {
    return new Date(now.getFullYear(), 8, 1)
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

  const windowMatch =
    lower.match(/abre\s+(.+?)\s+y\s+cierra\s+(.+)/) ?? lower.match(/de\s+(.+?)\s+a\s+(.+)/)

  if (windowMatch) {
    const startDate = parseDatePiece(windowMatch[1], now)
    const endDate = parseDatePiece(windowMatch[2], now)
    inferred.dateWindow = {
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    }
    hints.push('Ventana de fechas detectada')
  }

  const deadlineMatch = lower.match(/(antes de|hasta)\s+(.+)/)
  if (deadlineMatch) {
    const parsedDeadline = parseDatePiece(deadlineMatch[2], now)
    if (parsedDeadline) {
      inferred.deadline = format(parsedDeadline, 'yyyy-MM-dd')
      hints.push('Fecha limite detectada')
    }
  }

  if (!inferred.deadline && !inferred.dateWindow) {
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

  const goalMatch = lower.match(/(\d+)\s*\/\s*(\d+)/)
  if (goalMatch) {
    inferred.goalConfig = {
      currentValue: Number(goalMatch[1]),
      targetValue: Number(goalMatch[2]),
      isBinary: false,
    }
    hints.push('Meta con progreso detectada')
  }

  if (!inferred.goalConfig && /(meta|objetivo|leer\s+\d+|aprobar\s+\d+)/.test(lower)) {
    const target = Number(lower.match(/(\d+)/)?.[1] ?? '1')
    inferred.goalConfig = {
      currentValue: 0,
      targetValue: Math.max(target, 1),
      isBinary: false,
    }
    hints.push('Meta detectada')
  }

  let detectedType = 'Tarea'
  if (inferred.dateWindow?.startDate || inferred.dateWindow?.endDate) {
    detectedType = 'Ventana de fecha'
  } else if (inferred.goalConfig) {
    detectedType = 'Meta'
  } else if (inferred.startDate && inferred.startTime) {
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