import { useEffect, useRef } from 'react'
import { itemRepository, taskRepository } from '../../app/container'
import { isGoalPastDeadlineUnfulfilled, MISSED_GOAL_TITLE_SUFFIX } from '../../domain/items/services/goalDeadline'
import { isGoogleCalendarAuthError } from '../../infrastructure/calendar/errors'
import { useGoogleAuthStore } from '../../state/googleAuthStore'

// Runs once per launch (once a token is available): tags the Calendar Task title of any Goal
// that missed its deadline — local data stays untouched, only what's shown on Calendar changes.
export const useMarkOverdueGoals = () => {
  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current || !accessToken) return
    hasRun.current = true

    void (async () => {
      const items = await itemRepository.list()
      const overdueGoals = items.filter((item) => isGoalPastDeadlineUnfulfilled(item) && item.calendarLink?.kind === 'task')

      for (const item of overdueGoals) {
        try {
          await taskRepository.updateTask(accessToken, item.calendarLink!.eventId, {
            title: `${item.title}${MISSED_GOAL_TITLE_SUFFIX}`,
            notes: item.description,
            dueDate: item.deadline,
          })
        } catch (error) {
          if (isGoogleCalendarAuthError(error)) {
            markUnauthorized()
            break
          }
        }
      }
    })()
  }, [accessToken, markUnauthorized])
}
