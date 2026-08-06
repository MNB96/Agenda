import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { itemRepository, settingsRepository } from '../../app/container'
import type { Item } from '../../domain/items/types'
import { createItem, updateItem } from './itemService'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { cancelItemNotifications, scheduleItemNotifications } from '../../services/notifications/itemNotifications'
import { syncItemToCalendar, removeCalendarEventForItem } from '../../services/calendar/itemCalendarSync'
import { buildNextOccurrence } from '../../services/items/recurrence'

const ITEMS_KEY = ['items']
const LICENSES_KEY = ['licenses']

// Shared by every write path that removes an item locally (manual delete, immediate-delete
// on a regenerated repeat, auto-archive) so a "day of study" usage never outlives the item
// it was planned for, no matter which path did the removing.
const deleteLicenseUsagesForItems = async (itemIds: string[]) => {
  if (itemIds.length === 0) return
  const ids = new Set(itemIds)
  const usages = await settingsRepository.listLicenseUsages()
  await Promise.all(
    usages.filter((usage) => usage.itemId && ids.has(usage.itemId)).map((usage) => settingsRepository.deleteLicenseUsage(usage.id)),
  )
}

// Subtasks don't make sense without their parent, and the Today/Task list excludes any item
// with a parentId regardless of whether that parent still exists — so removing an item without
// also removing its subtasks left them permanently invisible and unreachable (never shown,
// never deletable) instead of actually gone. Shared by every single-item removal path.
const removeItemAndSubtasks = async (item: Item): Promise<void> => {
  const allItems = await itemRepository.list()
  const subtasks = allItems.filter((candidate) => candidate.parentId === item.id)
  await Promise.all(subtasks.map((subtask) => cancelItemNotifications(subtask)))
  await deleteLicenseUsagesForItems([item.id, ...subtasks.map((subtask) => subtask.id)])
  if (subtasks.length > 0) await itemRepository.removeMany(subtasks.map((subtask) => subtask.id))
  await itemRepository.remove(item.id)
}

export const useItems = () => {
  const queryClient = useQueryClient()
  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  const { data: settings } = useSettings()

  const query = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => itemRepository.list(),
  })

  const calendarSyncContext = () => ({
    accessToken,
    calendarId: settings?.selectedGoogleCalendarIds[0] ?? 'primary',
    markUnauthorized,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createItem>[0]) => {
      let item = createItem(payload)
      item = await syncItemToCalendar(item, calendarSyncContext())

      const notificationIds = await scheduleItemNotifications(item)
      item = updateItem(item, { notificationIds })
      return itemRepository.save(item)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Item> }) => {
      const current = await itemRepository.getById(input.id)
      if (!current) {
        throw new Error('No se encontro el item para actualizar.')
      }

      let next = updateItem(current, input.patch)
      next = await syncItemToCalendar(next, calendarSyncContext())

      await cancelItemNotifications(current)
      const notificationIds = await scheduleItemNotifications(next)
      next = updateItem(next, { notificationIds })
      return itemRepository.save(next)
    },
    onSuccess: (savedItem) => {
      queryClient.setQueryData<Item[]>(ITEMS_KEY, (old) =>
        (old ?? []).map((item) => (item.id === savedItem.id ? savedItem : item)),
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (item: Item) => {
      await cancelItemNotifications(item)
      const link = item.googleCalendarLink
      if (link && accessToken) {
        await removeCalendarEventForItem(item, link, { accessToken, markUnauthorized })
      }
      await removeItemAndSubtasks(item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
    },
  })

  const completeMutation = useMutation({
    mutationFn: async (item: Item) => {
      const completing = item.status !== 'completed'
      let next = updateItem(item, {
        status: completing ? 'completed' : 'active',
        completedAt: completing ? new Date().toISOString() : undefined,
      })
      if (completing) {
        await cancelItemNotifications(item)
        next = updateItem(next, { notificationIds: [] })
      } else {
        const notificationIds = await scheduleItemNotifications(next)
        next = updateItem(next, { notificationIds })
      }

      let regenerated = false
      if (completing) {
        const nextOccurrence = buildNextOccurrence(item)
        if (nextOccurrence) {
          await createMutation.mutateAsync(nextOccurrence)
          regenerated = true
        }
      }

      // Tarea repetitiva que ya generó la próxima instancia y está sincronizada con Google
      // Calendar: no hace falta guardarla localmente como completada — Calendar ya tiene el
      // registro histórico, así que se borra directo en vez de esperar el archivado de 60 días.
      if (regenerated && next.googleCalendarLink) {
        await removeItemAndSubtasks(item)
        return next
      }

      return itemRepository.save(next)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
    },
  })

  // Usado por useAutoArchiveCompleted: borra localmente items completados y ya sincronizados
  // con Google Calendar (que sigue teniendo el registro histórico), pasando por la misma
  // limpieza de licencias y subtareas que el borrado manual en vez de reimplementarla aparte.
  const archiveCompletedMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      const allItems = await itemRepository.list()
      const parentIds = new Set(items.map((item) => item.id))
      const subtasks = allItems.filter((candidate) => candidate.parentId && parentIds.has(candidate.parentId))
      const allIds = [...items.map((item) => item.id), ...subtasks.map((subtask) => subtask.id)]

      await Promise.all(subtasks.map((subtask) => cancelItemNotifications(subtask)))
      await deleteLicenseUsagesForItems(allIds)
      await itemRepository.removeMany(allIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
    },
  })

  // Usado por useCalendarSyncRecovery una vez que ya subió los items pendientes a Google
  // Calendar: solo persiste los items ya actualizados e invalida el cache, sin repetir el
  // sync (eso ya lo hizo la recovery) ni la resolución/reprogramación de notificaciones que
  // hacen createMutation/updateMutation.
  const applySyncedItemsMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      await Promise.all(items.map((item) => itemRepository.save(item)))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const sortedItems = useMemo(
    () => [...(query.data ?? [])].sort((itemA, itemB) => itemB.updatedAt.localeCompare(itemA.updatedAt)),
    [query.data],
  )

  return {
    ...query,
    items: sortedItems,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    removeItem: removeMutation.mutateAsync,
    toggleCompleted: completeMutation.mutateAsync,
    archiveCompleted: archiveCompletedMutation.mutateAsync,
    applySyncedItems: applySyncedItemsMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      completeMutation.isPending,
  }
}