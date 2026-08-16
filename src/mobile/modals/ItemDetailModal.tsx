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
  AlarmClock,
  Bell,
  ChevronLeft,
  CircleCheck,
  Clock,
  CornerDownRight,
  MapPin,
  Minus,
  Plus,
  Repeat,
  Star,
  Tag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react-native'
import { MonthCalendar } from '../components/MonthCalendar'
import { RepeatPanel, UNIT_OPTIONS, RULE_TO_UNIT } from '../components/RepeatPanel'
import { ReminderPanel } from '../components/ReminderPanel'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useItems } from '../../application/items/useItems'
import { useItem } from '../../application/items/useItem'
import { useSubtasks } from '../../application/items/useSubtasks'
import { useLocationAutocomplete } from '../../application/items/useLocationAutocomplete'
import { useSettings, useLicenseUsages } from '../../application/settings/useSettings'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { computeNextDate } from '../../domain/items/services/recurrence'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import { Item, ITEM_TYPE, RepeatConfig, type ReminderConfigInput, type RepeatConfigInput, type RepeatRule, type TransportMode, type TravelConfigInput } from '../../domain/items'
import { createId } from '../../utils/id'
import { fetchTravelTime, getCurrentLocation, hasLocationPermission } from '../../infrastructure/maps/travelTime'
import { detectCategoryFromText } from '../../domain/items/services/categoryDetector'
import { isExamTask } from '../../domain/items/services/examDetector'

interface ItemDetailModalProps {
  itemId: string | undefined
  onClose: () => void
}

const fmtDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  if (isToday(date)) return 'HOY'
  return format(date, "EEE d 'de' MMM", { locale: es })
}

// Thin wrapper: mounts the actual form keyed on itemId, so it's a fresh component instance per
// item — no "reset on open" effect needed to re-seed ~20 fields of draft state.
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
  const { data: settings, saveSettings } = useSettings()
  const { data: licenseUsages, saveUsage, deleteUsage } = useLicenseUsages()
  const { accessToken } = useGoogleAuthStore()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const { data: subtasks = [] } = useSubtasks(item.id)

  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [important, setImportant] = useState(item.important ?? false)
  const [reminderOnly, setReminderOnly] = useState(item.reminderOnly ?? false)
  const [scheduledDate, setScheduledDate] = useState(item.startDate)
  const [scheduledTime, setScheduledTime] = useState(item.startTime)
  const [endTime, setEndTime] = useState(item.endTime)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [deadline, setDeadline] = useState(item.deadline)
  const [syncToCalendar, setSyncToCalendar] = useState(item.syncToCalendar ?? true)
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(item.repeatRule ?? 'none')
  const [repeatConfig, setRepeatConfig] = useState<RepeatConfigInput | undefined>(
    item.repeatConfig ? { ...item.repeatConfig, daysOfWeek: item.repeatConfig.daysOfWeek ? [...item.repeatConfig.daysOfWeek] : undefined } : undefined,
  )
  const [showRepeatPanel, setShowRepeatPanel] = useState(false)

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

  const [reminders, setReminders] = useState<ReminderConfigInput[]>(item.reminderConfig ? [...item.reminderConfig] : [])
  const [expandReminders, setExpandReminders] = useState(false)
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>(
    item.reminderConfig?.some(r => r.alarmType === 'alarm') ? 'alarm' : 'notification',
  )
  const [selectedPersistent, setSelectedPersistent] = useState(
    item.reminderConfig?.some(r => r.persistent) ?? false,
  )
  const [reminderOnlyUntilPickerOpen, setReminderOnlyUntilPickerOpen] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [travelConfig, setTravelConfig] = useState<TravelConfigInput | undefined>(item.travelConfig)
  const [transportMode, setTransportMode] = useState<TransportMode>(item.travelConfig?.transport ?? 'driving')
  const [extraMinutes, setExtraMinutes] = useState(item.travelConfig?.extraMinutes ?? 5)
  const [departureReminderEnabled, setDepartureReminderEnabled] = useState(item.travelConfig?.departureReminderEnabled ?? true)
  const [categorySuggestionDismissed, setCategorySuggestionDismissed] = useState(false)
  const [studyTimeBefore, setStudyTimeBefore] = useState(item.academicConfig?.studyTimeBefore)
  const [gradeText, setGradeText] = useState(item.academicConfig?.grade !== undefined ? String(item.academicConfig.grade) : '')

  const [expandDate, setExpandDate] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)
  const [reminderSetupOpen, setReminderSetupOpen] = useState(false)
  const [reminderSetupTime, setReminderSetupTime] = useState('09:00')
  const [reminderSetupInterval, setReminderSetupInterval] = useState(5)
  const [reminderSetupUnit, setReminderSetupUnit] = useState<'hours' | 'days'>('hours')
  const [reminderSetupUntil, setReminderSetupUntil] = useState<string | undefined>()
  const [reminderSetupShowTimePicker, setReminderSetupShowTimePicker] = useState(false)
  const [reminderSetupShowUntilPicker, setReminderSetupShowUntilPicker] = useState(false)

  const handleClose = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert(
        'Título vacío',
        '¿Cerrar sin guardar los cambios?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar', style: 'destructive', onPress: onClose },
        ],
      )
      return
    }
    try {
      await updateItem({
        id: item.id,
        patch: {
          title: title.trim(),
          description: description.trim() || undefined,
          important,
          reminderOnly,
          startDate: scheduledDate,
          startTime: scheduledTime,
          endDate: scheduledTime && endTime ? scheduledDate : undefined,
          endTime: scheduledTime ? endTime : undefined,
          deadline,
          syncToCalendar,
          repeatRule: repeatRule !== 'none' ? repeatRule : undefined,
          repeatConfig: repeatRule !== 'none' ? repeatConfig : undefined,
          categoryId,
          location: location || undefined,
          reminderConfig: reminderOnly
            ? [{ id: item.reminderConfig?.[0]?.id ?? createId(), mode: 'relative' as const, minutesBefore: 0, alarmType: selectedAlarmType, persistent: selectedPersistent }]
            : reminders.length > 0 ? reminders : undefined,
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
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
      return
    }

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
    onClose()
  }, [item, title, description, important, reminderOnly, scheduledDate, scheduledTime, endTime, deadline, syncToCalendar, travelConfig, repeatRule, repeatConfig, categoryId, location, reminders, selectedAlarmType, selectedPersistent, studyTimeBefore, gradeText, licenseUsages, saveUsage, deleteUsage, updateItem, onClose])

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (reminderOnlyUntilPickerOpen) { setReminderOnlyUntilPickerOpen(false); return true }
      if (reminderSetupShowUntilPicker) { setReminderSetupShowUntilPicker(false); return true }
      if (reminderSetupOpen) { setReminderSetupOpen(false); return true }
      void handleClose()
      return true
    })
    return () => handler.remove()
  }, [handleClose, reminderOnlyUntilPickerOpen, reminderSetupOpen, reminderSetupShowUntilPicker])

  const handleToggleComplete = async () => {
    try {
      await toggleCompleted(item)
    } catch (error) {
      Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
      return
    }
    await handleClose()
  }

  const handleDelete = () => {
    Alert.alert('Eliminar tarea', '¿Eliminar esta tarea?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeItem(item)
            onClose()
          } catch (error) {
            Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intentá de nuevo.')
          }
        },
      },
    ])
  }

  const addSubtask = async () => {
    const text = newSubtaskText.trim()
    if (!text) return
    setNewSubtaskText('')
    await createItem({ title: text, parentId: item.id, type: ITEM_TYPE.TASK })
    setTimeout(() => subtaskInputRef.current?.focus(), 100)
  }

  const removeSubtask = async (subtask: Item) => {
    await removeItem(subtask)
  }

  const handleRepeatDone = (rule: RepeatRule, config: RepeatConfigInput) => {
    setRepeatRule(rule)
    setRepeatConfig(config)
    // Si la tarea todavía no tiene fecha, se infiere de la repetición misma.
    if (!scheduledDate) {
      try {
        const nextDate = computeNextDate(new Date(), RepeatConfig.create({
          unit: config.unit,
          interval: config.interval,
          daysOfWeek: config.unit === 'week' ? config.daysOfWeek : undefined,
          end: 'never',
        }))
        setScheduledDate(format(nextDate, 'yyyy-MM-dd'))
      } catch {
        // Config todavía incompleta mientras se edita en el panel.
      }
    }
    setShowRepeatPanel(false)
  }

  const repeatLabel = useMemo(() => {
    if (repeatRule === 'none') return undefined
    const unit = UNIT_OPTIONS.find((option) => option.value === (RULE_TO_UNIT[repeatRule] ?? 'week'))?.label ?? 'semana'
    const interval = repeatConfig?.interval ?? 1
    return interval > 1 ? `Cada ${interval} ${unit}s` : `Cada ${unit}`
  }, [repeatRule, repeatConfig])

  // Apagar el switch saca el recordatorio de salida ya programado, no espera a "Recalcular".
  const handleToggleDepartureReminder = (value: boolean) => {
    setDepartureReminderEnabled(value)
    if (!value) {
      setReminders((prev) => prev.filter((reminder) => reminder.mode !== 'departure'))
      setTravelConfig((prev) => (prev ? { ...prev, departureReminderEnabled: false } : prev))
    }
  }

  const handleCalculateTravelTime = async () => {
    if (!location) return

    // Ya pedido antes y sigue sin permiso: el SO no vuelve a mostrar el diálogo, vamos directo a Configuración.
    if (settings?.locationPermissionRequested && !(await hasLocationPermission())) {
      setTravelTimeResult('Sin permiso — abriendo Configuración')
      void Linking.openSettings()
      return
    }

    setTravelTimeLoading(true)
    setTravelTimeResult(null)
    try {
      const pos = await getCurrentLocation()
      if (settings && !settings.locationPermissionRequested) {
        void saveSettings({ locationPermissionRequested: true })
      }
      if (!pos) { setTravelTimeResult('Sin permiso de ubicación'); return }
      const result = await fetchTravelTime(pos, location, transportMode)
      if (!result) { setTravelTimeResult('No se pudo calcular'); return }
      setTravelTimeResult(result.summary)
      // Reemplaza el recordatorio de salida anterior en vez de sumarlo. Si está desactivado,
      // solo se guarda el tiempo calculado sin programar notificación.
      const totalMins = result.minutes + extraMinutes
      setReminders((prev) => {
        const withoutDeparture = prev.filter((reminder) => reminder.mode !== 'departure')
        return departureReminderEnabled
          ? [...withoutDeparture, { id: createId(), mode: 'departure', minutesBefore: totalMins, alarmType: selectedAlarmType, persistent: selectedPersistent }]
          : withoutDeparture
      })
      setTravelConfig({ transport: transportMode, extraMinutes, departureReminderEnabled })
    } finally {
      setTravelTimeLoading(false)
    }
  }

  const suggestedCategoryId = useMemo(() => {
    if (categoryId || categorySuggestionDismissed) return undefined
    return detectCategoryFromText(title, DEFAULT_CATEGORIES)
  }, [title, categoryId, categorySuggestionDismissed])

  const showCategorySuggestion = Boolean(suggestedCategoryId)
  const suggestedCategory = suggestedCategoryId
    ? DEFAULT_CATEGORIES.find(category => category.id === suggestedCategoryId)
    : undefined

  const isCompleted = item.status === 'completed'
  const canComplete = Item.canComplete(item, subtasks)
  const dateLabel = scheduledDate ? fmtDate(scheduledDate) : undefined
  const deadlineLabel = deadline ? fmtDate(deadline) : undefined

  return (
    <>
      <Modal
        visible
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => {
          if (reminderOnlyUntilPickerOpen) { setReminderOnlyUntilPickerOpen(false); return }
          if (reminderSetupShowUntilPicker) { setReminderSetupShowUntilPicker(false); return }
          if (reminderSetupOpen) { setReminderSetupOpen(false); return }
          void handleClose()
        }}
      >
        <KeyboardAvoidingView
          style={[styles.container, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
              onPress={() => {
                if (reminderOnly) {
                  setReminderOnly(false)
                } else {
                  if (scheduledTime) {
                    setReminderSetupTime(scheduledTime)
                  } else {
                    const now = new Date()
                    const nextHour = new Date(now)
                    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
                    setReminderSetupTime(format(nextHour, 'HH:mm'))
                  }
                  if ((repeatRule === 'hourly' || repeatRule === 'daily') && repeatConfig) {
                    setReminderSetupUnit(repeatRule === 'hourly' ? 'hours' : 'days')
                    setReminderSetupInterval(repeatConfig.interval ?? 5)
                    if (repeatConfig.endDate) setReminderSetupUntil(repeatConfig.endDate)
                  }
                  setReminderSetupOpen(true)
                }
              }}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <AlarmClock
                size={22}
                color={reminderOnly ? colors.accent : colors.textMuted}
                fill={reminderOnly ? colors.accent : 'transparent'}
              />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Trash2 size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={[styles.titleInput, isCompleted && styles.titleCompleted]}
              multiline
              placeholder="Título"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
            />

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

            {!reminderOnly && (DEFAULT_CATEGORIES).length > 0 && (
              <View style={styles.categoryRow}>
                <Tag size={18} color={categoryId ? colors.primary : colors.textMuted} style={styles.rowIcon} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                  {(DEFAULT_CATEGORIES).map(cat => {
                    const active = categoryId === cat.id
                    const CategoryIcon = resolveCategoryIcon(cat.icon)
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setCategoryId(active ? undefined : cat.id)}
                        style={[
                          styles.categoryChip,
                          settings?.showCategoryIcons && { flexDirection: 'row', alignItems: 'center', gap: 6 },
                          active && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        {settings?.showCategoryIcons && (
                          <CategoryIcon size={13} color={active ? colors.onPrimary : cat.color} />
                        )}
                        <Text style={[styles.categoryChipText, active && { color: colors.onPrimary }]}>{cat.name}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {!reminderOnly && showCategorySuggestion && suggestedCategory && (
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

            {!reminderOnly && (categoryId === 'facultad' || suggestedCategoryId === 'facultad') && isExamTask(title) && (
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

            {!reminderOnly && (categoryId === 'facultad' || suggestedCategoryId === 'facultad') && isExamTask(title) && (
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

            {!reminderOnly && (
              <>
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
                      <Switch value={syncToCalendar} onValueChange={setSyncToCalendar} />
                    </View>
                  </>
                )}

                <View style={styles.rowDivider} />

                <Pressable style={styles.detailRow} onPress={() => setShowRepeatPanel(true)}>
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
                    transportMode={transportMode}
                    onChangeTransportMode={setTransportMode}
                    extraMinutes={extraMinutes}
                    onChangeExtraMinutes={setExtraMinutes}
                    departureReminderEnabled={departureReminderEnabled}
                    onChangeDepartureReminderEnabled={handleToggleDepartureReminder}
                    colors={colors}
                    indent
                    rowDividers
                  />
                )}

                <View style={styles.rowDivider} />

                {subtasks.map((sub) => (
                  <View key={sub.id} style={styles.subtaskRow}>
                    <Pressable
                      onPress={() => {
                        toggleCompleted(sub).catch((error: unknown) => {
                          Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                        })
                      }}
                      style={[
                        styles.subtaskCheck,
                        sub.status === 'completed' && { backgroundColor: colors.success, borderColor: colors.success },
                      ]}
                    />
                    <Text style={[styles.subtaskTitle, sub.status === 'completed' && styles.done]}>
                      {sub.title}
                    </Text>
                    <Pressable onPress={() => {
                      removeSubtask(sub).catch((error: unknown) => {
                        Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intentá de nuevo.')
                      })
                    }} hitSlop={8}>
                      <XCircle size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}

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
                  <Pressable onPress={() => void addSubtask()} disabled={!newSubtaskText.trim()} hitSlop={8}>
                    <Plus size={20} color={newSubtaskText.trim() ? colors.primary : colors.textMuted} />
                  </Pressable>
                </View>
              </>
            )}

            {reminderOnly && (() => {
              const roInterval = repeatConfig?.interval ?? 1
              const roUnit: 'hours' | 'days' = repeatRule === 'hourly' ? 'hours' : 'days'
              const roUntil = repeatConfig?.endDate
              return (
                <>
                  {/* Hora */}
                  <Pressable style={styles.detailRow} onPress={() => setShowTimePicker(true)}>
                    <Clock size={20} color={colors.primary} style={styles.rowIcon} />
                    <View style={[styles.chip, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.chipText, { color: colors.primary }]}>{scheduledTime ?? '—'}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.rowDivider} />

                  {/* Repetir cada */}
                  <View style={styles.detailRow}>
                    <Repeat size={20} color={colors.primary} style={styles.rowIcon} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Pressable
                        onPress={() => setRepeatConfig(prev => ({ unit: prev?.unit ?? 'hour', interval: Math.max(1, (prev?.interval ?? 1) - 1), end: prev?.end ?? 'never', endDate: prev?.endDate }))}
                        hitSlop={10}
                        style={styles.reminderStepBtn}
                      >
                        <Minus size={16} color={colors.primary} />
                      </Pressable>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, minWidth: 20, textAlign: 'center' }}>{roInterval}</Text>
                      <Pressable
                        onPress={() => setRepeatConfig(prev => ({ unit: prev?.unit ?? 'hour', interval: (prev?.interval ?? 1) + 1, end: prev?.end ?? 'never', endDate: prev?.endDate }))}
                        hitSlop={10}
                        style={styles.reminderStepBtn}
                      >
                        <Plus size={16} color={colors.primary} />
                      </Pressable>
                      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 4 }}>
                        {(['hours', 'days'] as const).map((u) => (
                          <Pressable
                            key={u}
                            onPress={() => {
                              setRepeatRule(u === 'hours' ? 'hourly' : 'daily')
                              setRepeatConfig(prev => ({ unit: u === 'hours' ? 'hour' : 'day', interval: prev?.interval ?? 1, end: prev?.end ?? 'never', endDate: prev?.endDate }))
                            }}
                            style={[styles.reminderUnitChip, roUnit === u && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                          >
                            <Text style={[styles.reminderUnitChipText, roUnit === u && { color: '#fff' }]}>
                              {u === 'hours' ? 'horas' : 'días'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.rowDivider} />

                  {/* Hasta */}
                  <Pressable style={styles.detailRow} onPress={() => setReminderOnlyUntilPickerOpen(true)}>
                    <CircleCheck size={20} color={roUntil ? colors.text : colors.textMuted} style={styles.rowIcon} />
                    {roUntil ? (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{format(new Date(roUntil + 'T00:00:00'), "d 'de' MMM", { locale: es })}</Text>
                        <Pressable onPress={(e) => { e.stopPropagation?.(); setRepeatConfig(prev => ({ unit: prev?.unit ?? 'hour', interval: prev?.interval ?? 1, end: 'never' })) }} hitSlop={8}>
                          <X size={12} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={styles.detailRowPlaceholder}>Fecha de fin (opcional)</Text>
                    )}
                  </Pressable>

                  <View style={styles.rowDivider} />

                  {/* Tipo */}
                  <View style={styles.detailRow}>
                    <Bell size={20} color={colors.textMuted} style={styles.rowIcon} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
                        style={[styles.reminderTypeBtn, selectedAlarmType === 'alarm' && styles.reminderTypeBtnAlarm]}
                        onPress={() => setSelectedAlarmType('alarm')}
                      >
                        <AlarmClock size={12} color={selectedAlarmType === 'alarm' ? colors.accent : colors.textMuted} />
                        <Text style={[styles.reminderTypeBtnText, selectedAlarmType === 'alarm' && { color: colors.accent, fontWeight: '600' }]}>
                          Alarma
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )
            })()}
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
            <Pressable
              style={({ pressed }) => [
                styles.completeBtn,
                !canComplete && !isCompleted && styles.completeBtnDisabled,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => {
                if (item.reminderOnly) {
                  Alert.alert('Recordatorio', 'Las tareas recordatorio no necesitan marcarse como completadas.')
                  return
                }
                if (!canComplete && !isCompleted) {
                  Alert.alert('Subtareas pendientes', 'Completá todas las subtareas primero.')
                  return
                }
                void handleToggleComplete()
              }}
            >
              <Text style={[styles.completeBtnText, !canComplete && !isCompleted && { color: colors.textMuted }]}>
                {item.reminderOnly ? 'Recordatorio' : isCompleted ? 'Marcar como no completada' : 'Marcar como completada'}
              </Text>
            </Pressable>
          </View>

          {reminderOnlyUntilPickerOpen && (
            <>
              <Pressable
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 }]}
                onPress={() => setReminderOnlyUntilPickerOpen(false)}
              />
              <View
                style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 11 }]}
                pointerEvents="box-none"
              >
                <View style={styles.reminderSetupCard} onStartShouldSetResponder={() => true}>
                  <View style={styles.reminderSetupHeader}>
                    <Text style={styles.reminderSetupTitle}>Hasta</Text>
                    <Pressable onPress={() => setReminderOnlyUntilPickerOpen(false)} hitSlop={12}>
                      <X size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <MonthCalendar
                    selectedDate={repeatConfig?.endDate}
                    onSelectDate={(d) => {
                      setRepeatConfig(prev => ({ unit: prev?.unit ?? 'hour', interval: prev?.interval ?? 1, end: 'on_date', endDate: d }))
                      setReminderOnlyUntilPickerOpen(false)
                    }}
                    colors={colors}
                    accentColor={colors.accent}
                  />
                </View>
              </View>
            </>
          )}

          {reminderSetupOpen && (
            <>
              <Pressable
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 }]}
                onPress={() => setReminderSetupOpen(false)}
              />
              <View
                style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 11 }]}
                pointerEvents="box-none"
              >
                <View style={styles.reminderSetupCard} onStartShouldSetResponder={() => true}>
                  <View style={styles.reminderSetupHeader}>
                    <Text style={styles.reminderSetupTitle}>Modo recordatorio</Text>
                    <Pressable onPress={() => setReminderSetupOpen(false)} hitSlop={12}>
                      <X size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.reminderSetupRow}
                    onPress={() => setReminderSetupShowTimePicker(true)}
                  >
                    <Text style={styles.reminderSetupLabel}>Hora de inicio</Text>
                    <Text style={[styles.reminderSetupValue, { color: colors.primary }]}>{reminderSetupTime}</Text>
                  </Pressable>

                  <View style={[styles.reminderSetupRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.reminderSetupLabel}>Repetir cada</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Pressable
                        onPress={() => setReminderSetupInterval((v) => Math.max(1, v - 1))}
                        hitSlop={10}
                        style={styles.reminderStepBtn}
                      >
                        <Minus size={16} color={colors.primary} />
                      </Pressable>
                      <Text style={[styles.reminderSetupValue, { minWidth: 24, textAlign: 'center' }]}>{reminderSetupInterval}</Text>
                      <Pressable
                        onPress={() => setReminderSetupInterval((v) => v + 1)}
                        hitSlop={10}
                        style={styles.reminderStepBtn}
                      >
                        <Plus size={16} color={colors.primary} />
                      </Pressable>
                      <View style={{ flexDirection: 'row', gap: 6, marginLeft: 4 }}>
                        {(['hours', 'days'] as const).map((u) => (
                          <Pressable
                            key={u}
                            onPress={() => setReminderSetupUnit(u)}
                            style={[
                              styles.reminderUnitChip,
                              reminderSetupUnit === u && { backgroundColor: colors.accent, borderColor: colors.accent },
                            ]}
                          >
                            <Text style={[styles.reminderUnitChipText, reminderSetupUnit === u && { color: '#fff' }]}>
                              {u === 'hours' ? 'horas' : 'días'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  <Pressable
                    style={styles.reminderSetupRow}
                    onPress={() => setReminderSetupShowUntilPicker(true)}
                  >
                    <Text style={styles.reminderSetupLabel}>Hasta (opcional)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {reminderSetupUntil ? (
                        <>
                          <Text style={[styles.reminderSetupValue, { color: colors.primary }]}>
                            {format(new Date(reminderSetupUntil + 'T00:00:00'), 'd MMM', { locale: es })}
                          </Text>
                          <Pressable onPress={(e) => { e.stopPropagation?.(); setReminderSetupUntil(undefined) }} hitSlop={8}>
                            <X size={13} color={colors.textMuted} />
                          </Pressable>
                        </>
                      ) : (
                        <Text style={{ fontSize: 14, color: colors.textMuted }}>—</Text>
                      )}
                    </View>
                  </Pressable>

                  <View style={styles.reminderSetupFooter}>
                    <Pressable
                      onPress={() => setReminderSetupOpen(false)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 8 })}
                    >
                      <Text style={{ fontSize: 15, color: colors.textSecondary }}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const now = new Date()
                        const [h, m] = reminderSetupTime.split(':').map(Number)
                        const todayStr = format(now, 'yyyy-MM-dd')
                        const todayAt = new Date(now)
                        todayAt.setHours(h, m, 0, 0)
                        if (!scheduledDate) {
                          const startDate = todayAt > now ? todayStr : format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd')
                          setScheduledDate(startDate)
                        }
                        setScheduledTime(reminderSetupTime)
                        setRepeatRule(reminderSetupUnit === 'hours' ? 'hourly' : 'daily')
                        setRepeatConfig({
                          unit: reminderSetupUnit === 'hours' ? 'hour' : 'day',
                          interval: reminderSetupInterval,
                          end: reminderSetupUntil ? 'on_date' : 'never',
                          endDate: reminderSetupUntil,
                        })
                        setReminderOnly(true)
                        setReminderSetupOpen(false)
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 8 })}
                    >
                      <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>Listo</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {reminderSetupShowUntilPicker && (
                <>
                  <Pressable
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 12 }]}
                    onPress={() => setReminderSetupShowUntilPicker(false)}
                  />
                  <View
                    style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 13 }]}
                    pointerEvents="box-none"
                  >
                    <View style={styles.reminderSetupCard} onStartShouldSetResponder={() => true}>
                      <View style={styles.reminderSetupHeader}>
                        <Text style={styles.reminderSetupTitle}>Hasta</Text>
                        <Pressable onPress={() => setReminderSetupShowUntilPicker(false)} hitSlop={12}>
                          <X size={20} color={colors.textMuted} />
                        </Pressable>
                      </View>
                      <MonthCalendar
                        selectedDate={reminderSetupUntil}
                        onSelectDate={(d) => {
                          setReminderSetupUntil(d)
                          setReminderSetupShowUntilPicker(false)
                        }}
                        colors={colors}
                        accentColor={colors.accent}
                      />
                    </View>
                  </View>
                </>
              )}
            </>
          )}
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
      {reminderSetupShowTimePicker && (
        <DateTimePicker
          value={parse(reminderSetupTime, 'HH:mm', new Date())}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setReminderSetupShowTimePicker(false)
            if (event.type === 'dismissed' || !date) return
            setReminderSetupTime(format(date, 'HH:mm'))
          }}
        />
      )}
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
    reminderSetupCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
    },
    reminderSetupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    reminderSetupTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    reminderSetupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    reminderSetupLabel: {
      fontSize: 15,
      color: colors.text,
    },
    reminderSetupValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    reminderStepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderUnitChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    reminderUnitChipText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    reminderSetupFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 24,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
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
    reminderTypeBtnAlarm: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    reminderTypeBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  })
