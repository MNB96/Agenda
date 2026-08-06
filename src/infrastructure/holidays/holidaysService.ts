import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Holiday, HolidayType } from '../../domain/holidays/types'

// Los feriados no cambian una vez publicados, así que no hace falta pedirlos seguido —
// una vez por semana es más que suficiente y evita golpear la API en cada apertura.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Shape cruda de api.argentinadatos.com, traducida a Holiday (dominio) antes de exponerse.
interface RawHoliday {
  fecha: string
  tipo: string
  nombre: string
}

const toHoliday = (raw: RawHoliday): Holiday => ({
  date: raw.fecha,
  type: raw.tipo as HolidayType,
  name: raw.nombre,
})

interface HolidaysCache {
  fetchedAt: number
  data: Holiday[]
}

// v2: el shape cacheado cambió (ver toHoliday); la clave vieja queda huérfana a propósito en vez de migrarse.
const cacheKey = (year: number) => `agenda:holidays-v2-${year}`

export const fetchHolidays = async (year: number): Promise<Holiday[]> => {
  const key = cacheKey(year)
  const raw = await AsyncStorage.getItem(key)
  let cached: HolidaysCache | null = null
  if (raw) {
    try {
      cached = JSON.parse(raw) as HolidaysCache
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.data
      }
    } catch {
      cached = null
    }
  }

  try {
    const response = await fetch(`https://api.argentinadatos.com/v1/feriados/${year}`)
    if (!response.ok) throw new Error(`status ${response.status}`)
    const raw = (await response.json()) as RawHoliday[]
    const data = raw.map(toHoliday)
    await AsyncStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data } satisfies HolidaysCache))
    return data
  } catch {
    // Sin red o la API falló: mejor mostrar el caché vencido que nada.
    return cached?.data ?? []
  }
}
