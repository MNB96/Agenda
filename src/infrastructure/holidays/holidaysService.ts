import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Holiday, HolidayType } from '../../domain/holidays/types'

// Los feriados no cambian una vez publicados, así que no hace falta pedirlos seguido —
// una vez por semana es más que suficiente y evita golpear la API en cada apertura.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Shape cruda tal cual la devuelve api.argentinadatos.com — se traduce a Holiday (dominio)
// antes de que el resto de la app la vea, en vez de que el shape del proveedor externo sea
// directamente el tipo de dominio.
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

// v2: el shape guardado cambió de {fecha, tipo, nombre} a {date, type, name} (ver toHoliday) —
// la clave vieja queda huérfana a propósito en vez de intentar migrarla, así una entrada
// cacheada con el shape anterior nunca se devuelve tal cual (parseISO(undefined) explotaba).
// Un feriado es dato público y barato de volver a pedir; no hace falta más que esto.
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
