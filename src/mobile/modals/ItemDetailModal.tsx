import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  BackHandler,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AlarmClock,
  AlignLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  Clock,
  CornerDownRight,
  MapPin,
  MoreVertical,
  Navigation,
  Pin,
  Repeat,
  Star,
  Target,
  Tag,
  X,
} from 'lucide-react-native'
import { searchPlaceSuggestions, type PlaceSuggestion } from '../../services/googlePlaces'
import { MonthCalendar } from '../components/MonthCalendar'
import DateTimePicker from '@react-native-community/datetimepicker'
import { addMonths, format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useItems } from '../../features/items/useItems'
import { useSettings, useLicenseUsages } from '../../features/settings/useSettings'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { computeNextDate } from '../../services/items/recurrence'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import type { ReminderConfig, RepeatConfig, RepeatRule, TravelConfig } from '../../domain/items/types'
import { createId } from '../../utils/id'
import { fetchTravelTime, getCurrentLocation } from '../../services/travelTime'
import { detectCategoryFromText } from '../../services/parser/categoryDetector'
import { isExamTask } from '../../services/parser/examDetector'

interface ItemDetailModalProps {
  open: boolean
  onClose: () => void
  itemId: string
}

const fmtDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  if (isToday(d)) return 'HOY'
  return format(d, "EEE d 'de' MMM", { locale: es })
}

type RepeatUnit = 'day' | 'week' | 'month' | 'year'
type RepeatEnd = 'never' | 'on_date' | 'after_occurrences'

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const UNIT_OPTIONS: { label: string; value: RepeatUnit }[] = [
  { label: 'día', value: 'day' },
  { label: 'semana', value: 'week' },
  { label: 'mes', value: 'month' },
  { label: 'año', value: 'year' },
]

const UNIT_TO_RULE: Record<RepeatUnit, RepeatRule> = {
  day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
}
const RULE_TO_UNIT: Partial<Record<RepeatRule, RepeatUnit>> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
}

const REMINDER_PRESETS_DETAIL = [
  { label: 'A la hora', minutesBefore: 0 },
  { label: '10 min antes', minutesBefore: 10 },
  { label: '30 min antes', minutesBefore: 30 },
  { label: '1 hora antes', minutesBefore: 60 },
  { label: '1 día antes', minutesBefore: 1440 },
]

const formatReminderLabelDetail = (r: ReminderConfig): string => {
  const mins = r.minutesBefore
  if (mins === undefined) return 'Recordatorio'
  if (r.mode === 'departure') {
    if (mins < 60) return `Salir ${mins} min antes`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `Salir ${h}h ${m}min antes` : `Salir ${h}h antes`
  }
  if (mins === 0) return 'A la hora'
  if (mins < 60) return `${mins} min antes`
  if (mins < 1440) {
    const h = mins / 60
    return Number.isInteger(h) ? (h === 1 ? '1 hora antes' : `${h} horas antes`) : `${mins} min antes`
  }
  const d = mins / 1440
  return Number.isInteger(d) ? (d === 1 ? '1 día antes' : `${d} días antes`) : `${Math.floor(mins / 60)}h antes`
}

export const ItemDetailModal = ({ open, onClose, itemId }: ItemDetailModalProps) => {
  const { items, createItem, updateItem, removeItem, toggleCompleted } = useItems()
  const { data: settings } = useSettings()
  const { data: licenseUsages, saveUsage, deleteUsage } = useLicenseUsages()
  const { accessToken } = useGoogleAuthStore()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()


  const item = useMemo(() => items.find(i => i.id === itemId), [items, itemId])
  const subtasks = useMemo(() => items.filter(i => i.parentId === itemId), [items, itemId])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [important, setImportant] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | undefined>()
  const [scheduledTime, setScheduledTime] = useState<string | undefined>()
  const [endTime, setEndTime] = useState<string | undefined>()
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [deadline, setDeadline] = useState<string | undefined>()
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(true)
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none')
  const [repeatConfig, setRepeatConfig] = useState<RepeatConfig | undefined>()
  const [showRepeatPanel, setShowRepeatPanel] = useState(false)
  const [tempRepeatUnit, setTempRepeatUnit] = useState<RepeatUnit>('week')
  const [tempRepeatInterval, setTempRepeatInterval] = useState(1)
  const [tempRepeatDays, setTempRepeatDays] = useState<number[]>([])
  const [tempRepeatTime, setTempRepeatTime] = useState<string | undefined>()
  const [showRepeatUnitPicker, setShowRepeatUnitPicker] = useState(false)
  const [showRepeatTimePicker, setShowRepeatTimePicker] = useState(false)
  const [tempRepeatEnd, setTempRepeatEnd] = useState<RepeatEnd>('never')
  const [tempRepeatEndDate, setTempRepeatEndDate] = useState<string | undefined>()
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false)
  const [tempRepeatOccurrences, setTempRepeatOccurrences] = useState(13)

  const [goalCurrentText, setGoalCurrentText] = useState('')

  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [location, setLocation] = useState<string | undefined>()
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const subtaskInputRef = useRef<TextInput>(null)

  const [reminders, setReminders] = useState<ReminderConfig[]>([])
  const [expandReminders, setExpandReminders] = useState(false)
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>('notification')
  const [selectedPersistent, setSelectedPersistent] = useState(false)
  const [customMinutesText, setCustomMinutesText] = useState('')
  const [customUnit, setCustomUnit] = useState<'min' | 'h' | 'días'>('min')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [travelConfig, setTravelConfig] = useState<TravelConfig | undefined>()
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false)
  const [studyTimeBefore, setStudyTimeBefore] = useState<'half' | 'full' | undefined>()
  const [gradeText, setGradeText] = useState('')

  const [expandDate, setExpandDate] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)

  useEffect(() => {
    if (!open || !item) return
    setTitle(item.title)
    setDescription(item.description ?? '')
    setImportant(item.important ?? false)
    setScheduledDate(item.startDate)
    setScheduledTime(item.startTime)
    setEndTime(item.endTime)
    setDeadline(item.deadline)
    setSyncToGoogleCalendar(item.syncToGoogleCalendar ?? true)
    setGoalCurrentText(item.goalConfig ? String(item.goalConfig.currentValue) : '')
    setRepeatRule(item.repeatRule ?? 'none')
    setRepeatConfig(item.repeatConfig)
    setCategoryId(item.categoryId)
    setLocation(item.location)
    setLocationQuery(item.location ?? '')
    setLocationSuggestions([])
    setReminders(item.reminderConfig ?? [])
    setExpandReminders(false)
    setExpandDate(false)
    setShowRepeatPanel(false)
    setShowCustomInput(false)
    setCustomMinutesText('')
    setTravelTimeResult(null)
    setTravelConfig(item.travelConfig)
    setCategorySuggestionDismissed(false)
    setStudyTimeBefore(item?.academicConfig?.studyTimeBefore)
    setGradeText(item?.academicConfig?.grade !== undefined ? String(item.academicConfig.grade) : '')
  }, [open, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const q = locationQuery.trim()
    if (!q || q === location) {
      setLocationSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaceSuggestions(q)
        setLocationSuggestions(results.slice(0, 4))
      } catch {
        setLocationSuggestions([])
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [locationQuery, location])

  const handleClose = useCallback(async () => {
    if (!item) { onClose(); return }
    if (title.trim()) {
      await updateItem({
        id: item.id,
        patch: {
          title: title.trim(),
          description: description.trim() || undefined,
          important,
          startDate: scheduledDate,
          startTime: scheduledTime,
          endDate: scheduledTime && endTime ? scheduledDate : undefined,
          endTime: scheduledTime ? endTime : undefined,
          deadline,
          syncToGoogleCalendar,
          repeatRule: repeatRule !== 'none' ? repeatRule : undefined,
          repeatConfig: repeatRule !== 'none' ? repeatConfig : undefined,
          categoryId,
          location: location || undefined,
          reminderConfig: reminders.length > 0 ? reminders : undefined,
          goalConfig: item.goalConfig
            ? { ...item.goalConfig, currentValue: parseFloat(goalCurrentText) || 0 }
            : undefined,
          travelConfig,
          academicConfig: (() => {
            const ac = { ...(item?.academicConfig ?? {}) }
            if (studyTimeBefore !== undefined) ac.studyTimeBefore = studyTimeBefore
            else delete ac.studyTimeBefore
            const grade = gradeText.trim() ? parseInt(gradeText.trim(), 10) : undefined
            if (grade !== undefined && !isNaN(grade)) ac.grade = grade
            else delete ac.grade
            return Object.keys(ac).length > 0 ? ac : undefined
          })(),
        },
      })

      // Sync license usage
      const existingUsage = (licenseUsages ?? []).find(u => u.itemId === item.id)
      const days = studyTimeBefore === 'half' ? 0.5 : studyTimeBefore === 'full' ? 1 : undefined
      if (days !== undefined) {
        await saveUsage({
          id: existingUsage?.id ?? createId(),
          itemId: item.id,
          date: scheduledDate ?? deadline ?? new Date().toISOString().slice(0, 10),
          days,
          note: title.trim(),
        })
      } else if (existingUsage) {
        await deleteUsage(existingUsage.id)
      }
    }
    onClose()
  }, [item, title, description, important, scheduledDate, scheduledTime, endTime, deadline, syncToGoogleCalendar, goalCurrentText, travelConfig, repeatRule, repeatConfig, categoryId, location, reminders, studyTimeBefore, gradeText, licenseUsages, saveUsage, deleteUsage, updateItem, onClose])

  useEffect(() => {
    if (!open) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleClose()
      return true
    })
    return () => handler.remove()
  }, [open, handleClose])

  const handleToggleComplete = async () => {
    if (!item) return
    await toggleCompleted(item)
    onClose()
  }

  const handleDelete = () => {
    if (!item) return
    Alert.alert('Eliminar tarea', '¿Eliminar esta tarea?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => { await removeItem(item); onClose() },
      },
    ])
  }

  const addSubtask = async () => {
    const text = newSubtaskText.trim()
    if (!text || !item) return
    setNewSubtaskText('')
    await createItem({ title: text, parentId: item.id, type: 'task' })
    setTimeout(() => subtaskInputRef.current?.focus(), 100)
  }

  const openRepeatPanel = () => {
    setTempRepeatUnit(RULE_TO_UNIT[repeatRule] ?? 'week')
    setTempRepeatInterval(repeatConfig?.interval ?? 1)
    setTempRepeatDays(repeatConfig?.daysOfWeek ?? [])
    setTempRepeatTime(repeatConfig?.time)
    setTempRepeatEnd(repeatConfig?.end ?? 'never')
    setTempRepeatEndDate(repeatConfig?.endDate)
    setTempRepeatOccurrences(repeatConfig?.occurrences ?? 13)
    setShowRepeatUnitPicker(false)
    setShowRepeatPanel(true)
  }

  const commitRepeat = () => {
    const rule = UNIT_TO_RULE[tempRepeatUnit]
    setRepeatRule(rule)
    setRepeatConfig({
      unit: tempRepeatUnit,
      interval: tempRepeatInterval,
      daysOfWeek: tempRepeatUnit === 'week' ? tempRepeatDays : undefined,
      time: tempRepeatTime,
      end: tempRepeatEnd,
      endDate: tempRepeatEnd === 'on_date' ? tempRepeatEndDate : undefined,
      occurrences: tempRepeatEnd === 'after_occurrences' ? tempRepeatOccurrences : undefined,
    })
    // Si la tarea todavía no tiene fecha, se infiere de la repetición misma.
    if (!scheduledDate) {
      const nextDate = computeNextDate(new Date(), {
        unit: tempRepeatUnit,
        interval: tempRepeatInterval,
        daysOfWeek: tempRepeatUnit === 'week' ? tempRepeatDays : undefined,
        end: 'never',
      })
      setScheduledDate(format(nextDate, 'yyyy-MM-dd'))
    }
    setShowRepeatPanel(false)
  }

  const toggleRepeatDay = (idx: number) => {
    setTempRepeatDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]))
  }

  const repeatLabel = useMemo(() => {
    if (repeatRule === 'none') return undefined
    const unit = UNIT_OPTIONS.find((o) => o.value === (RULE_TO_UNIT[repeatRule] ?? 'week'))?.label ?? 'semana'
    const interval = repeatConfig?.interval ?? 1
    return interval > 1 ? `Cada ${interval} ${unit}s` : `Cada ${unit}`
  }, [repeatRule, repeatConfig])

  const handleCalculateTravelTime = async () => {
    if (!location) return
    setTravelTimeLoading(true)
    setTravelTimeResult(null)
    try {
      const pos = await getCurrentLocation()
      if (!pos) { setTravelTimeResult('Sin permiso de ubicación'); return }
      const result = await fetchTravelTime(pos, location)
      if (!result) { setTravelTimeResult('No se pudo calcular'); return }
      setTravelTimeResult(result.summary)
      // Recalcula con el tráfico actual y reemplaza el recordatorio de salida anterior,
      // en vez de dejarlo congelado con la estimación de cuando se creó la tarea.
      const totalMins = result.minutes + 5
      setReminders((prev) => [
        ...prev.filter((r) => r.mode !== 'departure'),
        { id: createId(), mode: 'departure', minutesBefore: totalMins, alarmType: selectedAlarmType, persistent: selectedPersistent },
      ])
      setTravelConfig({ transport: 'driving', extraMinutes: 5, departureReminderEnabled: true })
    } finally {
      setTravelTimeLoading(false)
    }
  }

  const suggestedCategoryId = useMemo(() => {
    if (categoryId || categorySuggestionDismissed) return undefined
    return detectCategoryFromText(title, settings?.categories ?? [])
  }, [title, categoryId, categorySuggestionDismissed, settings?.categories])

  const showCategorySuggestion = Boolean(suggestedCategoryId)
  const suggestedCategory = suggestedCategoryId
    ? (settings?.categories ?? []).find(c => c.id === suggestedCategoryId)
    : undefined

  if (!open) return null

  const isCompleted = item?.status === 'completed'
  const allSubtasksDone = subtasks.length === 0 || subtasks.every(s => s.status === 'completed')
  const canComplete = allSubtasksDone
  const dateLabel = scheduledDate ? fmtDate(scheduledDate) : undefined
  const deadlineLabel = deadline ? fmtDate(deadline) : undefined

  return (
    <>
      <Modal
        visible={open}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => void handleClose()}
      >
        <KeyboardAvoidingView
          style={[styles.container, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => void handleClose()} hitSlop={12} style={styles.headerBtn}>
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setImportant(v => !v)} hitSlop={12} style={styles.headerBtn}>
              <Star
                size={22}
                color={important ? '#F38630' : colors.textMuted}
                fill={important ? '#F38630' : 'transparent'}
              />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <MoreVertical size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.titleInput, isCompleted && styles.titleCompleted]}
              multiline
              placeholder="Título"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />

            {/* Description row */}
            <View style={styles.detailRow}>
              <AlignLeft size={20} color={description.trim() ? colors.text : colors.textMuted} style={styles.rowIcon} />
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.detailRowInput, description.trim() ? { color: colors.text } : {}]}
                placeholder="Agregar detalles"
                placeholderTextColor={colors.textMuted}
                multiline
                selectionColor={colors.primary}
              />
            </View>

            {/* Goal progress row */}
            {item?.goalConfig && (
              <View style={styles.detailRow}>
                <Target size={20} color={colors.primary} style={styles.rowIcon} />
                <TextInput
                  value={goalCurrentText}
                  onChangeText={setGoalCurrentText}
                  keyboardType="numeric"
                  style={[styles.detailRowInput, { flex: 0, width: 70, color: colors.text }]}
                  selectionColor={colors.primary}
                  selectTextOnFocus
                />
                <Text style={styles.detailRowPlaceholder}>
                  {` / ${item.goalConfig.targetValue}${item.goalConfig.unit ? ` ${item.goalConfig.unit}` : ''}`}
                </Text>
              </View>
            )}

            {/* Category row */}
            {(settings?.categories ?? []).length > 0 && (
              <View style={styles.categoryRow}>
                <Tag size={18} color={categoryId ? colors.primary : colors.textMuted} style={styles.rowIcon} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                  {(settings?.categories ?? []).map(cat => {
                    const active = categoryId === cat.id
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setCategoryId(active ? undefined : cat.id)}
                        style={[styles.categoryChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={[styles.categoryChipText, active && { color: colors.onPrimary }]}>{cat.name}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* Category auto-suggestion */}
            {showCategorySuggestion && suggestedCategory && (
              <View style={styles.categorySuggestionRow}>
                <Text style={styles.categorySuggestionLabel}>
                  ¿Categoría: <Text style={styles.categorySuggestionName}>{suggestedCategory.name}</Text>?
                </Text>
                <Pressable
                  onPress={() => setCategoryId(suggestedCategoryId)}
                  style={styles.categorySuggestionAccept}
                  hitSlop={8}
                >
                  <Text style={styles.categorySuggestionAcceptText}>Sí</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCategorySuggestionDismissed(true)}
                  hitSlop={8}
                  style={{ marginLeft: 4 }}
                >
                  <X size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            )}

            {/* Study time (only for exam tasks in facultad category) */}
            {(categoryId === 'facultad' || suggestedCategoryId === 'facultad') && isExamTask(title) && (
              <View style={styles.studyTimeRow}>
                <Text style={styles.studyTimeLabel}>Día de estudio</Text>
                <View style={styles.studyTimeChips}>
                  {([
                    { value: undefined, label: 'Ninguno' },
                    { value: 'half' as const, label: '½ día laboral' },
                    { value: 'full' as const, label: '1 día laboral' },
                  ] as { value: 'half' | 'full' | undefined; label: string }[]).map(({ value, label }) => {
                    const active = studyTimeBefore === value
                    return (
                      <Pressable
                        key={label}
                        onPress={() => setStudyTimeBefore(value)}
                        style={[styles.studyTimeChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        <Text style={[styles.studyTimeChipText, active && { color: colors.onPrimary }]}>{label}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Grade (only for exam tasks in facultad) */}
            {(categoryId === 'facultad' || suggestedCategoryId === 'facultad') && isExamTask(title) && (
              <View style={styles.gradeRow}>
                <Text style={styles.studyTimeLabel}>Nota del examen</Text>
                <View style={styles.gradeInputRow}>
                  <TextInput
                    value={gradeText}
                    onChangeText={(text) => {
                      const digits = text.replace(/[^0-9]/g, '')
                      const n = parseInt(digits, 10)
                      if (digits === '') { setGradeText(''); return }
                      setGradeText(String(Math.min(10, Math.max(1, n))))
                    }}
                    keyboardType="numeric"
                    style={styles.gradeInput}
                    placeholder="1-10"
                    placeholderTextColor={colors.textMuted}
                    maxLength={2}
                    selectionColor={colors.primary}
                  />
                  {gradeText.trim() !== '' && (() => {
                    const g = parseInt(gradeText, 10)
                    const passed = !isNaN(g) && g >= 4
                    return (
                      <View style={[styles.gradeResultBadge, {
                        backgroundColor: (passed ? colors.success : colors.danger) + '22',
                        borderColor: (passed ? colors.success : colors.danger) + '55',
                      }]}>
                        <Text style={[styles.gradeResultText, { color: passed ? colors.success : colors.danger }]}>
                          {passed ? 'Aprobado' : 'Recuperar'}
                        </Text>
                      </View>
                    )
                  })()}
                </View>
              </View>
            )}

            <View style={styles.rowDivider} />

            {/* Location row */}
            <View>
              <View style={styles.detailRow}>
                <Pressable
                  onPress={() => location ? void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(location)}`) : undefined}
                  disabled={!location}
                  hitSlop={4}
                >
                  <MapPin size={20} color={location ? colors.primary : colors.textMuted} style={styles.rowIcon} />
                </Pressable>
                <TextInput
                  value={locationQuery}
                  onChangeText={(text) => {
                    setLocationQuery(text)
                    if (!text.trim()) setLocation(undefined)
                  }}
                  style={[styles.detailRowInput, location ? { color: colors.primary } : {}]}
                  placeholder="Agregar dirección"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  selectionColor={colors.primary}
                  onSubmitEditing={() => setLocationSuggestions([])}
                />
                {locationQuery ? (
                  <Pressable
                    onPress={() => { setLocationQuery(''); setLocation(undefined); setLocationSuggestions([]) }}
                    hitSlop={8}
                  >
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {locationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {locationSuggestions.map((s) => (
                    <Pressable
                      key={s.placeId}
                      style={({ pressed }) => [styles.suggestionItem, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        setLocation(s.description)
                        setLocationQuery(s.description)
                        setLocationSuggestions([])
                        Keyboard.dismiss()
                      }}
                    >
                      <MapPin size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.rowDivider} />

            {/* Deadline row */}
            <Pressable style={styles.detailRow} onPress={() => setShowDeadlinePicker(true)}>
              <CircleCheck size={20} color={deadline ? colors.text : colors.textMuted} style={styles.rowIcon} />
              {deadlineLabel ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{deadlineLabel}</Text>
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); setDeadline(undefined) }}
                    hitSlop={8}
                  >
                    <X size={12} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.detailRowPlaceholder}>Agregar fecha límite</Text>
              )}
            </Pressable>

            <View style={styles.rowDivider} />

            {/* Date / time row */}
            <Pressable style={styles.detailRow} onPress={() => setExpandDate((v) => !v)}>
              <Clock size={20} color={scheduledDate ? colors.primary : colors.textMuted} style={styles.rowIcon} />
              {dateLabel ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    style={[styles.chip, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '15' }]}
                    onPress={() => setExpandDate((v) => !v)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>
                      {dateLabel}
                    </Text>
                    <Pressable
                      onPress={(e) => { e.stopPropagation?.(); setScheduledDate(undefined); setScheduledTime(undefined) }}
                      hitSlop={8}
                    >
                      <X size={12} color={colors.primary} />
                    </Pressable>
                  </Pressable>
                  {scheduledDate && (
                    <Pressable onPress={() => setShowTimePicker(true)} style={[styles.chip, { borderColor: colors.border }]}>
                      <Text style={styles.chipText}>{scheduledTime ?? '+ hora'}</Text>
                    </Pressable>
                  )}
                  {scheduledDate && scheduledTime && (
                    <Pressable onPress={() => setShowEndTimePicker(true)} style={[styles.chip, { borderColor: colors.border }]}>
                      <Text style={styles.chipText}>{endTime ? `hasta ${endTime}` : '+ hasta'}</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={styles.detailRowPlaceholder}>Agregar fecha</Text>
              )}
            </Pressable>

            {expandDate && (
              <View style={styles.remindersPanel}>
                <MonthCalendar
                  selectedDate={scheduledDate}
                  onSelectDate={(d) => { setScheduledDate(d); setExpandDate(false) }}
                  colors={colors}
                />
              </View>
            )}

            {scheduledDate && accessToken && (
              <>
                <View style={styles.rowDivider} />
                <View style={styles.syncRow}>
                  <Text style={styles.syncRowLabel}>Sincronizar con Google Calendar</Text>
                  <Switch value={syncToGoogleCalendar} onValueChange={setSyncToGoogleCalendar} />
                </View>
              </>
            )}

            <View style={styles.rowDivider} />

            {/* Repeat row */}
            <Pressable style={styles.detailRow} onPress={openRepeatPanel}>
              <Repeat size={20} color={repeatRule !== 'none' ? colors.primary : colors.textMuted} style={styles.rowIcon} />
              <Text style={repeatRule !== 'none' ? [styles.detailRowPlaceholder, { color: colors.primary }] : styles.detailRowPlaceholder}>
                {repeatLabel ?? 'No repetir'}
              </Text>
              {repeatRule !== 'none' && (
                <Pressable onPress={(e) => { e.stopPropagation?.(); setRepeatRule('none'); setRepeatConfig(undefined) }} hitSlop={8}>
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </Pressable>

            <View style={styles.rowDivider} />

            {/* Reminders row */}
            <Pressable style={styles.detailRow} onPress={() => setExpandReminders((v) => !v)}>
              <Bell size={20} color={reminders.length > 0 ? colors.primary : colors.textMuted} style={styles.rowIcon} />
              <Text style={reminders.length > 0 ? [styles.detailRowPlaceholder, { color: colors.primary }] : styles.detailRowPlaceholder}>
                {reminders.length > 0 ? `${reminders.length} recordatorio${reminders.length !== 1 ? 's' : ''}` : 'Agregar recordatorio'}
              </Text>
              {reminders.length > 0 && (
                <Pressable onPress={() => setReminders([])} hitSlop={8}>
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </Pressable>

            {expandReminders && (
              <View style={styles.remindersPanel}>
                {/* Added reminders */}
                {reminders.map((r) => (
                  <View key={r.id} style={styles.reminderAddedRow}>
                    <Text style={styles.reminderAddedText}>{formatReminderLabelDetail(r)}</Text>
                    <View style={[styles.reminderTypePill, r.alarmType === 'alarm' && styles.reminderTypePillAlarm]}>
                      {r.alarmType === 'alarm'
                        ? <AlarmClock size={11} color={colors.accent} />
                        : <Bell size={11} color={colors.primary} />}
                      <Text style={[styles.reminderTypePillText, r.alarmType === 'alarm' && { color: colors.accent }]}>
                        {r.alarmType === 'alarm' ? 'Alarma' : 'Notif.'}
                      </Text>
                    </View>
                    <Pressable onPress={() => setReminders(reminders.filter((x) => x.id !== r.id))} hitSlop={8}>
                      <X size={14} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}

                {/* Type selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reminderTypeRow}>
                  <Text style={styles.reminderTypeLabel}>Tipo:</Text>
                  <Pressable
                    style={[styles.reminderTypeBtn, selectedAlarmType === 'notification' && styles.reminderTypeBtnActive]}
                    onPress={() => setSelectedAlarmType('notification')}
                  >
                    <Bell size={12} color={selectedAlarmType === 'notification' ? colors.primary : colors.textMuted} />
                    <Text style={[styles.reminderTypeBtnText, selectedAlarmType === 'notification' && { color: colors.primary, fontWeight: '600' }]}>
                      Notificación
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.reminderTypeBtn, selectedAlarmType === 'alarm' && styles.reminderTypeBtnAlarmActive]}
                    onPress={() => setSelectedAlarmType('alarm')}
                  >
                    <AlarmClock size={12} color={selectedAlarmType === 'alarm' ? colors.accent : colors.textMuted} />
                    <Text style={[styles.reminderTypeBtnText, selectedAlarmType === 'alarm' && { color: colors.accent, fontWeight: '600' }]}>
                      Alarma
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.reminderTypeBtn, selectedPersistent && styles.reminderTypeBtnActive]}
                    onPress={() => setSelectedPersistent((v) => !v)}
                  >
                    <Pin size={12} color={selectedPersistent ? colors.primary : colors.textMuted} />
                    <Text style={[styles.reminderTypeBtnText, selectedPersistent && { color: colors.primary, fontWeight: '600' }]}>
                      Persistente
                    </Text>
                  </Pressable>
                </ScrollView>

                {/* Presets */}
                {REMINDER_PRESETS_DETAIL.map((preset) => {
                  const active = reminders.some((r) => r.minutesBefore === preset.minutesBefore)
                  return (
                    <Pressable
                      key={preset.minutesBefore}
                      style={styles.reminderPresetRow}
                      onPress={() => {
                        if (active) {
                          setReminders(reminders.filter((r) => r.minutesBefore !== preset.minutesBefore))
                        } else {
                          setReminders([...reminders, { id: createId(), mode: 'relative', minutesBefore: preset.minutesBefore, alarmType: selectedAlarmType, persistent: selectedPersistent }])
                        }
                      }}
                    >
                      <Text style={[styles.reminderPresetText, active && { color: colors.primary, fontWeight: '600' }]}>
                        {preset.label}
                      </Text>
                      {active && <Check size={16} color={colors.primary} />}
                    </Pressable>
                  )
                })}

                {/* Travel time — solo si la tarea tiene dirección */}
                {location && (scheduledDate || deadline) && (
                  <Pressable
                    style={styles.reminderPresetRow}
                    onPress={() => void handleCalculateTravelTime()}
                    disabled={travelTimeLoading}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Navigation size={14} color={colors.primary} />
                      <Text style={[styles.reminderPresetText, { color: colors.primary }]}>
                        {travelTimeLoading
                          ? 'Calculando...'
                          : travelConfig
                            ? 'Recalcular salida (tráfico actual)'
                            : 'Recordarme cuándo salir'}
                      </Text>
                    </View>
                    {travelTimeResult && (
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>{travelTimeResult}</Text>
                    )}
                  </Pressable>
                )}

                {/* Custom */}
                <Pressable style={styles.reminderPresetRow} onPress={() => setShowCustomInput((v) => !v)}>
                  <Text style={styles.reminderPresetText}>Personalizado...</Text>
                </Pressable>
                {showCustomInput && (
                  <View style={styles.customReminderRow}>
                    <TextInput
                      style={styles.customReminderInput}
                      value={customMinutesText}
                      onChangeText={setCustomMinutesText}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        const val = parseInt(customMinutesText, 10)
                        if (isNaN(val) || val < 0) return
                        const mins = customUnit === 'h' ? val * 60 : customUnit === 'días' ? val * 1440 : val
                        if (!reminders.some((r) => r.minutesBefore === mins)) {
                          setReminders([...reminders, { id: createId(), mode: 'relative', minutesBefore: mins, alarmType: selectedAlarmType, persistent: selectedPersistent }])
                        }
                        setCustomMinutesText('')
                        setShowCustomInput(false)
                      }}
                      selectionColor={colors.primary}
                    />
                    <View style={styles.customUnitRow}>
                      {(['min', 'h', 'días'] as const).map((u) => (
                        <Pressable
                          key={u}
                          style={[styles.customUnitBtn, customUnit === u && styles.customUnitBtnActive]}
                          onPress={() => setCustomUnit(u)}
                        >
                          <Text style={[styles.customUnitText, customUnit === u && { color: colors.primary, fontWeight: '600' }]}>{u}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.customReminderBeforeLabel}>antes</Text>
                    <Pressable
                      style={styles.customReminderAdd}
                      onPress={() => {
                        const val = parseInt(customMinutesText, 10)
                        if (isNaN(val) || val < 0) return
                        const mins = customUnit === 'h' ? val * 60 : customUnit === 'días' ? val * 1440 : val
                        if (!reminders.some((r) => r.minutesBefore === mins)) {
                          setReminders([...reminders, { id: createId(), mode: 'relative', minutesBefore: mins, alarmType: selectedAlarmType, persistent: selectedPersistent }])
                        }
                        setCustomMinutesText('')
                        setShowCustomInput(false)
                      }}
                    >
                      <Text style={styles.customReminderAddText}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View style={styles.rowDivider} />

            {/* Subtasks */}
            {subtasks.map((sub) => (
              <View key={sub.id} style={styles.subtaskRow}>
                <Pressable
                  onPress={() => void toggleCompleted(sub)}
                  style={[
                    styles.subtaskCheck,
                    sub.status === 'completed' && { backgroundColor: colors.success, borderColor: colors.success },
                  ]}
                />
                <Text style={[styles.subtaskTitle, sub.status === 'completed' && styles.done]}>
                  {sub.title}
                </Text>
              </View>
            ))}

            {/* New subtask input row */}
            <View style={styles.detailRow}>
              <CornerDownRight size={20} color={colors.textMuted} style={styles.rowIcon} />
              <TextInput
                ref={subtaskInputRef}
                value={newSubtaskText}
                onChangeText={setNewSubtaskText}
                placeholder="Agregar subtarea"
                placeholderTextColor={colors.textMuted}
                style={styles.detailRowInput}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={() => void addSubtask()}
                selectionColor={colors.primary}
              />
            </View>
          </ScrollView>

          {/* Bottom bar */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
            <Pressable
              style={({ pressed }) => [
                styles.completeBtn,
                !canComplete && !isCompleted && styles.completeBtnDisabled,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => {
                if (!canComplete && !isCompleted) {
                  Alert.alert('Subtareas pendientes', 'Completá todas las subtareas primero.')
                  return
                }
                void handleToggleComplete()
              }}
            >
              <Text style={[styles.completeBtnText, !canComplete && !isCompleted && { color: colors.textMuted }]}>
                {isCompleted ? 'Marcar como no completada' : 'Marcar como completada'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Repeat panel — same interface as the "add task" flow */}
      <Modal
        visible={showRepeatPanel}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setShowRepeatPanel(false)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.repeatHeader}>
            <Pressable onPress={() => setShowRepeatPanel(false)} hitSlop={12}>
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.repeatTitle}>Se repite.</Text>
            <Pressable onPress={commitRepeat} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>Listo</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Todos los [N] [unidad] */}
            <Text style={styles.repeatSectionLabel}>Todos los</Text>
            <View style={styles.repeatIntervalRow}>
              <TextInput
                value={String(tempRepeatInterval)}
                onChangeText={(v) => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setTempRepeatInterval(n) }}
                keyboardType="number-pad"
                style={styles.repeatIntervalInput}
                maxLength={3}
                selectTextOnFocus
                selectionColor={colors.primary}
              />
              <Pressable style={styles.repeatUnitBtn} onPress={() => setShowRepeatUnitPicker((v) => !v)}>
                <Text style={styles.repeatUnitText}>
                  {UNIT_OPTIONS.find((o) => o.value === tempRepeatUnit)?.label ?? 'semana'}
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {showRepeatUnitPicker && (
              <View style={[styles.remindersPanel, { marginBottom: 12 }]}>
                {UNIT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.reminderPresetRow}
                    onPress={() => { setTempRepeatUnit(opt.value); setShowRepeatUnitPicker(false) }}
                  >
                    <Text style={[styles.reminderPresetText, tempRepeatUnit === opt.value && { color: colors.primary, fontWeight: '600' }]}>
                      {opt.label}
                    </Text>
                    {tempRepeatUnit === opt.value && <Check size={16} color={colors.primary} />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Días de la semana (solo weekly) */}
            {tempRepeatUnit === 'week' && (
              <View style={styles.weekdayCircleRow}>
                {WEEKDAY_SHORT.map((label, idx) => {
                  const active = tempRepeatDays.includes(idx)
                  return (
                    <Pressable
                      key={idx}
                      style={[styles.weekdayCircle, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => toggleRepeatDay(idx)}
                    >
                      <Text style={[styles.weekdayCircleText, active && { color: colors.onPrimary }]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* Establecer hora */}
            <Pressable style={styles.repeatFieldBox} onPress={() => setShowRepeatTimePicker(true)}>
              <Text style={{ fontSize: 15, color: tempRepeatTime ? colors.text : colors.textMuted }}>
                {tempRepeatTime ?? 'Establecer hora'}
              </Text>
            </Pressable>

            <View style={styles.rowDivider} />

            {/* Comienza */}
            <Text style={[styles.repeatSectionLabel, { marginTop: 14 }]}>Comienza</Text>
            <View style={styles.repeatFieldBox}>
              <Text style={{ fontSize: 15, color: colors.text }}>
                {scheduledDate
                  ? format(new Date(scheduledDate + 'T00:00:00'), "d 'de' MMMM", { locale: es })
                  : format(new Date(), "d 'de' MMMM", { locale: es })}
              </Text>
            </View>

            <View style={styles.rowDivider} />

            {/* Finaliza */}
            <Text style={[styles.repeatSectionLabel, { marginTop: 14 }]}>Finaliza</Text>

            <Pressable style={styles.repeatRadioRow} onPress={() => setTempRepeatEnd('never')}>
              <View style={[styles.radioOuter, tempRepeatEnd === 'never' && { borderColor: colors.primary }]}>
                {tempRepeatEnd === 'never' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={styles.repeatRadioLabel}>Nunca</Text>
            </Pressable>

            <View style={styles.repeatRadioRow}>
              <Pressable onPress={() => setTempRepeatEnd('on_date')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={[styles.radioOuter, tempRepeatEnd === 'on_date' && { borderColor: colors.primary }]}>
                  {tempRepeatEnd === 'on_date' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={styles.repeatRadioLabel}>El</Text>
              </Pressable>
              <Pressable
                style={styles.repeatEndField}
                onPress={() => { setTempRepeatEnd('on_date'); setShowRepeatEndDatePicker(true) }}
              >
                <Text style={{ fontSize: 15, color: colors.text }}>
                  {tempRepeatEndDate
                    ? format(new Date(tempRepeatEndDate + 'T00:00:00'), "d 'de' MMMM", { locale: es })
                    : format(addMonths(new Date(), 3), "d 'de' MMMM", { locale: es })}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.repeatRadioRow, { alignItems: 'center' }]}>
              <Pressable onPress={() => setTempRepeatEnd('after_occurrences')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.radioOuter, tempRepeatEnd === 'after_occurrences' && { borderColor: colors.primary }]}>
                  {tempRepeatEnd === 'after_occurrences' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={styles.repeatRadioLabel}>Después de</Text>
              </Pressable>
              <TextInput
                value={String(tempRepeatOccurrences)}
                onChangeText={(v) => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setTempRepeatOccurrences(n) }}
                keyboardType="number-pad"
                style={[styles.repeatIntervalInput, { marginHorizontal: 8 }]}
                maxLength={3}
                selectTextOnFocus
                selectionColor={colors.primary}
                onFocus={() => setTempRepeatEnd('after_occurrences')}
              />
              <Text style={styles.repeatRadioLabel}>repeticiones</Text>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </Modal>

      {open && showRepeatTimePicker && (
        <DateTimePicker
          value={tempRepeatTime ? parse(tempRepeatTime, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowRepeatTimePicker(false)
            if (event.type === 'dismissed' || !date) return
            setTempRepeatTime(format(date, 'HH:mm'))
          }}
        />
      )}
      {open && showRepeatEndDatePicker && (
        <DateTimePicker
          value={tempRepeatEndDate ? new Date(tempRepeatEndDate + 'T00:00:00') : addMonths(new Date(), 3)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowRepeatEndDatePicker(false)
            if (event.type === 'dismissed' || !date) return
            setTempRepeatEndDate(format(date, 'yyyy-MM-dd'))
          }}
        />
      )}

      {/* Native pickers outside Modal to avoid Android nested dialog issue */}
      {open && showTimePicker && (
        <DateTimePicker
          value={scheduledTime ? parse(scheduledTime, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowTimePicker(false)
            if (event.type === 'dismissed' || !date) return
            setScheduledTime(format(date, 'HH:mm'))
          }}
        />
      )}
      {open && showEndTimePicker && (
        <DateTimePicker
          value={endTime ? parse(endTime, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowEndTimePicker(false)
            if (event.type === 'dismissed' || !date) return
            setEndTime(format(date, 'HH:mm'))
          }}
        />
      )}
      {open && showDeadlinePicker && (
        <DateTimePicker
          value={deadline ? new Date(deadline + 'T00:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowDeadlinePicker(false)
            if (event.type === 'dismissed' || !date) return
            setDeadline(format(date, 'yyyy-MM-dd'))
          }}
        />
      )}
    </>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    headerBtn: {
      padding: 8,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
    },
    titleInput: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 24,
      padding: 0,
      outlineWidth: 0,
    } as object,
    titleCompleted: {
      textDecorationLine: 'line-through',
      color: colors.textMuted,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingVertical: 8,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
      paddingVertical: 8,
    },
    syncRowLabel: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    rowIcon: {
      marginRight: 16,
    },
    detailRowInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textMuted,
      padding: 0,
      outlineWidth: 0,
    } as object,
    detailRowPlaceholder: {
      fontSize: 16,
      color: colors.textMuted,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 36,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    chipText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    bottomBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    categoryChips: {
      flexDirection: 'row',
      gap: 8,
      paddingRight: 8,
    },
    categoryChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    categoryChipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    categorySuggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 36,
      marginTop: -4,
      marginBottom: 6,
      gap: 6,
    },
    categorySuggestionLabel: {
      fontSize: 13,
      color: colors.textMuted,
      flex: 1,
    },
    categorySuggestionName: {
      color: colors.primary,
      fontWeight: '600',
    },
    categorySuggestionAccept: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    categorySuggestionAcceptText: {
      fontSize: 12,
      color: colors.onPrimary,
      fontWeight: '600',
    },
    studyTimeRow: {
      paddingHorizontal: 4,
      paddingVertical: 10,
    },
    studyTimeLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 8,
      marginLeft: 2,
    },
    studyTimeChips: {
      flexDirection: 'row',
      gap: 8,
    },
    studyTimeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.surface,
    },
    studyTimeChipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    suggestionsContainer: {
      marginLeft: 36,
      marginBottom: 4,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    suggestionText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    subtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingLeft: 36,
      gap: 12,
    },
    subtaskCheck: {
      width: 22,
      height: 22,
      borderRadius: 999,
      borderWidth: 1.8,
      borderColor: colors.borderStrong,
      backgroundColor: 'transparent',
    },
    subtaskTitle: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    done: {
      textDecorationLine: 'line-through' as const,
      color: colors.textMuted,
    },
    completeBtn: {
      backgroundColor: colors.primary + '22',
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    completeBtnDisabled: {
      backgroundColor: colors.border,
    },
    completeBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },

    // Reminder styles
    remindersPanel: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      marginLeft: 36,
      marginBottom: 4,
      overflow: 'hidden',
    },
    reminderAddedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    reminderAddedText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    reminderTypePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary + '60',
      backgroundColor: colors.primary + '15',
    },
    reminderTypePillAlarm: {
      borderColor: colors.accent + '60',
      backgroundColor: colors.accent + '15',
    },
    reminderTypePillText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
    },
    reminderTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    reminderTypeLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    reminderTypeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reminderTypeBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    reminderTypeBtnAlarmActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    reminderTypeBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    reminderPresetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    reminderPresetText: {
      fontSize: 14,
      color: colors.text,
    },
    repeatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 8,
      marginBottom: 8,
    },
    repeatTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    repeatSectionLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    repeatIntervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    repeatIntervalInput: {
      width: 60,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      textAlign: 'center',
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
    },
    repeatUnitBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceSecondary,
    },
    repeatUnitText: {
      fontSize: 15,
      color: colors.text,
    },
    weekdayCircleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    weekdayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    weekdayCircleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    repeatFieldBox: {
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      justifyContent: 'center',
      marginBottom: 14,
      backgroundColor: colors.surfaceSecondary,
    },
    repeatRadioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    repeatRadioLabel: {
      fontSize: 15,
      color: colors.text,
    },
    repeatEndField: {
      flex: 1,
      height: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
    },
    customReminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    customReminderInput: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 15,
      color: colors.text,
      width: 72,
      textAlign: 'center',
    } as object,
    customUnitRow: {
      flexDirection: 'row',
      gap: 4,
    },
    customUnitBtn: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    customUnitBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    customUnitText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    customReminderBeforeLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    customReminderAdd: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    customReminderAddText: {
      fontSize: 13,
      color: colors.onPrimary,
      fontWeight: '600',
    },
    gradeRow: {
      paddingHorizontal: 4,
      paddingVertical: 10,
    },
    gradeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    gradeInput: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceSecondary,
      color: colors.text,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      fontWeight: '600',
      width: 72,
      textAlign: 'center',
    } as object,
    gradeResultBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    gradeResultText: {
      fontSize: 13,
      fontWeight: '600',
    },
  })
