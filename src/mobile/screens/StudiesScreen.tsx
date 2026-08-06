import { differenceInCalendarDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Bell, BookOpen, CheckCircle, Clock } from 'lucide-react-native'
import { itemRepository } from '../../app/container'
import { useItems } from '../../application/items/useItems'
import { useLicenseUsages, useSettings } from '../../application/settings/useSettings'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { isExamTask } from '../../domain/items/services/examDetector'
import type { Item } from '../../domain/items'

// useItems() solo pagina completados en general; un examen viejo de facultad podría no estar
// ahí, así que se pide aparte, acotado a la categoría.
const COMPLETED_FACULTAD_QUERY_LIMIT = 20

interface StudiesScreenProps {
  onOpenItemEditor: (itemId: string) => void
}

const fmtDate = (dateStr: string) =>
  format(new Date(`${dateStr}T00:00:00`), "d 'de' MMMM", { locale: es })

const urgencyColor = (days: number, colors: ThemeTokens): string => {
  if (days <= 3) return colors.danger
  if (days <= 7) return '#F38630'
  if (days <= 14) return colors.primary
  return colors.textMuted
}

const studyLabel = (v: 'half' | 'full') => (v === 'half' ? '½ día' : '1 día')

export const StudiesScreen = ({ onOpenItemEditor }: StudiesScreenProps) => {
  const { items } = useItems()
  const { data: completedFacultadItems = [] } = useQuery({
    queryKey: ['items', 'completed', 'facultad'],
    queryFn: () => itemRepository.listCompletedByCategory('facultad', COMPLETED_FACULTAD_QUERY_LIMIT),
  })
  const { data: settings } = useSettings()
  const { data: licenseUsages } = useLicenseUsages()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const availableDays = settings?.availableExamLeaveDaysPerYear ?? 0

  const licenseStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const usages = licenseUsages ?? []
    const past = usages.filter(usage => usage.date < today).sort((usageA, usageB) => usageB.date.localeCompare(usageA.date))
    const planned = usages.filter(usage => usage.date >= today).sort((usageA, usageB) => usageA.date.localeCompare(usageB.date))
    const usedDays = past.reduce((total, usage) => total + usage.days, 0)
    const plannedDays = planned.reduce((total, usage) => total + usage.days, 0)
    const remaining = availableDays - usedDays - plannedDays
    return { past, planned, usedDays, plannedDays, remaining }
  }, [licenseUsages, availableDays])

  const { semesterSummary, upcomingExams, otherFacultad, completedExams } = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    let label: string, start: string, end: string
    if (month >= 3 && month <= 7) {
      label = `1er cuatrimestre ${year}`; start = `${year}-03-01`; end = `${year}-07-31`
    } else if (month >= 8 && month <= 11) {
      label = `2do cuatrimestre ${year}`; start = `${year}-08-01`; end = `${year}-11-30`
    } else {
      const nextYear = month === 12 ? year + 1 : year
      label = `1er cuatrimestre ${nextYear}`; start = `${nextYear}-03-01`; end = `${nextYear}-07-31`
    }

    const facultadItems = items.filter(item => item.categoryId === 'facultad')
    const activeExams = facultadItems.filter(item => item.status === 'active' && isExamTask(item.title))
    const semesterExams = activeExams.filter(item => {
      const date = item.startDate ?? item.deadline; return date && date >= start && date <= end
    })
    const upcoming = semesterExams
      .filter(item => (item.startDate ?? item.deadline ?? '') >= today)
      .sort((examA, examB) => (examA.startDate ?? examA.deadline ?? '').localeCompare(examB.startDate ?? examB.deadline ?? ''))

    const next = upcoming[0]
    const nextDays = next
      ? differenceInCalendarDays(new Date(`${next.startDate ?? next.deadline}T00:00:00`), now)
      : null

    const otherFacultad = facultadItems
      .filter(item => item.status === 'active' && !isExamTask(item.title))
      .sort((itemA, itemB) => {
        const dateA = itemA.startDate ?? itemA.deadline ?? 'zzz'
        const dateB = itemB.startDate ?? itemB.deadline ?? 'zzz'
        return dateA.localeCompare(dateB)
      })

    const completedExams = completedFacultadItems
      .filter(item => isExamTask(item.title))
      .sort((examA, examB) => (examB.completedAt ?? '').localeCompare(examA.completedAt ?? ''))
      .slice(0, 5)

    return {
      semesterSummary: { label, total: semesterExams.length, upcoming, next, nextDays },
      upcomingExams: upcoming,
      otherFacultad,
      completedExams,
    }
  }, [items, completedFacultadItems])

  const renderExamRow = (exam: Item, i: number) => {
    const examDate = exam.startDate ?? exam.deadline
    const days = examDate
      ? differenceInCalendarDays(new Date(`${examDate}T00:00:00`), new Date())
      : null
    const dayColor = days !== null ? urgencyColor(days, colors) : colors.textMuted
    const study = exam.academicConfig?.studyTimeBefore
    const hasReminders = (exam.reminderConfig?.length ?? 0) > 0

    return (
      <Pressable key={exam.id} style={[styles.examRow, i > 0 && styles.examRowBorder]} onPress={() => onOpenItemEditor(exam.id)}>
        <View style={[styles.examUrgencyBar, { backgroundColor: dayColor }]} />
        <View style={styles.examContent}>
          <Text style={styles.examTitle} numberOfLines={1}>{exam.title}</Text>
          <View style={styles.examMeta}>
            {examDate && (
              <View style={styles.examMetaItem}>
                <Clock size={11} color={colors.textMuted} />
                <Text style={styles.examMetaText}>{fmtDate(examDate)}</Text>
              </View>
            )}
            {study && (
              <View style={styles.examMetaItem}>
                <BookOpen size={11} color={colors.textMuted} />
                <Text style={styles.examMetaText}>{studyLabel(study)}</Text>
              </View>
            )}
            {hasReminders && (
              <View style={styles.examMetaItem}>
                <Bell size={11} color={colors.textMuted} />
                <Text style={styles.examMetaText}>{exam.reminderConfig!.length}</Text>
              </View>
            )}
          </View>
        </View>
        {days !== null && (
          <View style={[styles.daysBadge, { borderColor: dayColor }]}>
            <Text style={[styles.daysNumber, { color: dayColor }]}>{days}</Text>
            <Text style={[styles.daysLabel, { color: dayColor }]}>días</Text>
          </View>
        )}
      </Pressable>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{semesterSummary.label}</Text>
        {semesterSummary.next ? (
          <View style={styles.summaryNextRow}>
            <View style={styles.summaryNextDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryNextLabel}>Próximo fecha importante</Text>
              <Text style={styles.summaryNextExam} numberOfLines={1}>{semesterSummary.next.title}</Text>
            </View>
            {semesterSummary.nextDays !== null && (
              <View style={styles.summaryDaysBadge}>
                <Text style={styles.summaryDaysNumber}>{semesterSummary.nextDays}</Text>
                <Text style={styles.summaryDaysLabel}>días</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.summaryEmpty}>Sin exámenes próximos cargados</Text>
        )}
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryFooterText}>
            <Text style={styles.summaryFooterValue}>{semesterSummary.total}</Text>
            {semesterSummary.total === 1 ? ' examen' : ' exámenes'}
          </Text>
          {availableDays > 0 && (
            <>
              <Text style={styles.summaryFooterDot}>·</Text>
              <Text style={[styles.summaryFooterText, licenseStats.remaining < 1 && { color: colors.danger }]}>
                <Text style={styles.summaryFooterValue}>{licenseStats.remaining}</Text> licencias libres
              </Text>
            </>
          )}
        </View>
      </View>

      {availableDays > 0 && (
        <>
          <Text style={styles.sectionHeader}>Licencias por examen</Text>
          <View style={styles.card}>

            <View style={styles.licenseBarSection}>
              <View style={styles.licenseBarTrack}>
                {licenseStats.usedDays > 0 && (
                  <View style={[styles.licenseBarFill, {
                    flex: licenseStats.usedDays / availableDays,
                    backgroundColor: colors.danger,
                  }]} />
                )}
                {licenseStats.plannedDays > 0 && (
                  <View style={[styles.licenseBarFill, {
                    flex: licenseStats.plannedDays / availableDays,
                    backgroundColor: '#F38630',
                  }]} />
                )}
                {licenseStats.remaining > 0 && (
                  <View style={[styles.licenseBarFill, {
                    flex: Math.max(licenseStats.remaining, 0) / availableDays,
                    backgroundColor: colors.border,
                  }]} />
                )}
              </View>
              <View style={styles.licenseBarLegend}>
                {licenseStats.usedDays > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
                    <Text style={styles.legendText}>{licenseStats.usedDays} usadas</Text>
                  </View>
                )}
                {licenseStats.plannedDays > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F38630' }]} />
                    <Text style={styles.legendText}>{licenseStats.plannedDays} planificadas</Text>
                  </View>
                )}
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                  <Text style={[styles.legendText, licenseStats.remaining < 1 && { color: colors.danger }]}>
                    {licenseStats.remaining} libres
                  </Text>
                </View>
              </View>
            </View>

            {licenseStats.planned.length > 0 && (
              <View style={styles.licenseListSection}>
                <Text style={styles.licenseListTitle}>Planificadas</Text>
                {licenseStats.planned.map((usage, index) => (
                  <View key={usage.id} style={[styles.licenseRow, index > 0 && styles.licenseRowBorder]}>
                    <View style={[styles.licenseDot, { backgroundColor: '#F38630' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.licenseNote} numberOfLines={1}>{usage.note ?? '—'}</Text>
                      <Text style={styles.licenseDate}>{fmtDate(usage.date)}</Text>
                    </View>
                    <Text style={styles.licenseDays}>{usage.days === 0.5 ? '½ día' : `${usage.days} día${usage.days !== 1 ? 's' : ''}`}</Text>
                  </View>
                ))}
              </View>
            )}

            {licenseStats.past.length > 0 && (
              <View style={styles.licenseListSection}>
                <Text style={styles.licenseListTitle}>Usadas</Text>
                {licenseStats.past.map((usage, index) => (
                  <View key={usage.id} style={[styles.licenseRow, index > 0 && styles.licenseRowBorder]}>
                    <View style={[styles.licenseDot, { backgroundColor: colors.danger }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.licenseNote, { color: colors.textMuted }]} numberOfLines={1}>{usage.note ?? '—'}</Text>
                      <Text style={styles.licenseDate}>{fmtDate(usage.date)}</Text>
                    </View>
                    <Text style={[styles.licenseDays, { color: colors.textMuted }]}>{usage.days === 0.5 ? '½ día' : `${usage.days} día${usage.days !== 1 ? 's' : ''}`}</Text>
                  </View>
                ))}
              </View>
            )}

            {licenseStats.past.length === 0 && licenseStats.planned.length === 0 && (
              <View style={styles.licenseEmpty}>
                <Text style={styles.summaryEmpty}>Ninguna licencia registrada aún.</Text>
                <Text style={[styles.summaryEmpty, { marginTop: 2 }]}>Seteá el &quot;Día de estudio&quot; en un examen para planificar.</Text>
              </View>
            )}

          </View>
        </>
      )}

      {upcomingExams.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Exámenes</Text>
          <View style={styles.card}>
            {upcomingExams.map((exam, i) => renderExamRow(exam, i))}
          </View>
        </>
      )}

      {otherFacultad.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Otras tareas</Text>
          <View style={styles.card}>
            {otherFacultad.map((item, i) => {
              const dateStr = item.startDate ?? item.deadline
              const today = new Date().toISOString().slice(0, 10)
              const isOverdue = !!dateStr && dateStr < today
              return (
                <Pressable key={item.id} style={[styles.taskRow, i > 0 && styles.taskRowBorder]} onPress={() => onOpenItemEditor(item.id)}>
                  <View style={[styles.taskDot, isOverdue && { backgroundColor: colors.danger }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isOverdue && { color: colors.danger }]} numberOfLines={1}>{item.title}</Text>
                    {dateStr && (
                      <Text style={[styles.taskDate, isOverdue && { color: colors.danger }]}>
                        {isOverdue ? 'Venció ' : ''}{fmtDate(dateStr)}
                      </Text>
                    )}
                  </View>
                  {isOverdue && (
                    <View style={styles.overdueBadge}>
                      <Text style={styles.overdueBadgeText}>Vencida</Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </>
      )}

      {completedExams.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Rendidos</Text>
          <View style={styles.card}>
            {completedExams.map((exam, i) => {
              const grade = exam.academicConfig?.grade
              const passed = grade !== undefined ? grade >= 4 : undefined
              return (
                <Pressable key={exam.id} style={[styles.taskRow, i > 0 && styles.taskRowBorder]} onPress={() => onOpenItemEditor(exam.id)}>
                  <CheckCircle size={14} color={colors.textMuted} />
                  <Text style={styles.completedTitle} numberOfLines={1}>{exam.title}</Text>
                  {grade !== undefined && (
                    <View style={[styles.gradeBadge, {
                      backgroundColor: (passed ? colors.success : colors.danger) + '20',
                      borderColor: (passed ? colors.success : colors.danger) + '55',
                    }]}>
                      <Text style={[styles.gradeBadgeText, { color: passed ? colors.success : colors.danger }]}>
                        {passed ? `${grade} ✓` : `${grade} — Recuperar`}
                      </Text>
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        </>
      )}

    </ScrollView>
  )
}

const createStyles = (colors: ThemeTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 10 },
  content: { paddingBottom: 32 },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryNextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryNextDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary },
  summaryNextLabel: { fontSize: 11, color: colors.primary, fontWeight: '600', marginBottom: 1 },
  summaryNextExam: { fontSize: 15, fontWeight: '600', color: colors.text },
  summaryDaysBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' },
  summaryDaysNumber: { fontSize: 18, fontWeight: '700', color: colors.primary, lineHeight: 22 },
  summaryDaysLabel: { fontSize: 10, color: colors.primary, fontWeight: '500' },
  summaryEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  summaryFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
  summaryFooterText: { fontSize: 12, color: colors.textMuted },
  summaryFooterValue: { fontWeight: '700', color: colors.textSecondary },
  summaryFooterDot: { fontSize: 12, color: colors.border },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },

  examRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  examRowBorder: { borderTopWidth: 1, borderColor: colors.border },
  examUrgencyBar: { width: 3, height: 36, borderRadius: 2 },
  examContent: { flex: 1 },
  examTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  examMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  examMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  examMetaText: { fontSize: 11, color: colors.textMuted },
  daysBadge: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 44,
  },
  daysNumber: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  daysLabel: { fontSize: 9, fontWeight: '500' },

  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  taskRowBorder: { borderTopWidth: 1, borderColor: colors.border },
  taskDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.border },
  taskTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  taskDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  completedTitle: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through', flex: 1, marginLeft: 6 },
  licenseBarSection: { padding: 14, gap: 10 },
  licenseBarTrack: {
    height: 10,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  licenseBarFill: { height: 10 },
  licenseBarLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  licenseListSection: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 0,
  },
  licenseListTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  licenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  licenseRowBorder: { borderTopWidth: 1, borderColor: colors.border },
  licenseDot: { width: 8, height: 8, borderRadius: 999 },
  licenseNote: { fontSize: 14, fontWeight: '500', color: colors.text },
  licenseDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  licenseDays: { fontSize: 13, fontWeight: '600', color: colors.text },
  licenseEmpty: { padding: 14, gap: 2 },

  overdueBadge: {
    backgroundColor: colors.danger + '20',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  overdueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.danger,
  },
  gradeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  gradeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
})
