import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { calendarRepository, itemRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../providers/calendar/errors'
import { resolveEventDateTimes, updateItem } from '../../features/items/itemService'
import { useSettings } from '../../features/settings/useSettings'

const ITEMS_KEY = ['items']

export const useCalendarSyncRecovery = (
  accessToken: string | null,
  markUnauthorized: () => void,
) => {
  const isProcessing = useRef(false)
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const run = async (token: string) => {
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
          i.syncToGoogleCalendar !== false &&
          (i.calendarSyncPending || !i.googleCalendarLink),
      )
      if (pending.length === 0) return

      const calendarId = settingsRef.current?.selectedGoogleCalendarIds[0] ?? 'primary'
      let didUpdate = false

      for (const item of pending) {
        const dateTimes = resolveEventDateTimes(item)
        if (!dateTimes) continue

        try {
          let updated = item
          if (item.googleCalendarLink) {
            await calendarRepository.updateEvent(
              token,
              item.googleCalendarLink.calendarId,
              item.googleCalendarLink.eventId,
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
              googleCalendarLink: {
                ...item.googleCalendarLink,
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
              googleCalendarLink: {
                calendarId,
                eventId: created.eventId,
                source: 'app',
                lastSyncedAt: new Date().toISOString(),
              },
            })
          }
          await itemRepository.save(updated)
          didUpdate = true
        } catch (error) {
          if (isGoogleCalendarAuthError(error)) {
            markUnauthorized()
            break
          }
          // Error de red u otro: se reintentará en el próximo foreground
        }
        await new Promise<void>((r) => setTimeout(r, 400))
      }

      if (didUpdate) {
        await queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      }
    } finally {
      isProcessing.current = false
    }
  }

  useEffect(() => {
    if (accessToken) void run(accessToken)

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && accessToken) void run(accessToken)
    })
    return () => sub.remove()
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps
}
