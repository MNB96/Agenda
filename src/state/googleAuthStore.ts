import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

type GoogleAuthIssue = 'expired' | 'unauthorized'

interface GoogleAuthState {
  accessToken?: string
  expiresAt?: number
  connectedEmail?: string
  authIssue?: GoogleAuthIssue
  setSession: (input: { accessToken: string; expiresIn: number; connectedEmail?: string }) => void
  markExpired: () => void
  markUnauthorized: () => void
  clearSession: () => void
}

// Persisted so the connection survives a full app restart — otherwise every cold start
// wiped the in-memory session and forced the user to reconnect to Google Calendar.
export const useGoogleAuthStore = create<GoogleAuthState>()(
  persist(
    (set) => ({
      accessToken: undefined,
      expiresAt: undefined,
      connectedEmail: undefined,
      setSession: ({ accessToken, expiresIn, connectedEmail }) =>
        set((current) => ({
          accessToken,
          connectedEmail: connectedEmail ?? current.connectedEmail,
          expiresAt: Date.now() + expiresIn * 1000,
          authIssue: undefined,
        })),
      markExpired: () =>
        set((current) => ({
          accessToken: undefined,
          expiresAt: undefined,
          connectedEmail: current.connectedEmail,
          authIssue: 'expired',
        })),
      markUnauthorized: () =>
        set((current) => ({
          accessToken: undefined,
          expiresAt: undefined,
          connectedEmail: current.connectedEmail,
          authIssue: 'unauthorized',
        })),
      clearSession: () =>
        set({ accessToken: undefined, expiresAt: undefined, connectedEmail: undefined, authIssue: undefined }),
    }),
    {
      name: 'agenda:google-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        connectedEmail: state.connectedEmail,
      }),
    },
  ),
)