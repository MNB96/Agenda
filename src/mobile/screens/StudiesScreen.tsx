import { differenceInCalendarDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from '@react-navigation/native'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Bell, BookOpen, CheckCircle, Clock, Pencil, Target } from 'lucide-react-native'
import { itemRepository } from '../../app/container'
import { useItems } from '../../application/items/useItems'
import { useLicenseUsages, useSettings } from '../../application/settings/useSettings'
import { useSubjects } from '../../application/subjects/useSubjects'
import { computeAttendance } from '../../domain/subjects'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { isExamTask } from '../../domain/items/services/examDetector'
import { ITEM_TYPE, type Item } from '../../domain/items'

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
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  // Attendance state
  const [editingDates, setEditingDates] = useState(false)
  const [tempStart, setTempStart] = useState('')
  const [tempEnd, setTempEnd] = useState('')
  const [addingSubject, setAddingSubject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTotalClasses, setNewTotalClasses] = useState(16)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTotalClasses, setEditTotalClasses] = useState(16)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (addingSubject) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [addingSubject])

  useFocusEffect(useCallback(() => {
    return () => setShowAllCompleted(false)
  }, []))

  const { items } = useItems()
  const { data: completedFacultadItems = [] } = useQuery({
    queryKey: ['items', 'completed', 'facultad'],
    queryFn: () => itemRepository.listCompletedByCategory('facultad', COMPLETED_FACULTAD_QUERY_LIMIT),
  })
  const { data: settings } = useSettings()
  const { data: licenseUsages } = useLicenseUsages()
  const {
    subjects,
    semesterConfig,
    saveSemesterConfig,
    createSubject: doCreateSubject,
    updateSubject: doUpdateSubject,
    removeSubject,
    addAbsence,
    removeAbsence,
  } = useSubjects()

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{semesterSummary.label}</Text>
        {semesterSummary.next ? (
          <View style={styles.summaryNextRow}>
            <View style={styles.summaryNextDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryNextLabel}>Próxima fecha importante</Text>
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
              const isGoal = item.type === ITEM_TYPE.GOAL
              const accentColor = isOverdue ? colors.danger : (isGoal ? colors.primary : colors.border)
              return (
                <Pressable key={item.id} style={[styles.taskRow, i > 0 && styles.taskRowBorder]} onPress={() => onOpenItemEditor(item.id)}>
                  {isGoal
                    ? <Target size={14} color={accentColor} />
                    : <View style={[styles.taskDot, { backgroundColor: accentColor }]} />
                  }
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
            {(showAllCompleted ? completedExams : completedExams.slice(0, 5)).map((exam, i) => {
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
            {completedExams.length > 5 && (
              <Pressable
                style={[styles.taskRow, { justifyContent: 'center' }]}
                onPress={() => setShowAllCompleted(v => !v)}
              >
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                  {showAllCompleted ? 'Ver menos' : `Ver ${completedExams.length - 5} más`}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionHeader}>Asistencia</Text>
      <View style={styles.card}>

        {/* Semester date range row */}
        <View style={styles.attendanceDateRow}>
          <Text style={styles.attendanceDateText}>
            {semesterConfig.startDate}  →  {semesterConfig.endDate}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => {
              if (!editingDates) {
                setTempStart(semesterConfig.startDate)
                setTempEnd(semesterConfig.endDate)
              }
              setEditingDates((v) => !v)
            }}
          >
            <Pencil size={14} color={colors.textMuted} />
          </Pressable>
        </View>

        {editingDates && (
          <View style={styles.dateEditRow}>
            <TextInput
              style={styles.dateInput}
              value={tempStart}
              onChangeText={setTempStart}
              placeholder="yyyy-MM-dd"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.dateArrow}>→</Text>
            <TextInput
              style={styles.dateInput}
              value={tempEnd}
              onChangeText={setTempEnd}
              placeholder="yyyy-MM-dd"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={styles.dateSaveBtn}
              onPress={() => {
                void saveSemesterConfig({ startDate: tempStart, endDate: tempEnd })
                setEditingDates(false)
              }}
            >
              <Text style={styles.dateSaveBtnText}>OK</Text>
            </Pressable>
          </View>
        )}

        {/* Subject rows */}
        {subjects.length === 0 ? (
          <View style={styles.attendanceEmpty}>
            <Text style={styles.summaryEmpty}>Ninguna materia cargada aún.</Text>
          </View>
        ) : (
          subjects.map((subject, i) => {
            const stats = computeAttendance(subject, semesterConfig)
            const barColor =
              stats.status === 'ok'
                ? colors.success
                : stats.status === 'warning'
                  ? colors.accent
                  : colors.danger
            const filledRatio =
              stats.maxAbsences > 0
                ? Math.min(subject.absences / stats.maxAbsences, 1)
                : subject.absences > 0
                  ? 1
                  : 0
            const emptyRatio = 1 - filledRatio

            const isEditing = editingSubjectId === subject.id

            return (
              <View key={subject.id} style={[styles.subjectRow, i > 0 && styles.subjectRowBorder]}>
                {isEditing ? (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.addSubjectInput}
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                    />
                    <View style={styles.classesPerWeekRow}>
                      <Text style={styles.classesLabel}>Total de clases:</Text>
                      <Pressable
                        style={styles.absenceBtn}
                        onPress={() => setEditTotalClasses((v) => Math.max(1, v - 1))}
                      >
                        <Text style={styles.absenceBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.classesValue}>{editTotalClasses}</Text>
                      <Pressable
                        style={styles.absenceBtn}
                        onPress={() => setEditTotalClasses((v) => Math.min(60, v + 1))}
                      >
                        <Text style={styles.absenceBtnText}>+</Text>
                      </Pressable>
                    </View>
                    <View style={styles.addFormActions}>
                      <Pressable onPress={() => setEditingSubjectId(null)}>
                        <Text style={styles.cancelText}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        style={styles.saveBtn}
                        onPress={() => {
                          if (!editName.trim()) return
                          void doUpdateSubject({ id: subject.id, patch: { name: editName.trim(), totalClasses: editTotalClasses } })
                          setEditingSubjectId(null)
                        }}
                      >
                        <Text style={styles.saveBtnText}>Guardar</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      setEditingSubjectId(subject.id)
                      setEditName(subject.name)
                      setEditTotalClasses(subject.totalClasses)
                    }}
                    onLongPress={() => {
                      Alert.alert(
                        'Eliminar materia',
                        `¿Eliminar "${subject.name}"?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: () => void removeSubject(subject.id),
                          },
                        ],
                      )
                    }}
                  >
                    <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                    <View style={styles.absenceBarTrack}>
                      {filledRatio > 0 && (
                        <View
                          style={[styles.absenceBarFill, { flex: filledRatio, backgroundColor: barColor }]}
                        />
                      )}
                      {emptyRatio > 0 && (
                        <View style={[styles.absenceBarFill, { flex: emptyRatio, backgroundColor: colors.border }]} />
                      )}
                    </View>
                    <Text style={[styles.absenceLabel, stats.status === 'exceeded' && { color: colors.danger }]}>
                      {stats.status === 'exceeded'
                        ? `¡Límite excedido! (${subject.absences}/${stats.maxAbsences} faltas)`
                        : `${subject.absences}/${stats.maxAbsences} faltas permitidas · ${stats.totalClasses} clases`}
                      {stats.attendancePercent !== null
                        ? `  (${Math.round(stats.attendancePercent)}% asist.)`
                        : ''}
                    </Text>
                  </Pressable>
                )}
                {!isEditing && (
                  <View style={styles.absenceBtns}>
                    <Pressable
                      style={styles.absenceBtn}
                      onPress={() => void removeAbsence(subject.id)}
                    >
                      <Text style={styles.absenceBtnText}>−</Text>
                    </Pressable>
                    <Pressable
                      style={styles.absenceBtn}
                      onPress={() => void addAbsence(subject.id)}
                    >
                      <Text style={styles.absenceBtnText}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })
        )}

        {/* Add subject */}
        {addingSubject ? (
          <View style={styles.addSubjectForm}>
            <TextInput
              style={styles.addSubjectInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nombre de la materia"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.classesPerWeekRow}>
              <Text style={styles.classesLabel}>Total de clases:</Text>
              <Pressable
                style={styles.absenceBtn}
                onPress={() => setNewTotalClasses((v) => Math.max(1, v - 1))}
              >
                <Text style={styles.absenceBtnText}>−</Text>
              </Pressable>
              <Text style={styles.classesValue}>{newTotalClasses}</Text>
              <Pressable
                style={styles.absenceBtn}
                onPress={() => setNewTotalClasses((v) => Math.min(60, v + 1))}
              >
                <Text style={styles.absenceBtnText}>+</Text>
              </Pressable>
            </View>
            <View style={styles.addFormActions}>
              <Pressable
                onPress={() => {
                  setAddingSubject(false)
                  setNewName('')
                  setNewTotalClasses(16)
                }}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={() => {
                  if (!newName.trim()) return
                  void doCreateSubject({ name: newName.trim(), totalClasses: newTotalClasses })
                  setAddingSubject(false)
                  setNewName('')
                  setNewTotalClasses(16)
                }}
              >
                <Text style={styles.saveBtnText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addSubjectRow} onPress={() => setAddingSubject(true)}>
            <Text style={styles.addSubjectText}>+ Agregar materia</Text>
          </Pressable>
        )}

      </View>

    </ScrollView>
    </KeyboardAvoidingView>
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
  summaryDaysNumber: { fontSize: 18, fontWeight: '700', color: colors.onPrimary, lineHeight: 22 },
  summaryDaysLabel: { fontSize: 10, color: colors.onPrimary, fontWeight: '500' },
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

  // Attendance section
  attendanceDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  attendanceDateText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  dateEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  dateInput: {
    flex: 1,
    height: 34,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
  },
  dateArrow: {
    fontSize: 14,
    color: colors.textMuted,
  },
  dateSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dateSaveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  attendanceEmpty: {
    padding: 14,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  subjectRowBorder: {
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  absenceBarTrack: {
    height: 6,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  absenceBarFill: {
    height: 6,
  },
  absenceLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  absenceBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  absenceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  absenceBtnText: {
    fontSize: 18,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  addSubjectRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  addSubjectText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  addSubjectForm: {
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  addSubjectInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceSecondary,
  },
  classesPerWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classesLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  classesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  addFormActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: 2,
  },
  cancelText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
})
