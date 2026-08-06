import { useEffect, useState } from 'react'
import { searchPlaceSuggestions, type PlaceSuggestion } from '../../infrastructure/maps/googlePlaces'

interface UseLocationAutocompleteResult {
  locationQuery: string
  setLocationQuery: (value: string) => void
  suggestions: PlaceSuggestion[]
  clearSuggestions: () => void
  /** Re-seeds the query text and clears any pending suggestions — call this from the parent's
   *  own "reset on open" effect when the form loads a different item. */
  reset: (query: string) => void
}

// Debounced Google Places autocomplete, shared by the create and edit item forms.
export const useLocationAutocomplete = (
  selectedLocation: string | undefined,
  initialQuery = '',
): UseLocationAutocompleteResult => {
  const [locationQuery, setLocationQuery] = useState(initialQuery)
  // Raw results; what's shown is derived below (filtered against blank/selected query).
  const [fetchedSuggestions, setFetchedSuggestions] = useState<PlaceSuggestion[]>([])

  useEffect(() => {
    const trimmedQuery = locationQuery.trim()
    if (!trimmedQuery || trimmedQuery === selectedLocation) return
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaceSuggestions(trimmedQuery)
        setFetchedSuggestions(results.slice(0, 4))
      } catch {
        setFetchedSuggestions([])
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [locationQuery, selectedLocation])

  const suggestions =
    !locationQuery.trim() || locationQuery.trim() === selectedLocation ? [] : fetchedSuggestions

  return {
    locationQuery,
    setLocationQuery,
    suggestions,
    clearSuggestions: () => setFetchedSuggestions([]),
    reset: (query: string) => {
      setLocationQuery(query)
      setFetchedSuggestions([])
    },
  }
}
