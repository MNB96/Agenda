import { useEffect } from 'react'
import { useGoogleAuthStore } from '../state/googleAuthStore'

const CHECK_INTERVAL_MS = 30 * 1000

export const useGoogleSessionLifecycleMobile = () => {
  const { accessToken, expiresAt, markExpired } = useGoogleAuthStore()

  useEffect(() => {
    if (!accessToken || !expiresAt) {
      return
    }

    const checkExpiration = () => {
      if (Date.now() >= expiresAt) {
        markExpired()
      }
    }

    checkExpiration()
    const timer = setInterval(checkExpiration, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [accessToken, expiresAt, markExpired])
}
