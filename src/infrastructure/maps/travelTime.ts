import * as Location from 'expo-location'
import type { TransportMode } from '../../domain/items'

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

// Chequea el permiso sin disparar el diálogo nativo (una vez rechazado, no vuelve a aparecer).
export const hasLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.getForegroundPermissionsAsync()
  return status === 'granted'
}

const GOOGLE_TRAVEL_MODE: Record<TransportMode, 'DRIVE' | 'WALK' | 'TRANSIT' | 'BICYCLE'> = {
  driving: 'DRIVE',
  walking: 'WALK',
  transit: 'TRANSIT',
  cycling: 'BICYCLE',
}

const MODE_LABEL: Record<TransportMode, string> = {
  driving: 'en auto',
  walking: 'caminando',
  transit: 'en transporte',
  cycling: 'en bici',
}

export const fetchTravelTime = async (
  origin: { lat: number; lng: number },
  destination: string,
  transport: TransportMode = 'driving',
): Promise<TravelTimeResult | null> => {
  const mode = GOOGLE_TRAVEL_MODE[transport]
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
        // TRAFFIC_AWARE solo es válido para DRIVE — el resto de los modos lo rechaza.
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

    const modeLabel = MODE_LABEL[transport]
    const summary =
      minutes < 60
        ? `${minutes} min ${modeLabel}`
        : `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}min` : ''} ${modeLabel}`.trim()

    return { minutes, summary }
  } catch {
    return null
  }
}
