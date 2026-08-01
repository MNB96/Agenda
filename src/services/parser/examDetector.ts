const EXAM_KEYWORDS = [
  'parcial', 'examen', 'final', 'recuperatorio', 'recuperacion', 'recuperación',
  'recu', 'integracion', 'integración', 'coloquio', 'quiz',
]

export const isExamTask = (text: string): boolean => {
  if (!text.trim()) return false
  const normalized = text.toLowerCase()
  return EXAM_KEYWORDS.some((kw) => normalized.includes(kw))
}
