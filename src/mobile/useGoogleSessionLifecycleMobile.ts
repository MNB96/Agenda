import { useEffect } from 'react'
import { Platform } from 'react-native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useGoogleAuthStore } from '../state/googleAuthStore'

const CHECK_INTERVAL_MS = 30 * 1000
// Refresh a bit before the token actually expires, so an active session never gets
// caught with a genuinely-expired token — the check fires this many ms ahead of expiry.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export const useGoogleSessionLifecycleMobile = () => {
  const { accessToken, expiresAt, markExpired, setSession } = useGoogleAuthStore()

  useEffect(() => {
    if (!accessToken || !expiresAt || Platform.OS === 'web') {
      return
    }

    let cancelled = false

    const checkExpiration = async () => {
      if (Date.now() < expiresAt - REFRESH_MARGIN_MS) return

      // The token is about to expire (or already has). Play Services keeps its own
      // signed-in session, so try a silent refresh from that before giving up and
      // forcing the user to reconnect manually.
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

    void checkExpiration()
    const timer = setInterval(() => void checkExpiration(), CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [accessToken, expiresAt, markExpired, setSession])
}
