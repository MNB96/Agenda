import { useEffect, useRef } from 'react'
import { itemRepository } from '../../app/container'
import { catchUpOverdueOccurrence } from '../../domain/items/services/recurrence'
import { useItems } from './useItems'

// Runs once per launch, rolling missed recurring items forward. Create-then-remove, so a failed create never loses the item.
export const useAutoRegenerateOverdueRecurring = () => {
  const { createItem, removeItem } = useItems()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    void (async () => {
      const active = await itemRepository.listActive()
      for (const item of active) {
        const result = catchUpOverdueOccurrence(item)
        if (result.status === 'unchanged') continue

        if (result.status === 'advanced') {
          const currentDate = item.startDate ?? item.deadline
          const nextDate = result.input.startDate ?? result.input.deadline
          // A daily/recurring task should stay visible until the next occurrence is truly a new day.
          // Only then we retire the stale occurrence, preventing the old item from vanishing before the replacement exists.
          if (nextDate && currentDate && nextDate <= currentDate) continue
          try {
            await createItem(result.input)
            await removeItem(item)
          } catch {
            // Stays overdue, retried on the next launch.
          }
          continue
        }

        try {
          await removeItem(item)
        } catch {
          // Stays overdue, retried on the next launch.
        }
      }
    })()
  }, [createItem, removeItem])
}
