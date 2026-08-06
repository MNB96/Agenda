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
        try {
          if (result.status === 'advanced') await createItem(result.input)
          await removeItem(item)
        } catch {
          // Stays overdue, retried on the next launch.
        }
      }
    })()
  }, [createItem, removeItem])
}
