import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { calendarRepository, itemRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { resolveEventDateTimes } from '../../domain/items/services/eventDateTimes'
import { updateItem } from '../../domain/items/factories/itemFactory'
import { useSettings } from '../settings/useSettings'
import { useItems } from '../items/useItems'
import type { Item } from '../../domain/items/types'

export const useCalendarSyncRecovery = (
  accessToken: string | null,
  markUnauthorized: () => void,
) => {
  const isProcessing = useRef(false)
  const { applySyncedItems } = useItems()
  const { data: settings } = useSettings()
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const run = useCallback(async (token: string) => {
    if (isProcessing.current) return
    isProcessing.current = true
    try {
      const items = await itemRepository.list()
      // No basta con mirar calendarSyncPending: tareas creadas antes de que existiera esa
      // marca (o cuando algo falló en silencio) quedaron huérfanas para siempre, sin la
      // marca puesta y sin link. Cualquier tarea con fecha que quiera sincronizar y todavía
      // no tenga el link de Google es candidata — tenga o no la marca — además de las que
      // sí tienen link pero están marcadas pendientes (reintento de una actualización fallida).
      const pending = items.filter(
        (i) =>
          (i.startDate || i.startTime) &&
          i.syncToCalendar !== false &&
          (i.calendarSyncPending || !i.calendarLink),
      )
      if (pending.length === 0) return

      const calendarId = settingsRef.current?.selectedCalendarIds[0] ?? 'primary'
      const syncedItems: Item[] = []

      for (const item of pending) {
        const dateTimes = resolveEventDateTimes(item)
        if (!dateTimes) continue

        try {
          let updated = item
          if (item.calendarLink) {
            await calendarRepository.updateEvent(
              token,
              item.calendarLink.calendarId,
              item.calendarLink.eventId,
              {
                summary: item.title,
                description: item.description,
                location: item.location,
                startDateTime: dateTimes.start,
                endDateTime: dateTimes.end,
                allDay: dateTimes.allDay,
              },
            )
            updated = updateItem(item, {
              calendarSyncPending: undefined,
              calendarLink: {
                ...item.calendarLink,
                lastSyncedAt: new Date().toISOString(),
              },
            })
          } else {
            const created = await calendarRepository.createEvent(token, calendarId, {
              summary: item.title,
              description: item.description,
              location: item.location,
              startDateTime: dateTimes.start,
              endDateTime: dateTimes.end,
              allDay: dateTimes.allDay,
            })
            updated = updateItem(item, {
              calendarSyncPending: undefined,
              calendarLink: {
                calendarId,
                eventId: created.eventId,
                origin: 'app',
                lastSyncedAt: new Date().toISOString(),
              },
            })
          }
          syncedItems.push(updated)
        } catch (error) {
          if (isGoogleCalendarAuthError(error)) {
            markUnauthorized()
            break
          }
          // Error de red u otro: se reintentará en el próximo foreground
        }
        await new Promise<void>((r) => setTimeout(r, 400))
      }

      if (syncedItems.length > 0) {
        await applySyncedItems(syncedItems)
      }
    } finally {
      isProcessing.current = false
    }
  }, [markUnauthorized, applySyncedItems])

  useEffect(() => {
    if (accessToken) void run(accessToken)

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && accessToken) void run(accessToken)
    })
    return () => sub.remove()
  }, [accessToken, run])
}
