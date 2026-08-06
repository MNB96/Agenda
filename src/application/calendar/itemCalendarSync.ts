import { calendarRepository, taskRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { resolveEventDateTimes } from '../../domain/items/services/eventDateTimes'
import { enqueueDelete } from './calendarDeleteQueue'
import { Item, type CalendarLink } from '../../domain/items'

interface SyncContext {
  accessToken: string | null | undefined
  /** Default calendar to create new events on (settings?.selectedCalendarIds[0] ?? 'primary'). */
  calendarId: string
  markUnauthorized: () => void
}

// An explicit end turns it into a real Calendar Event; anything else becomes a Google Task,
// whose due date has no time component anyway — no invented duration either way.
const resolveTargetKind = (item: Item): 'event' | 'task' =>
  item.startDate && item.startTime && item.endTime ? 'event' : 'task'

const eventPayloadFor = (item: Item, dateTimes: NonNullable<ReturnType<typeof resolveEventDateTimes>>) => ({
  summary: item.title,
  description: item.description,
  location: item.location,
  startDateTime: dateTimes.start,
  endDateTime: dateTimes.end,
  allDay: dateTimes.allDay,
})

const taskPayloadFor = (item: Item) => ({
  title: item.title,
  notes: item.description,
  dueDate: item.deadline ?? item.startDate,
})

const deleteLinkedResource = async (accessToken: string, link: CalendarLink): Promise<void> => {
  if (link.kind === 'task') {
    await taskRepository.deleteTask(accessToken, link.eventId)
  } else {
    await calendarRepository.deleteEvent(accessToken, link.calendarId, link.eventId)
  }
}

// Reconciles an item with its desired Calendar Event / Google Task. Never throws: an auth error
// calls markUnauthorized(); any other failure falls back to calendarSyncPending for retry later.
export const syncItemToCalendar = async (item: Item, ctx: SyncContext): Promise<Item> => {
  const wantsSync = Boolean(item.startDate || item.startTime || item.deadline) && item.syncToCalendar !== false
  const currentLink = item.calendarLink

  if (!ctx.accessToken) {
    return wantsSync ? Item.markSyncPending(item) : item
  }

  if (wantsSync) {
    const targetKind = resolveTargetKind(item)
    const dateTimes = targetKind === 'event' ? resolveEventDateTimes(item) : undefined
    if (targetKind === 'event' && !dateTimes) return item

    try {
      if (currentLink && currentLink.kind === targetKind) {
        if (targetKind === 'task') {
          await taskRepository.updateTask(ctx.accessToken, currentLink.eventId, taskPayloadFor(item))
        } else {
          await calendarRepository.updateEvent(ctx.accessToken, currentLink.calendarId, currentLink.eventId, eventPayloadFor(item, dateTimes!))
        }
        return Item.linkCalendar(item, currentLink)
      }

      // Different kind than what's linked (or nothing linked yet): the old resource lives in a
      // different API namespace, can't be "updated" into the other kind — drop it and start fresh.
      if (currentLink) {
        await deleteLinkedResource(ctx.accessToken, currentLink)
      }

      if (targetKind === 'task') {
        const created = await taskRepository.createTask(ctx.accessToken, taskPayloadFor(item))
        return Item.linkCalendar(item, { calendarId: '@default', eventId: created.taskId, origin: 'app', kind: 'task' })
      }
      const created = await calendarRepository.createEvent(ctx.accessToken, ctx.calendarId, eventPayloadFor(item, dateTimes!))
      return Item.linkCalendar(item, { calendarId: ctx.calendarId, eventId: created.eventId, origin: 'app', kind: 'event' })
    } catch (error) {
      if (isGoogleCalendarAuthError(error)) {
        ctx.markUnauthorized()
      }
      // Sin marcar esto (auth u otro error), el item quedaba con el calendarLink viejo sin
      // ninguna señal de que está desactualizado.
      return Item.markSyncPending(item)
    }
  }

  if (currentLink?.origin === 'app') {
    try {
      await deleteLinkedResource(ctx.accessToken, currentLink)
    } catch (error) {
      if (isGoogleCalendarAuthError(error)) {
        ctx.markUnauthorized()
      } else {
        await enqueueDelete(currentLink.kind, currentLink.calendarId, currentLink.eventId, item.title)
      }
    }
    return Item.linkCalendar(item, undefined)
  }

  return item
}

// For an event, falls back to renaming it ("[Eliminada] ...") before enqueueing a delete retry,
// so it doesn't keep looking active — a task has no equivalent concern, goes straight to the queue.
export const removeCalendarEventForItem = async (
  item: Item,
  link: CalendarLink,
  ctx: { accessToken: string; markUnauthorized: () => void },
): Promise<void> => {
  try {
    await deleteLinkedResource(ctx.accessToken, link)
  } catch (deleteError) {
    if (isGoogleCalendarAuthError(deleteError)) {
      ctx.markUnauthorized()
      return
    }
    if (link.kind === 'event') {
      const dateTimes = resolveEventDateTimes(item)
      if (dateTimes) {
        try {
          await calendarRepository.updateEvent(ctx.accessToken, link.calendarId, link.eventId, {
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
    }
    await enqueueDelete(link.kind, link.calendarId, link.eventId, item.title)
  }
}
