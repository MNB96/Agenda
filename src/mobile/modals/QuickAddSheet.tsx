import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AlignLeft,
  AlarmClock,
  Bell,
  Clock,
  CornerDownRight,
  Flag,
  ListChecks,
  MapPin,
  Minus,
  Plus,
  Repeat,
  Star,
  Tag,
  X,
  XCircle,
} from 'lucide-react-native'
import { fetchTravelTime, getCurrentLocation, hasLocationPermission } from '../../infrastructure/maps/travelTime'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { MonthCalendar } from '../components/MonthCalendar'
import { RepeatPanel, UNIT_OPTIONS, RULE_TO_UNIT } from '../components/RepeatPanel'
import { ReminderPanel } from '../components/ReminderPanel'
import { parseQuickInput } from '../../domain/items/services/quickInputParser'
import { detectCategoryFromText } from '../../domain/items/services/categoryDetector'
import { isExamTask } from '../../domain/items/services/examDetector'
import { useItems } from '../../application/items/useItems'
import { useLocationAutocomplete } from '../../application/items/useLocationAutocomplete'
import { useSettings, useLicenseUsages } from '../../application/settings/useSettings'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { computeNextDate } from '../../domain/items/services/recurrence'
import { ITEM_TYPE, RepeatConfig, type ReminderConfigInput, type RepeatConfigInput, type RepeatRule, type TransportMode, type TravelConfigInput } from '../../domain/items'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import { createId } from '../../utils/id'

type Panel = 'main' | 'date' | 'repeat'

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
}

const fmtShort = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return isToday(date) ? 'HOY' : format(date, 'd MMM', { locale: es })
}

const fmtFull = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return isToday(date) ? 'HOY' : format(date, "EEE d 'de' MMM", { locale: es })
}

const NlChip = ({
  label,
  onDismiss,
  colors,
}: {
  label: string
  onDismiss: () => void
  colors: ThemeTokens
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft + '33',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    }}
  >
    <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>{label}</Text>
    <Pressable onPress={onDismiss} hitSlop={8}>
      <X size={12} color={colors.primary} />
    </Pressable>
  </View>
)

const ActionIcon = ({
  icon: Icon,
  label,
  active,
  activeColor,
  onPress,
  colors,
}: {
  icon: React.ComponentType<{ size: number; color: string }>
  label: string
  active: boolean
  activeColor?: string
  onPress: () => void
  colors: ThemeTokens
}) => {
  const color = active ? (activeColor ?? colors.primary) : colors.textMuted
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        padding: 8,
        borderRadius: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon size={22} color={color} />
    </Pressable>
  )
}

const OptionRow = ({
  label,
  value,
  onPress,
  onClear,
  icon: Icon,
  colors,
}: {
  label: string
  value?: string
  onPress: () => void
  onClear?: () => void
  icon?: React.ComponentType<{ size: number; color: string }>
  colors: ThemeTokens
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
      opacity: pressed ? 0.7 : 1,
    })}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {Icon ? <Icon size={18} color={colors.textMuted} /> : null}
      <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {value ? (
        <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '500' }}>{value}</Text>
      ) : (
        <Text style={{ fontSize: 14, color: colors.textMuted }}>—</Text>
      )}
      {onClear && value ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <X size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  </Pressable>
)

const RowDivider = ({ colors }: { colors: ThemeTokens }) => (
  <View style={{ height: 1, backgroundColor: colors.border }} />
)

export const QuickAddSheet = ({ open, onClose }: QuickAddSheetProps) => {
  const { createItem, isSaving } = useItems()
  const { data: settings, saveSettings } = useSettings()
  const { saveUsage } = useLicenseUsages()
  const { accessToken } = useGoogleAuthStore()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const titleRef = useRef<TextInput>(null)
  const descRef = useRef<TextInput>(null)
  const locationInputRef = useRef<TextInput>(null)

  const [panel, setPanel] = useState<Panel>('main')

  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  const [reminderOnly, setReminderOnly] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | undefined>()
  const [scheduledTime, setScheduledTime] = useState<string | undefined>()
  const [endTime, setEndTime] = useState<string | undefined>()
  const [deadline, setDeadline] = useState<string | undefined>()
  const [syncToCalendar, setSyncToCalendar] = useState(true)
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none')
  const [repeatConfig, setRepeatConfig] = useState<RepeatConfigInput | undefined>()
  const [reminders, setReminders] = useState<ReminderConfigInput[]>([])
  const [description, setDescription] = useState('')

  const [showDescInput, setShowDescInput] = useState(false)
  const [categoryId, setCategoryId] = useState<string | undefined>()

  const [showSubtasksInput, setShowSubtasksInput] = useState(false)
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([])
  const [newSubtaskText, setNewSubtaskText] = useState('')

  const [location, setLocation] = useState<string | undefined>()
  const {
    locationQuery,
    setLocationQuery,
    suggestions: locationSuggestions,
    clearSuggestions: clearLocationSuggestions,
    reset: resetLocationAutocomplete,
  } = useLocationAutocomplete(location)
  const [showLocationInput, setShowLocationInput] = useState(false)

  // NL dismissal flags (user tapped × on auto-detected chip)
  const [nlDateDismissed, setNlDateDismissed] = useState(false)
  const [nlTimeDismissed, setNlTimeDismissed] = useState(false)
  const [nlCategoryDismissed, setNlCategoryDismissed] = useState(false)
  const [nlDeadlineDismissed, setNlDeadlineDismissed] = useState(false)
  const [directDeadlineOpen, setDirectDeadlineOpen] = useState(false)
  const [directDeadlineKey, setDirectDeadlineKey] = useState(0)
  const [studyTimeBefore, setStudyTimeBefore] = useState<'half' | 'full' | undefined>()

  const [tempDate, setTempDate] = useState<string | undefined>()
  const [tempTime, setTempTime] = useState<string | undefined>()
  const [tempEndTime, setTempEndTime] = useState<string | undefined>()
  const [showNativeEndTime, setShowNativeEndTime] = useState(false)
  const [tempDeadline, setTempDeadline] = useState<string | undefined>()
  const [tempRepeat, setTempRepeat] = useState<RepeatRule>('none')
  const [tempReminders, setTempReminders] = useState<ReminderConfigInput[]>([])
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>('notification')
  const [selectedPersistent, setSelectedPersistent] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [travelConfig, setTravelConfig] = useState<TravelConfigInput | undefined>()
  const [transportMode, setTransportMode] = useState<TransportMode>('driving')
  const [extraMinutes, setExtraMinutes] = useState(5)
  const [departureReminderEnabled, setDepartureReminderEnabled] = useState(true)
  // Bumped to force MonthCalendar to remount and re-read its initial month from selectedDate.
  const [dateCalendarKey, setDateCalendarKey] = useState(0)
  const [deadlineCalendarKey, setDeadlineCalendarKey] = useState(0)
  const [timeEnabled, setTimeEnabled] = useState(false)
  const [showNativeTime, setShowNativeTime] = useState(false)
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false)
  const [expandReminder, setExpandReminder] = useState(false)
  const [reminderSetupOpen, setReminderSetupOpen] = useState(false)
  const [reminderSetupTime, setReminderSetupTime] = useState('09:00')
  const [reminderSetupInterval, setReminderSetupInterval] = useState(5)
  const [reminderSetupUnit, setReminderSetupUnit] = useState<'hours' | 'days'>('hours')
  const [reminderSetupUntil, setReminderSetupUntil] = useState<string | undefined>()
  const [reminderSetupShowTimePicker, setReminderSetupShowTimePicker] = useState(false)
  const [reminderSetupShowUntilPicker, setReminderSetupShowUntilPicker] = useState(false)

  // Promoted to repeatRule/repeatConfig only when the outer date panel commits.
  const [tempRepeatConfig, setTempRepeatConfig] = useState<RepeatConfigInput | undefined>()

  const parsed = useMemo(() => {
    if (!text.trim()) return null
    return parseQuickInput(text)
  }, [text])

  // Explicit takes priority over NL-inferred.
  const effectiveDate = scheduledDate ?? (nlDateDismissed ? undefined : parsed?.inferred.startDate)
  const effectiveTime = scheduledTime ?? (nlTimeDismissed ? undefined : parsed?.inferred.startTime)
  const effectiveDeadline = deadline ?? (nlDeadlineDismissed ? undefined : parsed?.inferred.deadline)

  const showNlDate = !scheduledDate && !nlDateDismissed && Boolean(parsed?.inferred.startDate)
  const showNlTime = !scheduledTime && !nlTimeDismissed && Boolean(parsed?.inferred.startTime)

  const suggestedCategoryId = useMemo(() => {
    if (categoryId || nlCategoryDismissed) return undefined
    return detectCategoryFromText(text, DEFAULT_CATEGORIES)
  }, [text, categoryId, nlCategoryDismissed])
  const effectiveCategoryId = categoryId ?? suggestedCategoryId
  const showNlCategory = Boolean(suggestedCategoryId) && !categoryId && !nlCategoryDismissed

  // Adjusted during render (React's pattern for "reset state when a prop changes") instead of
  // an effect, so it runs before paint without affecting the Modal's own slide animation.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPanel('main')
      setExpandReminder(false)

      setText('')
      setImportant(false)
      setReminderOnly(false)
      setScheduledDate(undefined)
      setScheduledTime(undefined)
      setEndTime(undefined)
      setDeadline(undefined)
      setSyncToCalendar(true)
      setRepeatRule('none')
      setRepeatConfig(undefined)
      setReminders([])
      setTravelConfig(undefined)
      setTransportMode('driving')
      setExtraMinutes(5)
      setDepartureReminderEnabled(true)
      setDescription('')
      setShowDescInput(false)
      setCategoryId(undefined)
      setShowSubtasksInput(false)
      setPendingSubtasks([])
      setNewSubtaskText('')
      setNlDateDismissed(false)
      setNlTimeDismissed(false)
      setNlCategoryDismissed(false)
      setNlDeadlineDismissed(false)
      setDirectDeadlineOpen(false)
      setReminderSetupOpen(false)
      setReminderSetupTime('09:00')
      setReminderSetupInterval(5)
      setReminderSetupUnit('hours')
      setReminderSetupUntil(undefined)
      setReminderSetupShowTimePicker(false)
      setReminderSetupShowUntilPicker(false)
      setStudyTimeBefore(undefined)
      setLocation(undefined)
      resetLocationAutocomplete('')
      setShowLocationInput(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return true }
      if (reminderSetupShowUntilPicker) { setReminderSetupShowUntilPicker(false); return true }
      if (reminderSetupOpen) { setReminderSetupOpen(false); return true }
      if (directDeadlineOpen) { setDirectDeadlineOpen(false); return true }
      if (panel === 'repeat') { setPanel('date'); return true }
      if (panel !== 'main') { setPanel('main'); return true }
      onClose()
      return true
    })
    return () => handler.remove()
  }, [open, panel, onClose, deadlinePickerOpen, directDeadlineOpen, reminderSetupOpen, reminderSetupShowUntilPicker])

  const openDatePanel = useCallback(() => {
    Keyboard.dismiss()
    setTempDate(effectiveDate)
    setTempTime(effectiveTime)
    setTempDeadline(effectiveDeadline)
    setTempRepeat(repeatRule)
    setTempRepeatConfig(repeatConfig)
    setTempReminders(reminders)
    setTempEndTime(endTime)
    setTimeEnabled(Boolean(effectiveTime))
    setExpandReminder(false)
    setDeadlinePickerOpen(false)
    setDateCalendarKey((k) => k + 1)
    setPanel('date')
  }, [effectiveDate, effectiveTime, effectiveDeadline, repeatRule, repeatConfig, reminders, endTime])

  const handleRepeatDone = useCallback((rule: RepeatRule, config: RepeatConfigInput) => {
    setTempRepeat(rule)
    setTempRepeatConfig(config)
    // Si no eligieron fecha, se infiere de la repetición misma en vez de dejarla sin fecha.
    if (!tempDate) {
      try {
        const nextDate = computeNextDate(new Date(), RepeatConfig.create({
          unit: config.unit,
          interval: config.interval,
          daysOfWeek: config.unit === 'week' ? config.daysOfWeek : undefined,
          end: 'never',
        }))
        setTempDate(format(nextDate, 'yyyy-MM-dd'))
        setDateCalendarKey((k) => k + 1)
      } catch {
        // Config todavía inválida mientras se edita el panel.
      }
    }
    setPanel('date')
  }, [tempDate])

  const commitDate = useCallback(() => {
    setScheduledDate(tempDate)
    setScheduledTime(timeEnabled ? tempTime : undefined)
    setEndTime(timeEnabled ? tempEndTime : undefined)
    setDeadline(tempDeadline)
    setRepeatRule(tempRepeat)
    setRepeatConfig(tempRepeat !== 'none' ? tempRepeatConfig : undefined)
    setReminders(tempReminders)
    if (tempDate) setNlDateDismissed(true)
    if (timeEnabled && tempTime) setNlTimeDismissed(true)
    setPanel('main')
    setTimeout(() => titleRef.current?.focus(), 150)
  }, [
    tempDate,
    timeEnabled,
    tempTime,
    tempEndTime,
    tempDeadline,
    tempRepeat,
    tempRepeatConfig,
    tempReminders,
  ])

  const handleSave = async () => {
    const title = text.trim()
    if (!title) return

    const payload = {
      title,
      important,
      reminderOnly,
      startDate: effectiveDate,
      startTime: effectiveTime,
      endDate: effectiveTime && endTime ? effectiveDate : undefined,
      endTime: effectiveTime ? endTime : undefined,
      deadline: effectiveDeadline,
      syncToCalendar,
      repeatRule: repeatRule !== 'none' ? repeatRule : undefined,
      repeatConfig: repeatRule !== 'none' ? repeatConfig : undefined,
      reminderConfig: reminders.length > 0 ? reminders : undefined,
      travelConfig,
      description: description.trim() || undefined,
      categoryId: effectiveCategoryId,
      location: location || undefined,
      academicConfig: studyTimeBefore ? { studyTimeBefore } : undefined,
    }

    let created
    try {
      created = await createItem(payload)
      for (const subtaskTitle of pendingSubtasks) {
        await createItem({ title: subtaskTitle, parentId: created.id, type: ITEM_TYPE.TASK })
      }
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
      return
    }
    if (studyTimeBefore && created) {
      const days = studyTimeBefore === 'half' ? 0.5 : 1
      await saveUsage({
        id: createId(),
        itemId: created.id,
        date: effectiveDate ?? effectiveDeadline ?? new Date().toISOString().slice(0, 10),
        days,
        note: title,
      })
    }
    onClose()
  }

  const addPendingSubtask = () => {
    const text = newSubtaskText.trim()
    if (!text) return
    setNewSubtaskText('')
    setPendingSubtasks((prev) => [...prev, text])
  }

  const removePendingSubtask = (index: number) => {
    setPendingSubtasks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDayPress = (dayStr: string) => {
    setTempDate(dayStr === tempDate ? undefined : dayStr)
  }

  const handleNativeTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowNativeTime(false)
    if (event.type === 'dismissed' || !date) return
    setTempTime(format(date, 'HH:mm'))
  }

  // Apagar el switch saca el recordatorio de salida ya programado, no espera a "Calcular".
  const handleToggleDepartureReminder = (value: boolean) => {
    setDepartureReminderEnabled(value)
    if (!value) {
      setTempReminders((prev) => prev.filter((reminder) => reminder.mode !== 'departure'))
      setTravelConfig((prev) => (prev ? { ...prev, departureReminderEnabled: false } : prev))
    }
  }

  const handleCalculateTravelTime = async () => {
    if (!location) return

    // Si ya pedimos el permiso y lo sigue sin tener, el SO no vuelve a mostrar el diálogo.
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
      // Reemplaza el recordatorio de salida anterior en vez de sumarlo.
      const totalMins = result.minutes + extraMinutes
      setTempReminders((prev) => {
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

  const handleBackdropPress = () => {
    if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
    if (reminderSetupShowUntilPicker) { setReminderSetupShowUntilPicker(false); return }
    if (reminderSetupOpen) { setReminderSetupOpen(false); return }
    if (directDeadlineOpen) { setDirectDeadlineOpen(false); return }
    if (panel === 'repeat') { setPanel('date'); return }
    if (panel === 'date') {
      setPanel('main')
      setTimeout(() => titleRef.current?.focus(), 150)
      return
    }
    onClose()
  }

  const dateBadge = useMemo(() => {
    if (!effectiveDate) return null
    const parts: string[] = [fmtFull(effectiveDate)]
    if (effectiveTime) parts.push(effectiveTime)
    if (effectiveDeadline) parts.push(`límite ${fmtShort(effectiveDeadline)}`)
    return parts.join(' · ')
  }, [effectiveDate, effectiveTime, effectiveDeadline])

  const canSave = text.trim().length > 0

  const repeatLabel = useMemo(() => {
    if (tempRepeat === 'none') return undefined
    const interval = tempRepeatConfig?.interval ?? 1
    const unit = UNIT_OPTIONS.find(option => option.value === (RULE_TO_UNIT[tempRepeat] ?? 'week'))?.label ?? 'semana'
    return interval > 1 ? `Cada ${interval} ${unit}s` : `Cada ${unit}`
  }, [tempRepeat, tempRepeatConfig])
  const reminderCount = tempReminders.length

  const renderMainPanel = () => (
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.dragHandle} />

        <TextInput
          ref={titleRef}
          value={text}
          onChangeText={setText}
          placeholder="Nueva tarea"
          placeholderTextColor={colors.textMuted}
          style={styles.mainInput}
          multiline
          autoFocus
          returnKeyType="default"
          blurOnSubmit={false}
          selectionColor={colors.primary}
          textAlignVertical="top"
        />

        {showDescInput && (
          <>
            <TextInput
              ref={descRef}
              value={description}
              onChangeText={setDescription}
              placeholder="Agregar detalles"
              placeholderTextColor={colors.textMuted}
              style={styles.inlineDescInput}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
              selectionColor={colors.primary}
              textAlignVertical="top"
            />
            {DEFAULT_CATEGORIES.length > 0 && (
              <View style={styles.categoryRow}>
                <Tag size={15} color={categoryId ? colors.primary : colors.textMuted} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
                  {DEFAULT_CATEGORIES.map(cat => {
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
          </>
        )}

        {showSubtasksInput && (
          <View style={styles.subtaskSection}>
            {pendingSubtasks.map((subtaskTitle, index) => (
              <View key={index} style={styles.subtaskRow}>
                <View style={styles.subtaskCheck} />
                <Text style={styles.subtaskTitle}>{subtaskTitle}</Text>
                <Pressable onPress={() => removePendingSubtask(index)} hitSlop={8}>
                  <XCircle size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.subtaskInputRow}>
              <CornerDownRight size={18} color={colors.textMuted} />
              <TextInput
                value={newSubtaskText}
                onChangeText={setNewSubtaskText}
                placeholder="Agregar subtarea"
                placeholderTextColor={colors.textMuted}
                style={styles.subtaskInput}
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={addPendingSubtask}
                selectionColor={colors.primary}
              />
              <Pressable onPress={addPendingSubtask} disabled={!newSubtaskText.trim()} hitSlop={8}>
                <Plus size={20} color={newSubtaskText.trim() ? colors.primary : colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {showLocationInput && (
          <View>
            <View style={styles.locationInputRow}>
              <MapPin size={15} color={location ? colors.primary : colors.textMuted} />
              <TextInput
                ref={locationInputRef}
                value={locationQuery}
                onChangeText={(text) => {
                  setLocationQuery(text)
                  if (!text.trim()) setLocation(undefined)
                }}
                placeholder="Agregar dirección"
                placeholderTextColor={colors.textMuted}
                style={styles.locationInput}
                returnKeyType="done"
                selectionColor={colors.primary}
                onSubmitEditing={() => clearLocationSuggestions()}
              />
              {locationQuery ? (
                <Pressable
                  onPress={() => {
                    setLocationQuery('')
                    setLocation(undefined)
                    clearLocationSuggestions()
                  }}
                  hitSlop={8}
                >
                  <X size={14} color={colors.textMuted} />
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
        )}

        {(showNlDate || showNlTime || showNlCategory) && (
          <View style={styles.chipsRow}>
            {showNlDate && parsed?.inferred.startDate && (
              <NlChip
                label={fmtShort(parsed.inferred.startDate)}
                onDismiss={() => setNlDateDismissed(true)}
                colors={colors}
              />
            )}
            {showNlTime && parsed?.inferred.startTime && (
              <NlChip
                label={parsed.inferred.startTime}
                onDismiss={() => setNlTimeDismissed(true)}
                colors={colors}
              />
            )}
            {showNlCategory && suggestedCategoryId && (
              <NlChip
                label={`🏷 ${DEFAULT_CATEGORIES.find((category) => category.id === suggestedCategoryId)?.name ?? suggestedCategoryId}`}
                onDismiss={() => setNlCategoryDismissed(true)}
                colors={colors}
              />
            )}
          </View>
        )}

        {effectiveCategoryId === 'facultad' && isExamTask(text) && (
          <View style={styles.studyTimeRow}>
            <Text style={styles.studyTimeLabel}>Día de estudio</Text>
            <View style={styles.studyTimeChips}>
              {([
                { value: undefined, label: 'Ninguno' },
                { value: 'half' as const, label: '½ día' },
                { value: 'full' as const, label: '1 día' },
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

        {effectiveDeadline && !effectiveDate && (
          <Pressable style={[styles.dateBadge, { backgroundColor: colors.accent + '18' }]} onPress={() => { setDirectDeadlineKey((k) => k + 1); setDirectDeadlineOpen(true) }}>
            <Flag size={12} color={colors.accent} />
            <Text style={[styles.dateBadgeText, { color: colors.accent }]} numberOfLines={1}>límite {fmtShort(effectiveDeadline)}</Text>
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.()
                setDeadline(undefined)
                setNlDeadlineDismissed(true)
              }}
            >
              <X size={11} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}

        {dateBadge && !showNlDate && !showNlTime && (
          <Pressable style={styles.dateBadge} onPress={openDatePanel}>
            <Clock size={12} color={colors.primary} />
            <Text style={styles.dateBadgeText} numberOfLines={1}>{dateBadge}</Text>
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.()
                setScheduledDate(undefined)
                setScheduledTime(undefined)
                setDeadline(undefined)
                setRepeatRule('none')
                setRepeatConfig(undefined)
                setNlDeadlineDismissed(true)
              }}
            >
              <X size={11} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}

        <View style={styles.actionBar}>
          <View style={styles.actionIcons}>
            <ActionIcon
              icon={AlignLeft}
              label="Detalles"
              active={showDescInput || Boolean(description.trim())}
              onPress={() => {
                if (showDescInput) {
                  setShowDescInput(false)
                  Keyboard.dismiss()
                } else {
                  setShowDescInput(true)
                  setTimeout(() => descRef.current?.focus(), 50)
                }
              }}
              colors={colors}
            />
            <ActionIcon
              icon={Clock}
              label="Fecha y hora"
              active={Boolean(effectiveDate)}
              onPress={openDatePanel}
              colors={colors}
            />
            <ActionIcon
              icon={Flag}
              label="Fecha límite"
              active={Boolean(effectiveDeadline)}
              activeColor={colors.accent}
              onPress={() => {
                Keyboard.dismiss()
                setDirectDeadlineKey((k) => k + 1)
                setDirectDeadlineOpen(true)
              }}
              colors={colors}
            />
            <ActionIcon
              icon={ListChecks}
              label="Subtareas"
              active={showSubtasksInput || pendingSubtasks.length > 0}
              onPress={() => {
                if (showSubtasksInput) {
                  setShowSubtasksInput(false)
                  Keyboard.dismiss()
                } else {
                  setShowSubtasksInput(true)
                }
              }}
              colors={colors}
            />
            <ActionIcon
              icon={MapPin}
              label="Dirección"
              active={showLocationInput || Boolean(location)}
              onPress={() => {
                if (showLocationInput) {
                  setShowLocationInput(false)
                  setLocationQuery('')
                  setLocation(undefined)
                  clearLocationSuggestions()
                  Keyboard.dismiss()
                } else {
                  setShowLocationInput(true)
                  setTimeout(() => locationInputRef.current?.focus(), 50)
                }
              }}
              colors={colors}
            />
            <ActionIcon
              icon={Star}
              label="Importante"
              active={important}
              activeColor="#F38630"
              onPress={() => setImportant((v) => !v)}
              colors={colors}
            />
            <ActionIcon
              icon={AlarmClock}
              label="Recordatorio recurrente"
              active={reminderOnly}
              activeColor={colors.accent}
              onPress={() => {
                if (reminderOnly) {
                  setReminderOnly(false)
                } else {
                  const now = new Date()
                  const nextHour = new Date(now)
                  nextHour.setHours(now.getHours() + 1, 0, 0, 0)
                  setReminderSetupTime(format(nextHour, 'HH:mm'))
                  setReminderSetupOpen(true)
                }
              }}
              colors={colors}
            />
          </View>

          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave || isSaving}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            accessibilityLabel="Guardar"
          >
            <Text
              style={[
                styles.saveBtn,
                !canSave && styles.saveBtnDisabled,
              ]}
            >
              Guardar
            </Text>
          </Pressable>
        </View>
      </View>
  )

  const renderDeadlinePicker = () => (
    <>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        onPress={() => setDeadlinePickerOpen(false)}
      />
      <View style={styles.deadlineOverlay} pointerEvents="box-none">
        <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
          <View style={styles.deadlineCardHeader}>
            <Text style={styles.deadlineCardTitle}>Fecha límite</Text>
            <Pressable onPress={() => setDeadlinePickerOpen(false)} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <MonthCalendar
            key={deadlineCalendarKey}
            selectedDate={tempDeadline}
            onSelectDate={(d) => {
              setTempDeadline(d)
              setDeadlinePickerOpen(false)
            }}
            colors={colors}
            accentColor={colors.accent}
          />

          {tempDeadline && (
            <Pressable
              onPress={() => { setTempDeadline(undefined); setDeadlinePickerOpen(false) }}
              style={styles.deadlineRemoveRow}
            >
              <Text style={styles.deadlineRemoveText}>Quitar fecha límite</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  )

  const renderReminderSetupPanel = () => (
    <>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        onPress={() => setReminderSetupOpen(false)}
      />
      <View style={styles.deadlineOverlay} pointerEvents="box-none">
        <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
          <View style={styles.deadlineCardHeader}>
            <Text style={styles.deadlineCardTitle}>Modo recordatorio</Text>
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
                  <Text style={[styles.reminderSetupValue, { color: colors.primary }]}>{fmtShort(reminderSetupUntil)}</Text>
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); setReminderSetupUntil(undefined) }}
                    hitSlop={8}
                  >
                    <X size={13} color={colors.textMuted} />
                  </Pressable>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: colors.textMuted }}>—</Text>
              )}
            </View>
          </Pressable>

          <View style={styles.datePanelFooter}>
            <Pressable
              onPress={() => setReminderSetupOpen(false)}
              style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const now = new Date()
                const [h, m] = reminderSetupTime.split(':').map(Number)
                const todayStr = format(now, 'yyyy-MM-dd')
                const todayAt = new Date(now)
                todayAt.setHours(h, m, 0, 0)
                const startDate = todayAt > now ? todayStr : format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd')
                setScheduledDate(startDate)
                setScheduledTime(reminderSetupTime)
                setNlDateDismissed(true)
                setNlTimeDismissed(true)
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
              style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.footerBtnText, { color: colors.primary, fontWeight: '700' }]}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {reminderSetupShowUntilPicker && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
            onPress={() => setReminderSetupShowUntilPicker(false)}
          />
          <View style={styles.deadlineOverlay} pointerEvents="box-none">
            <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
              <View style={styles.deadlineCardHeader}>
                <Text style={styles.deadlineCardTitle}>Hasta</Text>
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
  )

  const renderDirectDeadlinePicker = () => (
    <>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        onPress={() => setDirectDeadlineOpen(false)}
      />
      <View style={styles.deadlineOverlay} pointerEvents="box-none">
        <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
          <View style={styles.deadlineCardHeader}>
            <Text style={styles.deadlineCardTitle}>Fecha límite</Text>
            <Pressable onPress={() => setDirectDeadlineOpen(false)} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <MonthCalendar
            key={directDeadlineKey}
            selectedDate={effectiveDeadline}
            onSelectDate={(d) => {
              setDeadline(d)
              setNlDeadlineDismissed(true)
              setDirectDeadlineOpen(false)
            }}
            colors={colors}
            accentColor={colors.accent}
          />
          {effectiveDeadline && (
            <Pressable
              onPress={() => {
                setDeadline(undefined)
                setNlDeadlineDismissed(true)
                setDirectDeadlineOpen(false)
              }}
              style={styles.deadlineRemoveRow}
            >
              <Text style={styles.deadlineRemoveText}>Quitar fecha límite</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  )

  const renderDatePanel = () => (
      <View
        style={[styles.sheet, styles.datePanelSheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.dragHandle} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <MonthCalendar
            key={dateCalendarKey}
            selectedDate={tempDate}
            onSelectDate={handleDayPress}
            colors={colors}
            accentColor={colors.primary}
          />

          <View style={styles.optionsSeparator} />

          <OptionRow
            label="Establecer hora"
            value={timeEnabled ? (tempTime ?? undefined) : undefined}
            onPress={() => {
              const next = !timeEnabled
              setTimeEnabled(next)
              if (next) {
                setShowNativeTime(true)
                if (!tempTime) setTempTime(format(new Date(), 'HH:mm'))
              }
            }}
            onClear={timeEnabled ? () => { setTimeEnabled(false); setTempTime(undefined) } : undefined}
            icon={Clock}
            colors={colors}
          />
          <RowDivider colors={colors} />

          {timeEnabled && (
            <>
              <OptionRow
                label="Hasta"
                value={tempEndTime}
                onPress={() => setShowNativeEndTime(true)}
                onClear={tempEndTime ? () => setTempEndTime(undefined) : undefined}
                icon={Clock}
                colors={colors}
              />
              <RowDivider colors={colors} />
            </>
          )}

          <OptionRow
            label="Repetir"
            value={repeatLabel}
            onPress={() => setPanel('repeat')}
            onClear={tempRepeat !== 'none' ? () => { setTempRepeat('none'); setTempRepeatConfig(undefined) } : undefined}
            icon={Repeat}
            colors={colors}
          />

          <RowDivider colors={colors} />

          <OptionRow
            label="Fecha límite"
            value={tempDeadline ? fmtShort(tempDeadline) : undefined}
            onPress={() => {
              setDeadlineCalendarKey((k) => k + 1)
              setDeadlinePickerOpen(true)
            }}
            onClear={tempDeadline ? () => setTempDeadline(undefined) : undefined}
            icon={Flag}
            colors={colors}
          />

          <RowDivider colors={colors} />

          <OptionRow
            label="Recordatorio"
            value={reminderCount > 0 ? `${reminderCount} activo${reminderCount !== 1 ? 's' : ''}` : undefined}
            onPress={() => setExpandReminder((v) => !v)}
            onClear={reminderCount > 0 ? () => setTempReminders([]) : undefined}
            icon={Bell}
            colors={colors}
          />
          {expandReminder && (
            <ReminderPanel
              reminders={tempReminders}
              onChangeReminders={setTempReminders}
              alarmType={selectedAlarmType}
              onChangeAlarmType={setSelectedAlarmType}
              persistent={selectedPersistent}
              onChangePersistent={setSelectedPersistent}
              showTravelButton={Boolean(location && tempDate)}
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
            />
          )}

          {accessToken && (
            <>
              <RowDivider colors={colors} />
              <View style={styles.syncRow}>
                <Text style={styles.syncRowLabel}>Sincronizar con Google Calendar</Text>
                <Switch value={syncToCalendar} onValueChange={setSyncToCalendar} />
              </View>
            </>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        <View style={styles.datePanelFooter}>
          <Pressable
            onPress={() => {
              setPanel('main')
              setTimeout(() => titleRef.current?.focus(), 150)
            }}
            style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={commitDate}
            style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.footerBtnText, { color: colors.primary, fontWeight: '700' }]}>Listo</Text>
          </Pressable>
        </View>
      </View>
  )

  return (
    <>
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
        if (reminderSetupShowUntilPicker) { setReminderSetupShowUntilPicker(false); return }
        if (reminderSetupOpen) { setReminderSetupOpen(false); return }
        if (directDeadlineOpen) { setDirectDeadlineOpen(false); return }
        if (panel === 'repeat') { setPanel('date'); return }
        if (panel !== 'main') { setPanel('main'); return }
        onClose()
      }}
    >
      {/* KeyboardAvoidingView here, not nested in the absolutely-positioned sheet, so it has
          the real screen height to react to. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]}
          onPress={handleBackdropPress}
        />

        <View style={styles.sheetAnchor} pointerEvents="box-none">
          {panel === 'main' && renderMainPanel()}
          {panel === 'date' && renderDatePanel()}
        </View>

        {panel === 'date' && deadlinePickerOpen && renderDeadlinePicker()}
        {panel === 'main' && directDeadlineOpen && renderDirectDeadlinePicker()}
        {panel === 'main' && reminderSetupOpen && renderReminderSetupPanel()}
      </KeyboardAvoidingView>
    </Modal>

    {/* Repeat panel — full screen, same component as the edit flow */}
    <RepeatPanel
      visible={panel === 'repeat'}
      rule={tempRepeat}
      config={tempRepeatConfig}
      startDate={tempDate}
      onClose={() => setPanel('date')}
      onDone={handleRepeatDone}
      colors={colors}
      insets={insets}
    />

    {/* Pickers outside Modal to avoid Android nested dialog issue */}
    {open && showNativeTime && (
      <DateTimePicker
        value={tempTime ? parse(tempTime, 'HH:mm', new Date()) : new Date()}
        mode="time"
        is24Hour
        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
        onChange={handleNativeTimeChange}
      />
    )}
    {open && reminderSetupShowTimePicker && (
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
    {open && showNativeEndTime && (
      <DateTimePicker
        value={tempEndTime ? parse(tempEndTime, 'HH:mm', new Date()) : new Date()}
        mode="time"
        is24Hour
        display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
        onChange={(event, date) => {
          if (Platform.OS !== 'ios') setShowNativeEndTime(false)
          if (event.type === 'dismissed' || !date) return
          setTempEndTime(format(date, 'HH:mm'))
        }}
      />
    )}
    </>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    sheetAnchor: {
      // flex + justifyContent instead of position:'absolute' — Android sometimes fails to
      // measure a content-driven height correctly inside an absolutely positioned parent.
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 0,
    },
    datePanelSheet: {
      maxHeight: '92%',
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    mainInput: {
      fontSize: 18,
      color: colors.text,
      minHeight: 48,
      maxHeight: 120,
      marginBottom: 4,
      padding: 0,
      outlineWidth: 0,
    },
    inlineDescInput: {
      fontSize: 15,
      color: colors.textSecondary,
      minHeight: 24,
      maxHeight: 80,
      marginBottom: 8,
      padding: 0,
      outlineWidth: 0,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    categoryChips: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    categoryChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    categoryChipText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    studyTimeRow: {
      marginBottom: 8,
    },
    studyTimeLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    studyTimeChips: {
      flexDirection: 'row',
      gap: 6,
    },
    studyTimeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    studyTimeChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    dateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      backgroundColor: colors.primary + '18',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 8,
    },
    dateBadgeText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
      flexShrink: 1,
    },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    actionIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
      marginLeft: -8,
    },
    saveBtn: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    saveBtnDisabled: {
      color: colors.textMuted,
    },

    optionsSeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    syncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    syncRowLabel: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
      marginRight: 12,
    },
    datePanelFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 24,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    footerBtn: {
      paddingVertical: 8,
    },
    footerBtnText: {
      fontSize: 15,
    },

    deadlineOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    deadlineCard: {
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
    deadlineCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    deadlineCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    deadlineRemoveRow: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    deadlineRemoveText: {
      fontSize: 14,
      color: colors.textMuted,
    },

    subtaskSection: {
      marginBottom: 8,
    },
    subtaskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    subtaskCheck: {
      width: 20,
      height: 20,
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
    subtaskInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    subtaskInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
      outlineWidth: 0,
    },
    locationInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      marginBottom: 4,
    },
    locationInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      padding: 0,
      outlineWidth: 0,
    },
    suggestionsContainer: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      marginBottom: 6,
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
  })
