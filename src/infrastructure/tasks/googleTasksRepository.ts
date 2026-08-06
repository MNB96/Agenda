import type { TaskRepository } from '../../domain/tasks/repositories'
import { GoogleCalendarAuthError } from '../calendar/errors'

const GOOGLE_TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

const buildHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
})

const ensureOk = async (response: Response, defaultMessage: string): Promise<void> => {
  if (response.ok) return
  if (response.status === 401 || response.status === 403) {
    throw new GoogleCalendarAuthError()
  }
  throw new Error(defaultMessage)
}

// The Tasks API's `due` only keeps the date part (docs: "the time portion ... is discarded").
const toBody = (payload: { title: string; notes?: string; dueDate?: string }) => ({
  title: payload.title,
  notes: payload.notes,
  due: payload.dueDate ? `${payload.dueDate}T00:00:00.000Z` : undefined,
})

export class GoogleTasksRepository implements TaskRepository {
  async createTask(accessToken: string, payload: { title: string; notes?: string; dueDate?: string }): Promise<{ taskId: string }> {
    const response = await fetch(GOOGLE_TASKS_BASE, {
      method: 'POST',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(toBody(payload)),
    })
    await ensureOk(response, 'No se pudo crear la tarea en Google Tasks.')
    const data = (await response.json()) as { id: string }
    return { taskId: data.id }
  }

  async updateTask(accessToken: string, taskId: string, payload: { title: string; notes?: string; dueDate?: string }): Promise<void> {
    const response = await fetch(`${GOOGLE_TASKS_BASE}/${taskId}`, {
      method: 'PATCH',
      headers: buildHeaders(accessToken),
      body: JSON.stringify(toBody(payload)),
    })
    await ensureOk(response, 'No se pudo actualizar la tarea de Google Tasks.')
  }

  async deleteTask(accessToken: string, taskId: string): Promise<void> {
    const response = await fetch(`${GOOGLE_TASKS_BASE}/${taskId}`, {
      method: 'DELETE',
      headers: buildHeaders(accessToken),
    })
    if (response.status === 401 || response.status === 403) {
      throw new GoogleCalendarAuthError()
    }
    if (!response.ok && response.status !== 404) {
      throw new Error('No se pudo eliminar la tarea de Google Tasks.')
    }
  }
}
