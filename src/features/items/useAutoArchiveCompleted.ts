import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { itemRepository } from '../../app/container'
import { isEligibleForAutoArchive } from '../../services/items/autoArchive'

const ITEMS_KEY = ['items']

// Runs once per app launch: deletes completed items older than 60 days that are synced
// to Google Calendar, so local storage doesn't grow forever. See isEligibleForAutoArchive
// for the exact safety condition.
export const useAutoArchiveCompleted = () => {
  const queryClient = useQueryClient()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    void (async () => {
      const items = await itemRepository.list()
      const toArchive = items.filter((item) => isEligibleForAutoArchive(item))
      if (toArchive.length === 0) return

      await itemRepository.removeMany(toArchive.map((item) => item.id))
      await queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
    })()
  }, [queryClient])
}
