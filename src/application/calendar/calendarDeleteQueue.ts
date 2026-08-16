import AsyncStorage from '@react-native-async-storage/async-storage'

const QUEUE_KEY = '@agenda/calendar_delete_queue'
const MAX_ATTEMPTS = 5
// Backoff: 5min, 15min, 1h, 6h, 24h
const BACKOFF_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]

// Lanzado por el caller para sacar una entrada de la cola sin quemar reintentos
// (ej: error de auth donde reintentar no tiene sentido).
export class PermanentCalendarDeleteError extends Error {
  constructor(readonly notify = true) {
    super('Permanent delete failure — do not retry')
    this.name = 'PermanentCalendarDeleteError'
  }
}

const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused')
  )
}

interface PendingCalendarDelete {
  id: string
  kind: 'event' | 'task'
  calendarId: string
  eventId: string
  itemTitle: string
  attemptCount: number
  nextRetryAt: string
  addedAt: string
}

async function load(): Promise<PendingCalendarDelete[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as PendingCalendarDelete[]) : []
  } catch {
    return []
  }
}

async function persist(queue: PendingCalendarDelete[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function enqueueDelete(
  kind: 'event' | 'task',
  calendarId: string,
  eventId: string,
  itemTitle: string,
): Promise<void> {
  const queue = await load()
  if (queue.some((entry) => entry.eventId === eventId)) return // ya está en cola
  queue.push({
    id: `${Date.now()}-${eventId}`,
    kind,
    calendarId,
    eventId,
    itemTitle,
    attemptCount: 0,
    nextRetryAt: new Date(Date.now() + BACKOFF_MS[0]).toISOString(),
    addedAt: new Date().toISOString(),
  })
  await persist(queue)
}

export async function processQueue(
  deleteResource: (kind: 'event' | 'task', calendarId: string, eventId: string) => Promise<void>,
  onExhausted: (itemTitle: string) => Promise<void>,
): Promise<void> {
  const queue = await load()
  if (queue.length === 0) return

  const now = Date.now()
  const eligible = queue.filter((entry) => new Date(entry.nextRetryAt).getTime() <= now)
  if (eligible.length === 0) return

  const updated = [...queue]

  for (const entry of eligible) {
    try {
      await deleteResource(entry.kind, entry.calendarId, entry.eventId)
      const idx = updated.findIndex((e) => e.id === entry.id)
      if (idx !== -1) updated.splice(idx, 1)
    } catch (error) {
      const idx = updated.findIndex((e) => e.id === entry.id)
      if (idx === -1) continue

      if (error instanceof PermanentCalendarDeleteError) {
        // Auth u otro error irrecuperable: sacar de la cola sin quemar reintentos.
        updated.splice(idx, 1)
        if (error.notify) await onExhausted(entry.itemTitle)
        continue
      }

      if (isNetworkError(error)) {
        // Sin red: no quemar el reintento, el backoff ya programado alcanza.
        continue
      }

      const next = { ...updated[idx], attemptCount: updated[idx].attemptCount + 1 }
      if (next.attemptCount >= MAX_ATTEMPTS) {
        updated.splice(idx, 1)
        await onExhausted(entry.itemTitle)
      } else {
        next.nextRetryAt = new Date(Date.now() + (BACKOFF_MS[next.attemptCount] ?? BACKOFF_MS[BACKOFF_MS.length - 1])).toISOString()
        updated[idx] = next
      }
    }
    // Pausa entre requests para no saturar la API
    await new Promise<void>((r) => setTimeout(r, 500))
  }

  await persist(updated)
}
