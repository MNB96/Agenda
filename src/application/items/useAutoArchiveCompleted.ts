import { useEffect, useRef } from 'react'
import { itemRepository } from '../../app/container'
import { ARCHIVE_AFTER_DAYS, isEligibleForAutoArchive } from '../../domain/items/services/autoArchive'
import { useItems } from './useItems'

// Margen extra sobre los 60 días reales al pedirle candidatos a SQLite: el corte ahí es una
// ventana fija en horas (UTC), mientras que isEligibleForAutoArchive compara días calendario
// en hora local — este margen evita que un desfasaje de huso horario deje afuera candidatos
// legítimos. La elegibilidad final la sigue decidiendo isEligibleForAutoArchive.
const QUERY_MARGIN_DAYS = 5

// Runs once per app launch: deletes completed items older than 60 days that are synced
// to Google Calendar, so local storage doesn't grow forever. See isEligibleForAutoArchive
// for the exact safety condition. Queries candidates directly instead of scanning
// useItems()'s cache, que ahora solo trae la primera página de completados.
export const useAutoArchiveCompleted = () => {
  const { archiveCompleted } = useItems()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    void (async () => {
      const cutoff = new Date(
        Date.now() - (ARCHIVE_AFTER_DAYS - QUERY_MARGIN_DAYS) * 24 * 60 * 60 * 1000,
      ).toISOString()
      const candidates = await itemRepository.listArchiveEligible(cutoff)
      const toArchive = candidates.filter((item) => isEligibleForAutoArchive(item))
      if (toArchive.length > 0) void archiveCompleted(toArchive)
    })()
  }, [archiveCompleted])
}
