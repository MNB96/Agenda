import { useQuery } from '@tanstack/react-query'
import { fetchHolidays } from '../../services/holidays/holidaysService'

export const useHolidays = (years: number[]) => {
  const key = [...new Set(years)].sort()

  return useQuery({
    queryKey: ['holidays', key.join(',')],
    queryFn: async () => {
      const results = await Promise.all(key.map((year) => fetchHolidays(year)))
      return results.flat()
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
}
