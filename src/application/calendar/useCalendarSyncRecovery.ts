import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { calendarRepository, itemRepository, taskRepository } from '../../app/container'
import { syncItemToCalendar, resolveTargetKind } from './itemCalendarSync'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { useSettings } from '../settings/useSettings'
import { useItems } from '../items/useItems'
import { Item, type CalendarLinkInput } from '../../domain/items'
import type { CalendarEvent } from '../../domain/calendar/types'

const DAY_MS = 24 * 60 * 60 * 1000
const normalizeTitle = (title: string) => title.trim().toLowerCase()

// Busca un evento/task ya existente en Google con el mismo título y fecha, para no crear un
// duplicado de algo que ya se había sincronizado antes de perder el link localmente.
const findExistingLink = (
  item: Item,
  existingEvents: CalendarEvent[],
  existingTasks: { taskId: string; title: string; dueDate?: string }[],
): Omit<CalendarLinkInput, 'lastSyncedAt'> | undefined => {
  const title = normalizeTitle(item.title)
  if (resolveTargetKind(item) === 'task') {
    const dueDate = item.deadline ?? item.startDate
    const match = existingTasks.find((t) => normalizeTitle(t.title) === title && t.dueDate === dueDate)
    return match ? { calendarId: '@default', eventId: match.taskId, origin: 'app', kind: 'task' } : undefined
  }
  const match = existingEvents.find((e) => normalizeTitle(e.title) === title && e.startDateTime.slice(0, 10) === item.startDate)
  return match ? { calendarId: match.calendarId, eventId: match.id, origin: 'app', kind: 'event' } : undefined
}

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
      // No alcanza con calendarSyncPending: tareas de antes de esa marca quedaron sin link
      // y sin marca — cualquier tarea con fecha y sin link de Google es candidata también.
      const pending = items.filter(
        (i) =>
          (i.startDate || i.startTime || i.deadline) &&
          i.syncToCalendar !== false &&
          (i.calendarSyncPending || !i.calendarLink),
      )
      if (pending.length === 0) return

      const calendarId = settingsRef.current?.selectedCalendarIds[0] ?? 'primary'
      const calendarIds = settingsRef.current?.selectedCalendarIds.length ? settingsRef.current.selectedCalendarIds : ['primary']

      const relevantDates = pending.flatMap((i) => [i.startDate, i.deadline].filter((d): d is string => Boolean(d)))
      const now = new Date()
      const timeMin = relevantDates.length ? new Date(Math.min(...relevantDates.map((d) => new Date(d).getTime()))) : now
      const timeMax = relevantDates.length ? new Date(Math.max(...relevantDates.map((d) => new Date(d).getTime())) + DAY_MS) : now

      let existingEvents: CalendarEvent[]
      let existingTasks: { taskId: string; title: string; dueDate?: string }[]
      try {
        ;[existingEvents, existingTasks] = await Promise.all([
          calendarRepository.listEvents(token, calendarIds, { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() }),
          taskRepository.listTasks(token),
        ])
      } catch (error) {
        // Sin poder confirmar qué ya existe, mejor no sincronizar esta vuelta que arriesgar duplicados.
        if (isGoogleCalendarAuthError(error)) markUnauthorized()
        return
      }

      // Se aplica por item, no al final del lote: si no, el evento recién creado aparece
      // duplicado (como entrada "google") hasta que termina todo el lote.
      for (const item of pending) {
        let authFailed = false
        const existingLink = findExistingLink(item, existingEvents, existingTasks)
        const updated = existingLink
          ? Item.linkCalendar(item, existingLink)
          : await syncItemToCalendar(item, {
              accessToken: token,
              calendarId,
              markUnauthorized: () => {
                authFailed = true
                markUnauthorized()
              },
            })
        if (authFailed) break
        if (!updated.calendarSyncPending) await applySyncedItems([updated])
        await new Promise<void>((r) => setTimeout(r, 400))
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
