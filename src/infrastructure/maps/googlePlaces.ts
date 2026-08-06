const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
const AUTOCOMPLETE_ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete'

export interface PlaceSuggestion {
  placeId: string
  description: string
}

function ensureKey(): string {
  if (!GOOGLE_PLACES_KEY) throw new Error('Falta EXPO_PUBLIC_GOOGLE_MAPS_API_KEY')
  return GOOGLE_PLACES_KEY
}

export async function searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length < 2) return []
  const key = ensureKey()

  const response = await fetch(AUTOCOMPLETE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
    },
    body: JSON.stringify({
      input: trimmedQuery,
      languageCode: 'es',
      regionCode: 'ar',
    }),
  })

  if (!response.ok) return []

  const payload = (await response.json().catch(() => null)) as {
    suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[]
  } | null
  const suggestions = payload?.suggestions ?? []

  return suggestions
    .map((entry) => ({
      placeId: entry.placePrediction?.placeId ?? '',
      description: entry.placePrediction?.text?.text ?? '',
    }))
    .filter((item: PlaceSuggestion) => item.placeId && item.description)
}
