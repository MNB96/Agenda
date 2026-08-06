import { useEffect, useRef } from 'react'
import { itemRepository } from '../../app/container'
import { AUTO_PURGE_AFTER_DAYS, isEligibleForAutoPurge } from '../../domain/items/services/autoPurge'
import { useItems } from './useItems'

// Margen extra sobre el corte UTC de SQLite, para no perder candidatos por desfasaje de huso horario.
const QUERY_MARGIN_DAYS = 5

// Runs once per app launch. Queries candidates directly instead of useItems()'s cache, which
// only holds the first page of completed items.
export const useAutoPurgeCompleted = () => {
  const { purgeCompleted } = useItems()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    void (async () => {
      const cutoff = new Date(
        Date.now() - (AUTO_PURGE_AFTER_DAYS - QUERY_MARGIN_DAYS) * 24 * 60 * 60 * 1000,
      ).toISOString()
      const candidates = await itemRepository.listPurgeEligible(cutoff)
      const toPurge = candidates.filter((item) => isEligibleForAutoPurge(item))
      if (toPurge.length > 0) void purgeCompleted(toPurge)
    })()
  }, [purgeCompleted])
}
