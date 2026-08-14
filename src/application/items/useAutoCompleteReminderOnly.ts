import { useEffect } from 'react'
import { itemRepository } from '../../app/container'
import { isReminderOnlyDue } from '../../domain/items'
import { useItems } from './useItems'

export const useAutoCompleteReminderOnly = () => {
  const { toggleCompleted } = useItems()

  useEffect(() => {
    const tick = async () => {
      try {
        const active = await itemRepository.listActive()
        const dueItems = active.filter((item) => item.reminderOnly && isReminderOnlyDue(item))
        for (const item of dueItems) {
          try {
            await toggleCompleted(item)
          } catch {
            // The item remains active until the next poll; avoids losing the reminder state.
          }
        }
      } catch {
        // Ignore startup/persistence errors and retry on the next cycle.
      }
    }

    void tick()
    const intervalId = setInterval(() => {
      void tick()
    }, 60_000)

    return () => clearInterval(intervalId)
  }, [toggleCompleted])
}
