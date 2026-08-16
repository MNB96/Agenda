export const ATTENDANCE_REQUIRED = 0.75

export interface Subject {
  id: string
  name: string
  totalClasses: number
  absences: number
  createdAt: string
  updatedAt: string
}

export interface NewSubjectInput {
  name: string
  totalClasses: number
}

export interface SemesterConfig {
  startDate: string
  endDate: string
}

export interface AttendanceStats {
  totalClasses: number
  classesElapsed: number
  maxAbsences: number
  remainingAbsences: number
  /** null if semester hasn't started yet */
  attendancePercent: number | null
  status: 'ok' | 'warning' | 'danger' | 'exceeded'
}

export interface SubjectRepository {
  list(): Promise<Subject[]>
  save(s: Subject): Promise<Subject>
  remove(id: string): Promise<void>
}

const generateId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36)

export const createSubject = (input: NewSubjectInput): Subject => {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: input.name,
    totalClasses: input.totalClasses,
    absences: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export const updateSubject = (
  current: Subject,
  patch: Partial<Pick<Subject, 'name' | 'totalClasses' | 'absences'>>,
): Subject => ({
  ...current,
  ...patch,
  updatedAt: new Date().toISOString(),
})

export const computeAttendance = (subject: Subject, config: SemesterConfig): AttendanceStats => {
  const start = new Date(`${config.startDate}T00:00:00`)
  const end = new Date(`${config.endDate}T00:00:00`)
  const now = new Date()

  const totalClasses = subject.totalClasses
  const maxAbsences = Math.floor(totalClasses * 0.25)

  const totalMs = end.getTime() - start.getTime()
  const elapsedMs = now.getTime() - start.getTime()
  const progressRatio = totalMs > 0 ? Math.max(0, Math.min(elapsedMs / totalMs, 1)) : 0
  const classesElapsed = Math.round(progressRatio * totalClasses)

  const remainingAbsences = maxAbsences - subject.absences
  const attendancePercent =
    classesElapsed > 0
      ? Math.max(0, ((classesElapsed - subject.absences) / classesElapsed) * 100)
      : null

  let status: AttendanceStats['status']
  if (remainingAbsences < 0) {
    status = 'exceeded'
  } else if (remainingAbsences === 0) {
    status = 'danger'
  } else if (remainingAbsences === 1) {
    status = 'warning'
  } else {
    status = 'ok'
  }

  return {
    totalClasses,
    classesElapsed,
    maxAbsences,
    remainingAbsences,
    attendancePercent,
    status,
  }
}
