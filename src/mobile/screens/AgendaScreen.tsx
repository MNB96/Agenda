import { differenceInCalendarDays, format, isPast, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Bell, BookOpen, CheckCircle, Clock } from 'lucide-react-native'
import { useItems } from '../../features/items/useItems'
import { useLicenseUsages, useSettings } from '../../features/settings/useSettings'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { isExamTask } from '../../services/parser/examDetector'
import type { Item } from '../../domain/items/types'

interface AgendaScreenProps {
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

export const AgendaScreen = ({ onOpenItemEditor }: AgendaScreenProps) => {
  const { items } = useItems()
  const { data: settings } = useSettings()
  const { data: licenseUsages } = useLicenseUsages()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const availableDays = settings?.availableExamLeaveDaysPerYear ?? 0

  const licenseStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const usages = licenseUsages ?? []
    const past = usages.filter(u => u.date < today).sort((a, b) => b.date.localeCompare(a.date))
    const planned = usages.filter(u => u.date >= today).sort((a, b) => a.date.localeCompare(b.date))
    const usedDays = past.reduce((acc, u) => acc + u.days, 0)
    const plannedDays = planned.reduce((acc, u) => acc + u.days, 0)
    const remaining = availableDays - usedDays - plannedDays
    return { past, planned, usedDays, plannedDays, remaining }
  }, [licenseUsages, availableDays])

  const { semesterSummary, upcomingExams, otherFacultad, completedExams } = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const m = now.getMonth() + 1
    const y = now.getFullYear()

    let label: string, start: string, end: string
    if (m >= 3 && m <= 7) {
      label = `1er cuatrimestre ${y}`; start = `${y}-03-01`; end = `${y}-07-31`
    } else if (m >= 8 && m <= 11) {
      label = `2do cuatrimestre ${y}`; start = `${y}-08-01`; end = `${y}-11-30`
    } else {
      const ny = m === 12 ? y + 1 : y
      label = `1er cuatrimestre ${ny}`; start = `${ny}-03-01`; end = `${ny}-07-31`
    }

    const facultadItems = items.filter(i => i.categoryId === 'facultad')
    const activeExams = facultadItems.filter(i => i.status === 'active' && isExamTask(i.title))
    const semesterExams = activeExams.filter(i => {
      const d = i.startDate ?? i.deadline; return d && d >= start && d <= end
    })
    const upcoming = semesterExams
      .filter(i => (i.startDate ?? i.deadline ?? '') >= today)
      .sort((a, b) => (a.startDate ?? a.deadline ?? '').localeCompare(b.startDate ?? b.deadline ?? ''))

    const next = upcoming[0]
    const nextDays = next
      ? differenceInCalendarDays(new Date(`${next.startDate ?? next.deadline}T00:00:00`), now)
      : null

    const otherFacultad = facultadItems
      .filter(i => i.status === 'active' && !isExamTask(i.title))
      .sort((a, b) => {
        const da = a.startDate ?? a.deadline ?? 'zzz'
        const db = b.startDate ?? b.deadline ?? 'zzz'
        return da.localeCompare(db)
      })

    const completedExams = facultadItems
      .filter(i => i.status === 'completed' && isExamTask(i.title))
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 5)

    return {
      semesterSummary: { label, total: semesterExams.length, upcoming, next, nextDays },
      upcomingExams: upcoming,
      otherFacultad,
      completedExams,
    }
  }, [items])

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

      {/* Resumen del cuatrimestre */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{semesterSummary.label}</Text>
        {semesterSummary.next ? (
          <View style={styles.summaryNextRow}>
            <View style={styles.summaryNextDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryNextLabel}>Próximo examen</Text>
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

      {/* Licencias */}
      {availableDays > 0 && (
        <>
          <Text style={styles.sectionHeader}>Licencias por examen</Text>
          <View style={styles.card}>

            {/* Barra de progreso */}
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

            {/* Planificadas (próximas) */}
            {licenseStats.planned.length > 0 && (
              <View style={styles.licenseListSection}>
                <Text style={styles.licenseListTitle}>Planificadas</Text>
                {licenseStats.planned.map((u, i) => (
                  <View key={u.id} style={[styles.licenseRow, i > 0 && styles.licenseRowBorder]}>
                    <View style={[styles.licenseDot, { backgroundColor: '#F38630' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.licenseNote} numberOfLines={1}>{u.note ?? '—'}</Text>
                      <Text style={styles.licenseDate}>{fmtDate(u.date)}</Text>
                    </View>
                    <Text style={styles.licenseDays}>{u.days === 0.5 ? '½ día' : `${u.days} día${u.days !== 1 ? 's' : ''}`}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Usadas (pasadas) */}
            {licenseStats.past.length > 0 && (
              <View style={styles.licenseListSection}>
                <Text style={styles.licenseListTitle}>Usadas</Text>
                {licenseStats.past.map((u, i) => (
                  <View key={u.id} style={[styles.licenseRow, i > 0 && styles.licenseRowBorder]}>
                    <View style={[styles.licenseDot, { backgroundColor: colors.danger }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.licenseNote, { color: colors.textMuted }]} numberOfLines={1}>{u.note ?? '—'}</Text>
                      <Text style={styles.licenseDate}>{fmtDate(u.date)}</Text>
                    </View>
                    <Text style={[styles.licenseDays, { color: colors.textMuted }]}>{u.days === 0.5 ? '½ día' : `${u.days} día${u.days !== 1 ? 's' : ''}`}</Text>
                  </View>
                ))}
              </View>
            )}

            {licenseStats.past.length === 0 && licenseStats.planned.length === 0 && (
              <View style={styles.licenseEmpty}>
                <Text style={styles.summaryEmpty}>Ninguna licencia registrada aún.</Text>
                <Text style={[styles.summaryEmpty, { marginTop: 2 }]}>Seteá el "Día de estudio" en un examen para planificar.</Text>
              </View>
            )}

          </View>
        </>
      )}

      {/* Exámenes próximos */}
      {upcomingExams.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Exámenes</Text>
          <View style={styles.card}>
            {upcomingExams.map((exam, i) => renderExamRow(exam, i))}
          </View>
        </>
      )}

      {/* Otras tareas de facultad */}
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

      {/* Exámenes rendidos */}
      {completedExams.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Rendidos</Text>
          <View style={styles.card}>
            {completedExams.map((exam, i) => (
              <View key={exam.id} style={[styles.taskRow, i > 0 && styles.taskRowBorder]}>
                <CheckCircle size={14} color={colors.textMuted} />
                <Text style={styles.completedTitle} numberOfLines={1}>{exam.title}</Text>
              </View>
            ))}
          </View>
        </>
      )}

    </ScrollView>
  )
}

const createStyles = (colors: ThemeTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 10 },
  content: { paddingBottom: 32 },

  // Summary card
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

  // Section
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

  // Exam rows
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

  // Task rows
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  taskRowBorder: { borderTopWidth: 1, borderColor: colors.border },
  taskDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.border },
  taskTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  taskDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  completedTitle: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through', flex: 1, marginLeft: 6 },
  // License card
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
})
