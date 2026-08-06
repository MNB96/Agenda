import { useQuery } from '@tanstack/react-query'
import { addDays, endOfMonth, startOfMonth } from 'date-fns'
import { calendarRepository } from '../../app/container'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { useSettings } from '../settings/useSettings'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'

export const useGoogleCalendars = () => {
  const { accessToken, markUnauthorized } = useGoogleAuthStore()

  return useQuery({
    queryKey: ['google-calendars', accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      try {
        return await calendarRepository.listCalendars(accessToken!)
      } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
          markUnauthorized()
        }
        throw error
      }
    },
    retry: (attempt, error) => !isGoogleCalendarAuthError(error) && attempt < 2,
  })
}

export const useGoogleEvents = (baseDate: Date) => {
  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  const { data: settings } = useSettings()

  const rangeMin = startOfMonth(baseDate)
  const rangeMax = endOfMonth(addDays(baseDate, 35))

  return useQuery({
    queryKey: [
      'google-events',
      accessToken,
      settings?.selectedCalendarIds.join(','),
      rangeMin.toISOString(),
      rangeMax.toISOString(),
    ],
    enabled: Boolean(accessToken && settings),
    queryFn: async () => {
      try {
        return await calendarRepository.listEvents(
          accessToken!,
          settings?.selectedCalendarIds.length ? settings.selectedCalendarIds : ['primary'],
          {
            timeMin: rangeMin.toISOString(),
            timeMax: rangeMax.toISOString(),
          },
        )
      } catch (error) {
        if (isGoogleCalendarAuthError(error)) {
          markUnauthorized()
        }
        throw error
      }
    },
    retry: (attempt, error) => !isGoogleCalendarAuthError(error) && attempt < 2,
  })
}