import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import { useGoogleAuthStore, GOOGLE_TOKEN_TTL_SECONDS, GOOGLE_OAUTH_SCOPES } from '../state/googleAuthStore'

const CHECK_INTERVAL_MS = 30 * 1000
// Refresh this far ahead of expiry, so an active session never gets caught with a dead token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export const useGoogleSessionLifecycleMobile = () => {
  const { accessToken, expiresAt, connectedEmail, authIssue, markExpired, setSession } = useGoogleAuthStore()
  // Guards against a slow refresh overlapping the next tick and clobbering a token a newer call already refreshed.
  const isRefreshing = useRef(false)

  useEffect(() => {
    if (Platform.OS === 'web') return
    // connectedEmail survives a transient refresh failure (markExpired) — only an explicit
    // "Desconectar" clears it — so this keeps retrying instead of giving up after one failure.
    if (!connectedEmail) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const ensureSession = async () => {
      // A real 401/403 (missing scope) can't be fixed by a silent refresh — retrying loops forever.
      if (authIssue === 'unauthorized') return
      const stillValid = Boolean(accessToken) && Boolean(expiresAt) && Date.now() < expiresAt! - REFRESH_MARGIN_MS
      if (stillValid || isRefreshing.current) {
        // Token válido: dormir hasta cerca de la expiración (mínimo 30s, máximo hasta refresh margin)
        const sleepMs = stillValid
          ? Math.max(30_000, expiresAt! - REFRESH_MARGIN_MS - Date.now())
          : CHECK_INTERVAL_MS
        if (!cancelled) timer = setTimeout(() => void ensureSession(), sleepMs)
        return
      }
      isRefreshing.current = true

      // Play Services keeps its own session, so try a silent refresh before forcing reconnect.
      try {
        GoogleSignin.configure({ scopes: GOOGLE_OAUTH_SCOPES })
        if (!GoogleSignin.hasPreviousSignIn()) throw new Error('no previous session')
        const result = await GoogleSignin.signInSilently()
        if (result.type !== 'success') throw new Error('silent sign-in did not succeed')
        const tokens = await GoogleSignin.getTokens()
        if (cancelled) return
        setSession({
          accessToken: tokens.accessToken,
          expiresIn: GOOGLE_TOKEN_TTL_SECONDS,
          connectedEmail: result.data.user.email,
        })
      } catch {
        if (!cancelled) markExpired()
      } finally {
        isRefreshing.current = false
        if (!cancelled) timer = setTimeout(() => void ensureSession(), CHECK_INTERVAL_MS)
      }
    }

    void ensureSession()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [accessToken, expiresAt, connectedEmail, authIssue, markExpired, setSession])
}
