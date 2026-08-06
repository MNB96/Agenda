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
  AlignLeft,
  Bell,
  ChevronLeft,
  CircleCheck,
  Clock,
  CornerDownRight,
  MapPin,
  MoreVertical,
  Repeat,
  Star,
  Target,
  Tag,
  X,
} from 'lucide-react-native'
import { MonthCalendar } from '../components/MonthCalendar'
import { RepeatPanel, UNIT_OPTIONS, RULE_TO_UNIT } from '../components/RepeatPanel'
import { ReminderPanel } from '../components/ReminderPanel'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useItems } from '../../features/items/useItems'
import { useItem } from '../../features/items/useItem'
import { useSubtasks } from '../../features/items/useSubtasks'
import { useLocationAutocomplete } from '../../features/items/useLocationAutocomplete'
import { useSettings, useLicenseUsages } from '../../features/settings/useSettings'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { computeNextDate } from '../../services/items/recurrence'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import type { Item, ReminderConfig, RepeatConfig, RepeatRule } from '../../domain/items/types'
import { createId } from '../../utils/id'
import { fetchTravelTime, getCurrentLocation } from '../../services/travelTime'
import { detectCategoryFromText } from '../../services/parser/categoryDetector'
import { isExamTask } from '../../services/parser/examDetector'

interface ItemDetailModalProps {
  itemId: string | undefined
  onClose: () => void
}

const fmtDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  if (isToday(date)) return 'HOY'
  return format(date, "EEE d 'de' MMM", { locale: es })
}

// Thin wrapper: finds the item and, once found, mounts the actual form keyed on its id. Keying
// on itemId means the form (and every piece of its draft state) is a fresh component instance
// per item — no "reset on open" effect needed to re-seed ~20 fields, and switching straight from
// editing one item to another (if that ever happens) can't leak stale draft state between them.
export const ItemDetailModal = ({ itemId, onClose }: ItemDetailModalProps) => {
  const { data: item } = useItem(itemId)

  if (!item) return null

  return <ItemDetailModalForm key={itemId} item={item} onClose={onClose} />
}

interface ItemDetailModalFormProps {
  item: Item
  onClose: () => void
}

const ItemDetailModalForm = ({ item, onClose }: ItemDetailModalFormProps) => {
  const { createItem, updateItem, removeItem, toggleCompleted } = useItems()
  const { data: settings } = useSettings()
  const { data: licenseUsages, saveUsage, deleteUsage } = useLicenseUsages()
  const { accessToken } = useGoogleAuthStore()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const { data: subtasks = [] } = useSubtasks(item.id)

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [important, setImportant] = useState(item.important ?? false)
  const [scheduledDate, setScheduledDate] = useState(item.startDate)
  const [scheduledTime, setScheduledTime] = useState(item.startTime)
  const [endTime, setEndTime] = useState(item.endTime)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [deadline, setDeadline] = useState(item.deadline)
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(item.syncToGoogleCalendar ?? true)
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(item.repeatRule ?? 'none')
  const [repeatConfig, setRepeatConfig] = useState<RepeatConfig | undefined>(item.repeatConfig)
  const [showRepeatPanel, setShowRepeatPanel] = useState(false)

  const [goalCurrentText, setGoalCurrentText] = useState(item.goalConfig ? String(item.goalConfig.currentValue) : '')

  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [location, setLocation] = useState(item.location)
  const {
    locationQuery,
    setLocationQuery,
    suggestions: locationSuggestions,
    clearSuggestions: clearLocationSuggestions,
  } = useLocationAutocomplete(location, item.location ?? '')
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const subtaskInputRef = useRef<TextInput>(null)

  const [reminders, setReminders] = useState<ReminderConfig[]>(item.reminderConfig ?? [])
  const [expandReminders, setExpandReminders] = useState(false)
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>('notification')
  const [selectedPersistent, setSelectedPersistent] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [travelConfig, setTravelConfig] = useState(item.travelConfig)
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false)
  const [studyTimeBefore, setStudyTimeBefore] = useState(item.academicConfig?.studyTimeBefore)
  const [gradeText, setGradeText] = useState(item.academicConfig?.grade !== undefined ? String(item.academicConfig.grade) : '')

  const [expandDate, setExpandDate] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)

  const handleClose = useCallback(async () => {
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
            const ac = { ...(item.academicConfig ?? {}) }
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
      const existingUsage = (licenseUsages ?? []).find(usage => usage.itemId === item.id)
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
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleClose()
      return true
    })
    return () => handler.remove()
  }, [handleClose])

  const handleToggleComplete = async () => {
    await toggleCompleted(item)
    onClose()
  }

  const handleDelete = () => {
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
    if (!text) return
    setNewSubtaskText('')
    await createItem({ title: text, parentId: item.id, type: 'task' })
    setTimeout(() => subtaskInputRef.current?.focus(), 100)
  }

  const openRepeatPanel = () => {
    setShowRepeatPanel(true)
  }

  const handleRepeatDone = (rule: RepeatRule, config: RepeatConfig) => {
    setRepeatRule(rule)
    setRepeatConfig(config)
    // Si la tarea todavía no tiene fecha, se infiere de la repetición misma.
    if (!scheduledDate) {
      const nextDate = computeNextDate(new Date(), {
        unit: config.unit,
        interval: config.interval,
        daysOfWeek: config.unit === 'week' ? config.daysOfWeek : undefined,
        end: 'never',
      })
      setScheduledDate(format(nextDate, 'yyyy-MM-dd'))
    }
    setShowRepeatPanel(false)
  }

  const repeatLabel = useMemo(() => {
    if (repeatRule === 'none') return undefined
    const unit = UNIT_OPTIONS.find((option) => option.value === (RULE_TO_UNIT[repeatRule] ?? 'week'))?.label ?? 'semana'
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
        ...prev.filter((reminder) => reminder.mode !== 'departure'),
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
    ? (settings?.categories ?? []).find(category => category.id === suggestedCategoryId)
    : undefined

  const isCompleted = item.status === 'completed'
  const allSubtasksDone = subtasks.length === 0 || subtasks.every(s => s.status === 'completed')
  const canComplete = allSubtasksDone
  const dateLabel = scheduledDate ? fmtDate(scheduledDate) : undefined
  const deadlineLabel = deadline ? fmtDate(deadline) : undefined

  return (
    <>
      <Modal
        visible
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
            {item.goalConfig && (
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
                      const parsedGrade = parseInt(digits, 10)
                      if (digits === '') { setGradeText(''); return }
                      setGradeText(String(Math.min(10, Math.max(1, parsedGrade))))
                    }}
                    keyboardType="numeric"
                    style={styles.gradeInput}
                    placeholder="1-10"
                    placeholderTextColor={colors.textMuted}
                    maxLength={2}
                    selectionColor={colors.primary}
                  />
                  {gradeText.trim() !== '' && (() => {
                    const parsedGrade = parseInt(gradeText, 10)
                    const passed = !isNaN(parsedGrade) && parsedGrade >= 4
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
                  onSubmitEditing={() => clearLocationSuggestions()}
                />
                {locationQuery ? (
                  <Pressable
                    onPress={() => { setLocationQuery(''); setLocation(undefined); clearLocationSuggestions() }}
                    hitSlop={8}
                  >
                    <X size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {locationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {locationSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.placeId}
                      style={({ pressed }) => [styles.suggestionItem, pressed && { opacity: 0.7 }]}
                      onPress={() => {
                        setLocation(suggestion.description)
                        setLocationQuery(suggestion.description)
                        clearLocationSuggestions()
                        Keyboard.dismiss()
                      }}
                    >
                      <MapPin size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
                      <Text style={styles.suggestionText} numberOfLines={2}>{suggestion.description}</Text>
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
              <ReminderPanel
                reminders={reminders}
                onChangeReminders={setReminders}
                alarmType={selectedAlarmType}
                onChangeAlarmType={setSelectedAlarmType}
                persistent={selectedPersistent}
                onChangePersistent={setSelectedPersistent}
                showTravelButton={Boolean(location && (scheduledDate || deadline))}
                travelTimeLoading={travelTimeLoading}
                hasTravelConfig={Boolean(travelConfig)}
                travelTimeResult={travelTimeResult}
                onCalculateTravelTime={() => void handleCalculateTravelTime()}
                colors={colors}
                indent
                rowDividers
              />
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

      {/* Repeat panel — same component as the "add task" flow */}
      <RepeatPanel
        visible={showRepeatPanel}
        rule={repeatRule}
        config={repeatConfig}
        startDate={scheduledDate}
        onClose={() => setShowRepeatPanel(false)}
        onDone={handleRepeatDone}
        colors={colors}
        insets={insets}
      />

      {/* Native pickers outside Modal to avoid Android nested dialog issue */}
      {showTimePicker && (
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
      {showEndTimePicker && (
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
      {showDeadlinePicker && (
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
