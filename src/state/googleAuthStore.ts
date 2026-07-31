import { create } from 'zustand'

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

export const useGoogleAuthStore = create<GoogleAuthState>((set) => ({
  accessToken: undefined,
  expiresAt: undefined,
  connectedEmail: undefined,
  setSession: ({ accessToken, expiresIn, connectedEmail }) =>
    set({
      accessToken,
      connectedEmail,
      expiresAt: Date.now() + expiresIn * 1000,
      authIssue: undefined,
    }),
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
}))