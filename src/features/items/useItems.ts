import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarRepository, itemRepository } from '../../app/container'
import type { Item } from '../../domain/items/types'
import { createItem, resolveEventDateTimes, updateItem } from './itemService'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { isGoogleCalendarAuthError } from '../../providers/calendar/errors'
import { cancelItemNotification, notifyCalendarDeleteFailed, scheduleItemNotification } from '../../services/notifications/itemNotifications'
import { enqueueDelete } from '../../services/calendar/calendarDeleteQueue'

const ITEMS_KEY = ['items']

export const useItems = () => {
  const queryClient = useQueryClient()
  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  const { data: settings } = useSettings()

  const query = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => itemRepository.list(),
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createItem>[0]) => {
      let item = createItem(payload)

      try {
        if ((item.startDate || item.startTime) && accessToken) {
          const dateTimes = resolveEventDateTimes(item)
          const calendarId = settings?.selectedGoogleCalendarIds[0] ?? 'primary'
          if (dateTimes) {
            const created = await calendarRepository.createEvent(accessToken, calendarId, {
              summary: item.title,
              description: item.description,
              location: item.location,
              startDateTime: dateTimes.start,
              endDateTime: dateTimes.end,
              allDay: dateTimes.allDay,
            })
            item = updateItem(item, {
              googleCalendarLink: {
                calendarId,
                eventId: created.eventId,
                source: 'app',
                lastSyncedAt: new Date().toISOString(),
              },
            })
          }
        }
      } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
          markUnauthorized()
        } else {
          item = updateItem(item, { calendarSyncPending: true })
        }
      }

      const notificationId = await scheduleItemNotification(item)
      if (notificationId) {
        item = updateItem(item, { notificationId })
      }
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
      const dateTimes = resolveEventDateTimes(next)

      if (accessToken) {
        const currentLink = current.googleCalendarLink
        const shouldSync = Boolean(next.startDate || next.startTime)

        if (shouldSync && dateTimes) {
          try {
            if (currentLink) {
              await calendarRepository.updateEvent(accessToken, currentLink.calendarId, currentLink.eventId, {
                summary: next.title,
                description: next.description,
                location: next.location,
                startDateTime: dateTimes.start,
                endDateTime: dateTimes.end,
                allDay: dateTimes.allDay,
              })
              next = updateItem(next, {
                calendarSyncPending: undefined,
                googleCalendarLink: {
                  ...currentLink,
                  lastSyncedAt: new Date().toISOString(),
                },
              })
            } else {
              const calendarId = settings?.selectedGoogleCalendarIds[0] ?? 'primary'
              const created = await calendarRepository.createEvent(accessToken, calendarId, {
                summary: next.title,
                description: next.description,
                location: next.location,
                startDateTime: dateTimes.start,
                endDateTime: dateTimes.end,
                allDay: dateTimes.allDay,
              })
              next = updateItem(next, {
                calendarSyncPending: undefined,
                googleCalendarLink: {
                  calendarId,
                  eventId: created.eventId,
                  source: 'app',
                  lastSyncedAt: new Date().toISOString(),
                },
              })
            }
          } catch (error) {
            if (isGoogleCalendarAuthError(error)) {
              markUnauthorized()
            } else {
              next = updateItem(next, { calendarSyncPending: true })
            }
          }
        }

        if (!shouldSync && currentLink?.source === 'app') {
          try {
            await calendarRepository.deleteEvent(accessToken, currentLink.calendarId, currentLink.eventId)
          } catch (error) {
            if (isGoogleCalendarAuthError(error)) {
              markUnauthorized()
            } else {
              await enqueueDelete(currentLink.calendarId, currentLink.eventId, next.title)
            }
          }
          next = updateItem(next, { googleCalendarLink: undefined })
        }
      }

      await cancelItemNotification(current.notificationId)
      const notificationId = await scheduleItemNotification(next)
      next = updateItem(next, { notificationId: notificationId ?? undefined })
      return itemRepository.save(next)
    },
    onSuccess: (savedItem) => {
      queryClient.setQueryData<Item[]>(ITEMS_KEY, (old) =>
        (old ?? []).map((i) => (i.id === savedItem.id ? savedItem : i)),
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (item: Item) => {
      await cancelItemNotification(item.notificationId)
      const link = item.googleCalendarLink
      if (link && accessToken) {
        try {
          await calendarRepository.deleteEvent(accessToken, link.calendarId, link.eventId)
        } catch (deleteError) {
          if (isGoogleCalendarAuthError(deleteError)) {
            markUnauthorized()
          } else {
            // Fallback 1: renombrar el evento para marcarlo visualmente como eliminado
            const dateTimes = resolveEventDateTimes(item)
            if (dateTimes) {
              try {
                await calendarRepository.updateEvent(accessToken, link.calendarId, link.eventId, {
                  summary: `[Eliminada] ${item.title}`,
                  description: item.description,
                  location: item.location,
                  startDateTime: dateTimes.start,
                  endDateTime: dateTimes.end,
                  allDay: dateTimes.allDay,
                })
              } catch {
                // El rename también falló, la cola se encarga
              }
            }
            // Fallback 2: encolar para reintentar con backoff
            await enqueueDelete(link.calendarId, link.eventId, item.title)
          }
        }
      }
      return itemRepository.remove(item.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const completeMutation = useMutation({
    mutationFn: async (item: Item) => {
      const completing = item.status !== 'completed'
      let next = updateItem(item, {
        status: completing ? 'completed' : 'active',
        completedAt: completing ? new Date().toISOString() : undefined,
      })
      if (completing) {
        await cancelItemNotification(item.notificationId)
        next = updateItem(next, { notificationId: undefined })
      } else {
        const notificationId = await scheduleItemNotification(next)
        next = updateItem(next, { notificationId: notificationId ?? undefined })
      }
      return itemRepository.save(next)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const sortedItems = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [query.data],
  )

  return {
    ...query,
    items: sortedItems,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    removeItem: removeMutation.mutateAsync,
    toggleCompleted: completeMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      completeMutation.isPending,
  }
}