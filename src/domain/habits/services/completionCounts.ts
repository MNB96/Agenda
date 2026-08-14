export interface HabitCountRecord {
  date: string
  count?: number
}

export const getCompletionCountForDate = (
  completions: readonly HabitCountRecord[],
  date: string,
): number => {
  const total = completions
    .filter((completion) => completion.date === date)
    .reduce((sum, completion) => sum + Math.max(0, Math.trunc(Number(completion.count ?? 0))), 0)

  if (!Number.isFinite(total)) return 0
  return Math.max(0, total)
}

export const nextDailyCompletionCount = (currentCount: number, targetCount: number): number => {
  const safeTarget = Math.max(1, Math.trunc(Number(targetCount) || 1))
  const safeCurrent = Math.max(0, Math.trunc(Number(currentCount) || 0))
  return Math.min(safeTarget, safeCurrent + 1)
}
