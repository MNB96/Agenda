import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { itemRepository, settingsRepository } from '../../app/container'
import { Item, type ItemPatch } from '../../domain/items/types'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { cancelItemNotifications, scheduleItemNotifications } from '../../infrastructure/notifications/itemNotifications'
import { syncItemToCalendar, removeCalendarEventForItem } from '../calendar/itemCalendarSync'
import { buildNextOccurrence } from '../../domain/items/services/recurrence'
import { ITEM_KEY_PREFIX } from './useItem'
import { SUBTASKS_KEY_PREFIX } from './useSubtasks'

const ITEMS_KEY = ['items']
const LICENSES_KEY = ['licenses']

// Cuántos items completados se traen por página: la sección "Completadas" no tiene techo
// natural (nada se borra salvo el auto-archivo de 60 días, que solo corre para items ya
// sincronizados a Google Calendar) — sin esto, la app termina cargando en memoria todo el
// historial completado desde que existe la cuenta. Los items activos sí se traen completos:
// ese conjunto se mantiene naturalmente chico porque se completan/borran con el uso normal.
export const COMPLETED_PAGE_SIZE = 30

// ItemDetailModal ya no lee subtareas/items puntuales del cache principal (useItem/useSubtasks
// abajo), así que toda mutación que pueda cambiarlos tiene que invalidar esas queries también,
// no solo ITEMS_KEY.
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

  // Trae la siguiente página de completadas y la suma al cache existente (no dispara un
  // refetch completo). Devuelve cuántas llegaron: si vino una página llena, probablemente
  // haya más para pedir; si vino corta (o vacía), ya se llegó al final del historial.
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
      item = Item.update(item, { notificationIds })
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
        throw new Error('No se encontro el item para actualizar.')
      }

      let next = Item.update(current, input.patch)
      next = await syncItemToCalendar(next, calendarSyncContext())

      await cancelItemNotifications(current)
      const notificationIds = await scheduleItemNotifications(next)
      next = Item.update(next, { notificationIds })
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
      if (completing) {
        const subtasks = await itemRepository.getByParentIds([item.id])
        if (!Item.canComplete(item, subtasks)) {
          throw new Error('Completá todas las subtareas primero.')
        }
      }
      let next = Item.update(item, {
        status: completing ? 'completed' : 'active',
        completedAt: completing ? new Date().toISOString() : undefined,
      })
      if (completing) {
        await cancelItemNotifications(item)
        next = Item.update(next, { notificationIds: [] })
      } else {
        const notificationIds = await scheduleItemNotifications(next)
        next = Item.update(next, { notificationIds })
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

  // Usado por useAutoArchiveCompleted: borra localmente items completados y ya sincronizados
  // con Google Calendar (que sigue teniendo el registro histórico), pasando por la misma
  // limpieza de licencias y subtareas que el borrado manual en vez de reimplementarla aparte.
  const archiveCompletedMutation = useMutation({
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

  // Usado por useCalendarSyncRecovery una vez que ya subió los items pendientes a Google
  // Calendar: solo persiste los items ya actualizados e invalida el cache, sin repetir el
  // sync (eso ya lo hizo la recovery) ni la resolución/reprogramación de notificaciones que
  // hacen createMutation/updateMutation.
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
    archiveCompleted: archiveCompletedMutation.mutateAsync,
    applySyncedItems: applySyncedItemsMutation.mutateAsync,
    loadMoreCompleted,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      completeMutation.isPending,
  }
}