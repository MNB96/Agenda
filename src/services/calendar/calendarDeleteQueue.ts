import AsyncStorage from '@react-native-async-storage/async-storage'

const QUEUE_KEY = '@agenda/calendar_delete_queue'
const MAX_ATTEMPTS = 5
// Backoff: 5min, 15min, 1h, 6h, 24h
const BACKOFF_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000]

export interface PendingCalendarDelete {
  id: string
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
  calendarId: string,
  eventId: string,
  itemTitle: string,
): Promise<void> {
  const queue = await load()
  if (queue.some((e) => e.eventId === eventId)) return // ya está en cola
  queue.push({
    id: `${Date.now()}-${eventId}`,
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
  deleteEvent: (calendarId: string, eventId: string) => Promise<void>,
  onExhausted: (itemTitle: string) => Promise<void>,
): Promise<void> {
  const queue = await load()
  if (queue.length === 0) return

  const now = Date.now()
  const eligible = queue.filter((e) => new Date(e.nextRetryAt).getTime() <= now)
  if (eligible.length === 0) return

  const updated = [...queue]

  for (const entry of eligible) {
    try {
      await deleteEvent(entry.calendarId, entry.eventId)
      const idx = updated.findIndex((e) => e.id === entry.id)
      if (idx !== -1) updated.splice(idx, 1)
    } catch {
      const idx = updated.findIndex((e) => e.id === entry.id)
      if (idx === -1) continue

      const next = { ...updated[idx], attemptCount: updated[idx].attemptCount + 1 }
      if (next.attemptCount >= MAX_ATTEMPTS) {
        updated.splice(idx, 1)
        await onExhausted(entry.itemTitle)
      } else {
        next.nextRetryAt = new Date(Date.now() + BACKOFF_MS[next.attemptCount]).toISOString()
        updated[idx] = next
      }
    }
    // Pausa entre requests para no saturar la API
    await new Promise<void>((r) => setTimeout(r, 500))
  }

  await persist(updated)
}
