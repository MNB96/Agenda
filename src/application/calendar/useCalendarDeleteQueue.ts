import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import * as Network from 'expo-network'
import { calendarRepository, taskRepository } from '../../app/container'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { notifyCalendarDeleteFailed } from '../../infrastructure/notifications/itemNotifications'
import { processQueue, PermanentCalendarDeleteError } from './calendarDeleteQueue'

export const useCalendarDeleteQueue = (
  accessToken: string | null,
  markUnauthorized: () => void,
) => {
  const isProcessing = useRef(false)

  const run = useCallback(async (token: string) => {
    if (isProcessing.current) return

    const net = await Network.getNetworkStateAsync()
    if (!net.isConnected || !net.isInternetReachable) return

    isProcessing.current = true
    try {
      await processQueue(
        async (kind, calendarId, eventId) => {
          try {
            if (kind === 'task') {
              await taskRepository.deleteTask(token, eventId)
            } else {
              await calendarRepository.deleteEvent(token, calendarId, eventId)
            }
          } catch (error) {
            if (isGoogleCalendarAuthError(error)) {
              if (kind !== 'task') markUnauthorized()
              // Tasks auth errors: remove from queue silently — re-auth alone won't unblock the delete
              // since the Tasks API may not be enabled. No need to alarm the user.
              throw new PermanentCalendarDeleteError(kind !== 'task')
            }
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
