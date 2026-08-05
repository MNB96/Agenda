import { useEffect } from 'react'
import { Platform } from 'react-native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useGoogleAuthStore } from '../state/googleAuthStore'

const CHECK_INTERVAL_MS = 30 * 1000
// Refresh a bit before the token actually expires, so an active session never gets
// caught with a genuinely-expired token — the check fires this many ms ahead of expiry.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export const useGoogleSessionLifecycleMobile = () => {
  const { accessToken, expiresAt, connectedEmail, markExpired, setSession } = useGoogleAuthStore()

  useEffect(() => {
    if (Platform.OS === 'web') return
    // connectedEmail only gets cleared by an explicit "Desconectar" (clearSession); a
    // transient refresh failure (markExpired) keeps it, which is exactly the signal we
    // want here — keep retrying as long as the user hasn't actually disconnected, instead
    // of giving up forever the first time a silent refresh fails (e.g. no network).
    if (!connectedEmail) return

    let cancelled = false

    const ensureSession = async () => {
      const stillValid = Boolean(accessToken) && Boolean(expiresAt) && Date.now() < expiresAt! - REFRESH_MARGIN_MS
      if (stillValid) return

      // The token is about to expire (or already has, or a previous attempt failed).
      // Play Services keeps its own signed-in session, so try a silent refresh from that
      // before giving up and forcing the user to reconnect manually.
      try {
        GoogleSignin.configure({ scopes: ['https://www.googleapis.com/auth/calendar'] })
        if (!GoogleSignin.hasPreviousSignIn()) throw new Error('no previous session')
        const result = await GoogleSignin.signInSilently()
        if (result.type !== 'success') throw new Error('silent sign-in did not succeed')
        const tokens = await GoogleSignin.getTokens()
        if (cancelled) return
        setSession({
          accessToken: tokens.accessToken,
          expiresIn: 3600,
          connectedEmail: result.data.user.email,
        })
      } catch {
        if (!cancelled) markExpired()
      }
    }

    void ensureSession()
    const timer = setInterval(() => void ensureSession(), CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [accessToken, expiresAt, connectedEmail, markExpired, setSession])
}
