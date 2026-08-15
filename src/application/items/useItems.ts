import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { itemRepository, settingsRepository, taskRepository } from '../../app/container'
import { Item, ITEM_TYPE, type ItemPatch } from '../../domain/items'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { cancelItemNotifications, scheduleItemNotifications } from '../../infrastructure/notifications/itemNotifications'
import { syncItemToCalendar, removeCalendarEventForItem } from '../calendar/itemCalendarSync'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { buildNextOccurrence } from '../../domain/items/services/recurrence'
import { ITEM_KEY_PREFIX } from './useItem'
import { SUBTASKS_KEY_PREFIX } from './useSubtasks'

const ITEMS_KEY = ['items']
const LICENSES_KEY = ['licenses']

// "Completadas" no tiene techo natural (solo la purga de 60 días la achica), así que se pagina.
export const COMPLETED_PAGE_SIZE = 30

// useItem/useSubtasks cachean por separado del listado principal, así que hay que invalidarlos también.
const invalidateItemDetailQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: [ITEM_KEY_PREFIX] })
  queryClient.invalidateQueries({ queryKey: [SUBTASKS_KEY_PREFIX] })
}

const loadInitialItems = async (): Promise<Item[]> => {
  const [active, completed] = await Promise.all([
    itemRepository.listActive(),
    itemRepository.listCompleted(COMPLETED_PAGE_SIZE, 0),
  ])
  return [...active, ...completed]
}

// Shared by every removal path so a license usage never outlives the item it was planned for.
const deleteLicenseUsagesForItems = async (itemIds: string[]) => {
  if (itemIds.length === 0) return
  const ids = new Set(itemIds)
  const usages = await settingsRepository.listLicenseUsages()
  await Promise.all(
    usages.filter((usage) => usage.itemId && ids.has(usage.itemId)).map((usage) => settingsRepository.deleteLicenseUsage(usage.id)),
  )
}

// Removing an item without its subtasks left them invisible but undeletable — the list hides
// any item whose parentId no longer resolves.
const removeItemAndSubtasks = async (item: Item): Promise<void> => {
  const subtasks = await itemRepository.getByParentIds([item.id])
  const allIds = Item.idsToRemoveWith([item], subtasks)
  await Promise.all(subtasks.map((subtask) => cancelItemNotifications(subtask)))
  await deleteLicenseUsagesForItems(allIds)
  if (subtasks.length > 0) await itemRepository.removeMany(subtasks.map((subtask) => subtask.id))
  await itemRepository.remove(item.id)
}

export const useItems = () => {
  const queryClient = useQueryClient()
  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  const { data: settings } = useSettings()

  const query = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: loadInitialItems,
  })

  // Devuelve cuántas llegaron: página llena probablemente tenga más, corta/vacía es el final.
  const loadMoreCompleted = async (): Promise<number> => {
    const current = queryClient.getQueryData<Item[]>(ITEMS_KEY) ?? []
    const currentCompletedCount = current.filter((item) => item.status === 'completed').length
    const nextPage = await itemRepository.listCompleted(COMPLETED_PAGE_SIZE, currentCompletedCount)
    if (nextPage.length > 0) {
      queryClient.setQueryData<Item[]>(ITEMS_KEY, (old) => [...(old ?? []), ...nextPage])
    }
    return nextPage.length
  }

  const calendarSyncContext = () => ({
    accessToken,
    calendarId: settings?.selectedCalendarIds[0] ?? 'primary',
    markUnauthorized,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof Item.create>[0]) => {
      let item = Item.create(payload)
      item = await syncItemToCalendar(item, calendarSyncContext())

      const notificationIds = await scheduleItemNotifications(item)
      item = Item.linkNotifications(item, notificationIds)
      return itemRepository.save(item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      invalidateItemDetailQueries(queryClient)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; patch: ItemPatch }) => {
      const current = await itemRepository.getById(input.id)
      if (!current) {
        throw new Error('No se encontró el item para actualizar.')
      }

      // Cambiar el deadline de una meta la pospone: el Task viejo queda en Calendar como
      // rastro histórico ([Pospuesto]) y la fila local se reemplaza por una nueva.
      const isPostponingGoal =
        current.type === ITEM_TYPE.GOAL
        && Boolean(current.deadline)
        && 'deadline' in input.patch
        && Boolean(input.patch.deadline)
        && input.patch.deadline !== current.deadline
      if (isPostponingGoal) {
        const next = Item.update(current, input.patch)
        if (accessToken && current.calendarLink) {
          try {
            await taskRepository.updateTask(accessToken, current.calendarLink.eventId, {
              title: `[Pospuesto] ${current.title}`,
              notes: current.description,
              dueDate: current.deadline,
            })
          } catch (error) {
            if (isGoogleCalendarAuthError(error)) markUnauthorized()
          }
        }
        await cancelItemNotifications(current)
        const existingSubgoals = await itemRepository.getByParentIds([current.id])
        await removeItemAndSubtasks(current)
        const created = await createMutation.mutateAsync({
          title: next.title,
          description: next.description,
          type: ITEM_TYPE.GOAL,
          deadline: next.deadline,
          syncToCalendar: next.syncToCalendar,
          important: next.important,
          categoryId: next.categoryId,
        })
        for (const sub of existingSubgoals) {
          await itemRepository.save(Item.create({ title: sub.title, parentId: created.id, type: ITEM_TYPE.GOAL }))
        }
        queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
        return created
      }

      let next = Item.update(current, input.patch)
      next = await syncItemToCalendar(next, calendarSyncContext())

      await cancelItemNotifications(current)
      const notificationIds = await scheduleItemNotifications(next)
      next = Item.linkNotifications(next, notificationIds)
      return itemRepository.save(next)
    },
    onSuccess: (savedItem) => {
      queryClient.setQueryData<Item[]>(ITEMS_KEY, (old) =>
        (old ?? []).map((item) => (item.id === savedItem.id ? savedItem : item)),
      )
      invalidateItemDetailQueries(queryClient)
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (item: Item) => {
      await cancelItemNotifications(item)
      const link = item.calendarLink
      if (link && accessToken) {
        await removeCalendarEventForItem(item, link, { accessToken, markUnauthorized })
      }
      await removeItemAndSubtasks(item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
      invalidateItemDetailQueries(queryClient)
    },
  })

  const completeMutation = useMutation({
    mutationFn: async (item: Item) => {
      const completing = item.status !== 'completed'
      let next: Item
      if (completing) {
        const subtasks = await itemRepository.getByParentIds([item.id])
        next = Item.complete(item, subtasks)
        await cancelItemNotifications(item)
        next = Item.linkNotifications(next, [])
      } else {
        next = Item.reopen(item)
        const notificationIds = await scheduleItemNotifications(next)
        next = Item.linkNotifications(next, notificationIds)
      }

      let regenerated = false
      if (completing) {
        const nextOccurrence = buildNextOccurrence(item)
        if (nextOccurrence) {
          await createMutation.mutateAsync(nextOccurrence)
          regenerated = true
        }
      }

      // Ya regenerada y sincronizada: Calendar tiene el registro histórico, se borra directo.
      if (regenerated && next.calendarLink) {
        await removeItemAndSubtasks(item)
        return next
      }

      return itemRepository.save(next)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
      invalidateItemDetailQueries(queryClient)
    },
  })

  // Usado por useAutoPurgeCompleted, reusa la misma limpieza de licencias/subtareas que el borrado manual.
  const purgeCompletedMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      const subtasks = await itemRepository.getByParentIds(items.map((item) => item.id))
      const allIds = Item.idsToRemoveWith(items, subtasks)

      await Promise.all(subtasks.map((subtask) => cancelItemNotifications(subtask)))
      await deleteLicenseUsagesForItems(allIds)
      await itemRepository.removeMany(allIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      queryClient.invalidateQueries({ queryKey: LICENSES_KEY })
      invalidateItemDetailQueries(queryClient)
    },
  })

  const importGoogleEventMutation = useMutation({
    mutationFn: async (input: {
      title: string
      startDate: string
      startTime?: string
      description?: string
      location?: string
      calendarId: string
      rawEventId: string
    }) => {
      let item = Item.create({
        title: input.title,
        startDate: input.startDate,
        startTime: input.startTime,
        description: input.description,
        location: input.location,
        syncToCalendar: false,
      })
      item = Item.linkCalendar(item, {
        calendarId: input.calendarId,
        eventId: input.rawEventId,
        origin: 'external',
        kind: 'event',
      })
      const notificationIds = await scheduleItemNotifications(item)
      item = Item.linkNotifications(item, notificationIds)
      return itemRepository.save(item)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      invalidateItemDetailQueries(queryClient)
    },
  })

  // Usado por useCalendarSyncRecovery: solo persiste items ya sincronizados, sin repetir el sync.
  const applySyncedItemsMutation = useMutation({
    mutationFn: async (items: Item[]) => {
      await itemRepository.saveMany(items)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      invalidateItemDetailQueries(queryClient)
    },
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
    purgeCompleted: purgeCompletedMutation.mutateAsync,
    applySyncedItems: applySyncedItemsMutation.mutateAsync,
    importGoogleCalendarEvent: importGoogleEventMutation.mutateAsync,
    loadMoreCompleted,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      completeMutation.isPending,
  }
}