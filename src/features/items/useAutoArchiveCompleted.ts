import { useEffect, useRef } from 'react'
import { isEligibleForAutoArchive } from '../../services/items/autoArchive'
import { useItems } from './useItems'

// Runs once per app launch: deletes completed items older than 60 days that are synced
// to Google Calendar, so local storage doesn't grow forever. See isEligibleForAutoArchive
// for the exact safety condition.
export const useAutoArchiveCompleted = () => {
  const { items, archiveCompleted } = useItems()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current || items.length === 0) return
    hasRun.current = true

    const toArchive = items.filter((item) => isEligibleForAutoArchive(item))
    if (toArchive.length === 0) return

    void archiveCompleted(toArchive)
  }, [items, archiveCompleted])
}
