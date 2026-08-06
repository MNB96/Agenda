import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { calendarRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../providers/calendar/errors'
import { notifyCalendarDeleteFailed } from '../notifications/itemNotifications'
import { processQueue } from './calendarDeleteQueue'

export const useCalendarDeleteQueue = (
  accessToken: string | null,
  markUnauthorized: () => void,
) => {
  const isProcessing = useRef(false)

  const run = useCallback(async (token: string) => {
    if (isProcessing.current) return
    isProcessing.current = true
    try {
      await processQueue(
        async (calendarId, eventId) => {
          try {
            await calendarRepository.deleteEvent(token, calendarId, eventId)
          } catch (error) {
            if (isGoogleCalendarAuthError(error)) markUnauthorized()
            throw error
          }
        },
        notifyCalendarDeleteFailed,
      )
    } finally {
      isProcessing.current = false
    }
  }, [markUnauthorized])

  useEffect(() => {
    if (accessToken) void run(accessToken)

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && accessToken) void run(accessToken)
    })
    return () => sub.remove()
  }, [accessToken, run])
}
