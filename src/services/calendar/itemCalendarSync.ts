import { calendarRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../providers/calendar/errors'
import { resolveEventDateTimes, updateItem } from '../../features/items/itemService'
import { enqueueDelete } from './calendarDeleteQueue'
import type { GoogleCalendarLink, Item } from '../../domain/items/types'

interface SyncContext {
  accessToken: string | null | undefined
  /** Default calendar to create new events on (settings?.selectedGoogleCalendarIds[0] ?? 'primary'). */
  calendarId: string
  markUnauthorized: () => void
}

const eventPayloadFor = (item: Item, dateTimes: NonNullable<ReturnType<typeof resolveEventDateTimes>>) => ({
  summary: item.title,
  description: item.description,
  location: item.location,
  startDateTime: dateTimes.start,
  endDateTime: dateTimes.end,
  allDay: dateTimes.allDay,
})

// Reconciles an item's Google Calendar event with its desired sync state — creates the event,
// updates it, or removes it (when sync was turned off for an item the app itself created on
// Calendar) — and returns the item with calendarSyncPending/googleCalendarLink updated to
// reflect what happened. Shared by createMutation and updateMutation in useItems so the two
// don't carry their own near-identical copies of this logic.
//
// Never throws: an auth error calls markUnauthorized(); any other failure falls back to
// calendarSyncPending so useCalendarSyncRecovery retries once the app is foregrounded again.
export const syncItemToCalendar = async (item: Item, ctx: SyncContext): Promise<Item> => {
  const wantsSync = Boolean(item.startDate || item.startTime) && item.syncToGoogleCalendar !== false
  const currentLink = item.googleCalendarLink

  if (!ctx.accessToken) {
    return wantsSync ? updateItem(item, { calendarSyncPending: true }) : item
  }

  if (wantsSync) {
    const dateTimes = resolveEventDateTimes(item)
    if (!dateTimes) return item

    try {
      if (currentLink) {
        await calendarRepository.updateEvent(ctx.accessToken, currentLink.calendarId, currentLink.eventId, eventPayloadFor(item, dateTimes))
        return updateItem(item, {
          calendarSyncPending: undefined,
          googleCalendarLink: { ...currentLink, lastSyncedAt: new Date().toISOString() },
        })
      }
      const created = await calendarRepository.createEvent(ctx.accessToken, ctx.calendarId, eventPayloadFor(item, dateTimes))
      return updateItem(item, {
        calendarSyncPending: undefined,
        googleCalendarLink: { calendarId: ctx.calendarId, eventId: created.eventId, source: 'app', lastSyncedAt: new Date().toISOString() },
      })
    } catch (error) {
      if (isGoogleCalendarAuthError(error)) {
        ctx.markUnauthorized()
        return item
      }
      return updateItem(item, { calendarSyncPending: true })
    }
  }

  if (currentLink?.source === 'app') {
    try {
      await calendarRepository.deleteEvent(ctx.accessToken, currentLink.calendarId, currentLink.eventId)
    } catch (error) {
      if (isGoogleCalendarAuthError(error)) {
        ctx.markUnauthorized()
      } else {
        await enqueueDelete(currentLink.calendarId, currentLink.eventId, item.title)
      }
    }
    return updateItem(item, { googleCalendarLink: undefined })
  }

  return item
}

// Deletes the Google Calendar event backing an item that's being removed entirely. Falls back
// to renaming the event ("[Eliminada] ...") and enqueueing a retry if the delete itself fails,
// so the event doesn't keep looking active on Calendar while the retry queue catches up.
export const removeCalendarEventForItem = async (
  item: Item,
  link: GoogleCalendarLink,
  ctx: { accessToken: string; markUnauthorized: () => void },
): Promise<void> => {
  try {
    await calendarRepository.deleteEvent(ctx.accessToken, link.calendarId, link.eventId)
  } catch (deleteError) {
    if (isGoogleCalendarAuthError(deleteError)) {
      ctx.markUnauthorized()
      return
    }
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
    await enqueueDelete(link.calendarId, link.eventId, item.title)
  }
}
