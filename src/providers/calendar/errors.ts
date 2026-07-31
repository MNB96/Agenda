export class GoogleCalendarAuthError extends Error {
  constructor(message = 'Sesion de Google expirada o no autorizada.') {
    super(message)
    this.name = 'GoogleCalendarAuthError'
  }
}

export const isGoogleCalendarAuthError = (error: unknown): error is GoogleCalendarAuthError =>
  error instanceof GoogleCalendarAuthError
