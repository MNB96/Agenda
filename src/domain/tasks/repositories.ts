export interface TaskRepository {
  listTasks(accessToken: string): Promise<{ taskId: string; title: string; dueDate?: string }[]>
  createTask(accessToken: string, payload: { title: string; notes?: string; dueDate?: string }): Promise<{ taskId: string }>
  updateTask(accessToken: string, taskId: string, payload: { title: string; notes?: string; dueDate?: string }): Promise<void>
  deleteTask(accessToken: string, taskId: string): Promise<void>
}
