import * as Location from 'expo-location'

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export interface TravelTimeResult {
  minutes: number
  summary: string // "15 min en auto"
}

export const getCurrentLocation = async (): Promise<{ lat: number; lng: number } | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  return { lat: pos.coords.latitude, lng: pos.coords.longitude }
}

export const fetchTravelTime = async (
  origin: { lat: number; lng: number },
  destination: string,
  mode: 'DRIVE' | 'WALK' | 'TRANSIT' = 'DRIVE',
): Promise<TravelTimeResult | null> => {
  try {
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { address: destination },
        travelMode: mode,
        routingPreference: mode === 'DRIVE' ? 'TRAFFIC_AWARE' : undefined,
      }),
    })

    if (!response.ok) return null
    const data = (await response.json()) as { routes?: { duration?: string }[] }
    const durationStr = data.routes?.[0]?.duration
    if (!durationStr) return null

    // duration viene como "1234s"
    const seconds = parseInt(durationStr.replace('s', ''), 10)
    if (isNaN(seconds)) return null
    const minutes = Math.ceil(seconds / 60)

    const modeLabel = mode === 'DRIVE' ? 'en auto' : mode === 'WALK' ? 'caminando' : 'en transporte'
    const summary =
      minutes < 60
        ? `${minutes} min ${modeLabel}`
        : `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}min` : ''} ${modeLabel}`.trim()

    return { minutes, summary }
  } catch {
    return null
  }
}
