import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarRepository, itemRepository } from '../../app/container'
import type { Item } from '../../domain/items/types'
import { createItem, resolveEventDateTimes, updateItem } from './itemService'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { isGoogleCalendarAuthError } from '../../providers/calendar/errors'
import { cancelItemNotification, scheduleItemNotification } from '../../services/notifications/itemNotifications'

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
        if (item.syncToGoogleCalendar && accessToken) {
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
        }
        throw error
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

      try {
        if (accessToken) {
          const currentLink = current.googleCalendarLink
          const shouldSync = Boolean(next.syncToGoogleCalendar)

          if (shouldSync && dateTimes) {
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
                googleCalendarLink: {
                  calendarId,
                  eventId: created.eventId,
                  source: 'app',
                  lastSyncedAt: new Date().toISOString(),
                },
              })
            }
          }

          if (!shouldSync && currentLink?.source === 'app') {
            await calendarRepository.deleteEvent(accessToken, currentLink.calendarId, currentLink.eventId)
            next = updateItem(next, { googleCalendarLink: undefined })
          }
        }
      } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
          markUnauthorized()
        }
        throw error
      }

      await cancelItemNotification(current.notificationId)
      const notificationId = await scheduleItemNotification(next)
      next = updateItem(next, { notificationId: notificationId ?? undefined })
      return itemRepository.save(next)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const removeMutation = useMutation({
    mutationFn: async (item: Item) => {
      await cancelItemNotification(item.notificationId)
      try {
        if (item.googleCalendarLink && accessToken) {
          await calendarRepository.deleteEvent(
            accessToken,
            item.googleCalendarLink.calendarId,
            item.googleCalendarLink.eventId,
          )
        }
      } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
          markUnauthorized()
        }
        throw error
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