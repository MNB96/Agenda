import { getDb } from './db'
import type { Subject, SubjectRepository } from '../../../domain/subjects'

interface SubjectRow {
  id: string
  name: string
  classesPerWeek: number
  absences: number
  createdAt: string
  updatedAt: string
}

const fromRow = (row: SubjectRow): Subject => ({
  id: row.id,
  name: row.name,
  totalClasses: row.classesPerWeek,
  absences: row.absences,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class SQLiteSubjectRepository implements SubjectRepository {
  async list(): Promise<Subject[]> {
    const db = await getDb()
    const rows = await db.getAllAsync<SubjectRow>('SELECT * FROM subjects ORDER BY createdAt ASC')
    return rows.map(fromRow)
  }

  async save(subject: Subject): Promise<Subject> {
    const db = await getDb()
    await db.runAsync(
      'INSERT OR REPLACE INTO subjects (id, name, classesPerWeek, absences, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        subject.id,
        subject.name,
        subject.totalClasses,
        subject.absences,
        subject.createdAt,
        subject.updatedAt,
      ],
    )
    return subject
  }

  async remove(id: string): Promise<void> {
    const db = await getDb()
    await db.runAsync('DELETE FROM subjects WHERE id = ?', [id])
  }
}
