export interface GoalConfigInput {
  targetValue: number
  currentValue: number
  unit?: string
  isBinary?: boolean
}

export class GoalConfig {
  private readonly _brand = 'GoalConfig' as const

  private constructor(
    public readonly targetValue: number,
    public readonly currentValue: number,
    public readonly unit: string | undefined,
    public readonly isBinary: boolean | undefined,
  ) {}

  static create(input: GoalConfigInput): GoalConfig {
    if (input.targetValue < 0 || input.currentValue < 0) {
      throw new Error('Los valores de la meta no pueden ser negativos.')
    }
    return new GoalConfig(input.targetValue, input.currentValue, input.unit, input.isBinary)
  }
}
