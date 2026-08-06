// JS's Date silently normalizes impossible dates (31/02 -> 03/03) instead of rejecting them —
// comparing the constructed date's fields back against the inputs catches the overflow.
export const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}
