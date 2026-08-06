export interface AcademicConfigInput {
  studyTimeBefore?: 'half' | 'full'
  grade?: number
}

export class AcademicConfig {
  private readonly _brand = 'AcademicConfig' as const

  private constructor(
    public readonly studyTimeBefore: AcademicConfigInput['studyTimeBefore'],
    public readonly grade: number | undefined,
  ) {}

  static create(input: AcademicConfigInput): AcademicConfig {
    if (input.grade !== undefined && (input.grade < 0 || input.grade > 10)) {
      throw new Error('La nota debe estar entre 0 y 10.')
    }
    return new AcademicConfig(input.studyTimeBefore, input.grade)
  }
}
