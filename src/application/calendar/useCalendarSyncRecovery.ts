import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { itemRepository } from '../../app/container'
import { syncItemToCalendar } from './itemCalendarSync'
import { useSettings } from '../settings/useSettings'
import { useItems } from '../items/useItems'
import { Item } from '../../domain/items'

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
      const syncedItems: Item[] = []

      for (const item of pending) {
        let authFailed = false
        const updated = await syncItemToCalendar(item, {
          accessToken: token,
          calendarId,
          markUnauthorized: () => {
            authFailed = true
            markUnauthorized()
          },
        })
        if (authFailed) break
        if (!updated.calendarSyncPending) syncedItems.push(updated)
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
