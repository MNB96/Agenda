import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AlarmClock,
  AlignLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  MapPin,
  Navigation,
  Repeat,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native'
import { searchPlaceSuggestions, type PlaceSuggestion } from '../../services/googlePlaces'
import { fetchTravelTime, getCurrentLocation } from '../../services/travelTime'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { parseQuickInput } from '../../services/parser/quickInputParser'
import { detectCategoryFromText } from '../../services/parser/categoryDetector'
import { isExamTask } from '../../services/parser/examDetector'
import { useItems } from '../../features/items/useItems'
import { useSettings, useLicenseUsages } from '../../features/settings/useSettings'
import type { Item, ReminderConfig, RepeatRule } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { createId } from '../../utils/id'

// ─── Types ───────────────────────────────────────────────────────────────────

type Panel = 'main' | 'date' | 'repeat' | 'details'
type RepeatUnit = 'day' | 'week' | 'month' | 'year'
type RepeatEnd = 'never' | 'on_date' | 'after_occurrences'

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
  editingItemId?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REMINDER_PRESETS: { label: string; minutesBefore: number }[] = [
  { label: 'A la hora', minutesBefore: 0 },
  { label: '10 min antes', minutesBefore: 10 },
  { label: '30 min antes', minutesBefore: 30 },
  { label: '1 hora antes', minutesBefore: 60 },
  { label: '1 día antes', minutesBefore: 1440 },
]

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtShort = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return isToday(d) ? 'HOY' : format(d, 'd MMM', { locale: es })
}

const fmtFull = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  return isToday(d) ? 'HOY' : format(d, "EEE d 'de' MMM", { locale: es })
}

const buildCalendarCells = (month: Date): (Date | null)[] => {
  const first = startOfMonth(month)
  const last = endOfMonth(month)
  const days = eachDayOfInterval({ start: first, end: last })
  const offset = (getDay(first) + 6) % 7 // Monday = 0
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// ─── Small components ─────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export const QuickAddSheet = ({ open, onClose, editingItemId }: QuickAddSheetProps) => {
  const isEditMode = Boolean(editingItemId)
  const { createItem, updateItem, removeItem, items, isSaving } = useItems()
  const { data: settings } = useSettings()
  const { data: licenseUsages, saveUsage, deleteUsage } = useLicenseUsages()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const titleRef = useRef<TextInput>(null)
  const descRef = useRef<TextInput>(null)

  // ── Panel ──
  const [panel, setPanel] = useState<Panel>('main')

  // ── Main state ──
  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | undefined>()
  const [scheduledTime, setScheduledTime] = useState<string | undefined>()
  const [deadline, setDeadline] = useState<string | undefined>()
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none')
  const [reminders, setReminders] = useState<ReminderConfig[]>([])
  const [description, setDescription] = useState('')

  const [showDescInput, setShowDescInput] = useState(false)
  const [categoryId, setCategoryId] = useState<string | undefined>()

  // Location
  const [location, setLocation] = useState<string | undefined>()
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([])
  const [showLocationInput, setShowLocationInput] = useState(false)

  // NL dismissal flags (user tapped × on auto-detected chip)
  const [nlDateDismissed, setNlDateDismissed] = useState(false)
  const [nlTimeDismissed, setNlTimeDismissed] = useState(false)
  const [nlCategoryDismissed, setNlCategoryDismissed] = useState(false)
  const [studyTimeBefore, setStudyTimeBefore] = useState<'half' | 'full' | undefined>()

  // ── Date panel temp state (committed on "Listo") ──
  const [tempDate, setTempDate] = useState<string | undefined>()
  const [tempTime, setTempTime] = useState<string | undefined>()
  const [tempDeadline, setTempDeadline] = useState<string | undefined>()
  const [tempRepeat, setTempRepeat] = useState<RepeatRule>('none')
  const [tempReminders, setTempReminders] = useState<ReminderConfig[]>([])
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>('notification')
  const [customMinutesText, setCustomMinutesText] = useState('')
  const [customUnit, setCustomUnit] = useState<'min' | 'h' | 'días'>('min')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [timeEnabled, setTimeEnabled] = useState(false)
  const [showNativeTime, setShowNativeTime] = useState(false)
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false)
  const [deadlineViewMonth, setDeadlineViewMonth] = useState(new Date())
  const [expandReminder, setExpandReminder] = useState(false)

  // ── Repeat panel state ──
  const [tempRepeatInterval, setTempRepeatInterval] = useState(1)
  const [tempRepeatUnit, setTempRepeatUnit] = useState<RepeatUnit>('week')
  const [tempRepeatDays, setTempRepeatDays] = useState<number[]>([])
  const [tempRepeatEnd, setTempRepeatEnd] = useState<RepeatEnd>('never')
  const [tempRepeatEndDate, setTempRepeatEndDate] = useState<string | undefined>()
  const [tempRepeatOccurrences, setTempRepeatOccurrences] = useState(13)
  const [tempRepeatTime, setTempRepeatTime] = useState<string | undefined>()
  const [showRepeatUnitPicker, setShowRepeatUnitPicker] = useState(false)
  const [showRepeatTimePicker, setShowRepeatTimePicker] = useState(false)
  const [showRepeatEndDatePicker, setShowRepeatEndDatePicker] = useState(false)

  // ── NL parsing (create mode only) ──
  const parsed = useMemo(() => {
    if (isEditMode || !text.trim()) return null
    return parseQuickInput(text)
  }, [text, isEditMode])

  // Effective values: explicit takes priority over NL-inferred
  const effectiveDate = scheduledDate ?? (nlDateDismissed ? undefined : parsed?.inferred.startDate)
  const effectiveTime = scheduledTime ?? (nlTimeDismissed ? undefined : parsed?.inferred.startTime)
  const effectiveDeadline = deadline ?? parsed?.inferred.deadline

  // NL chips to show
  const showNlDate = !isEditMode && !scheduledDate && !nlDateDismissed && Boolean(parsed?.inferred.startDate)
  const showNlTime = !isEditMode && !scheduledTime && !nlTimeDismissed && Boolean(parsed?.inferred.startTime)

  // Category auto-detection
  const suggestedCategoryId = useMemo(() => {
    if (categoryId || nlCategoryDismissed || isEditMode) return undefined
    return detectCategoryFromText(text, settings?.categories ?? [])
  }, [text, categoryId, nlCategoryDismissed, isEditMode, settings?.categories])
  const effectiveCategoryId = categoryId ?? suggestedCategoryId
  const showNlCategory = Boolean(suggestedCategoryId) && !categoryId && !nlCategoryDismissed

  // Editing item reference
  const editingItem: Item | undefined = useMemo(
    () => (editingItemId ? items.find((i) => i.id === editingItemId) : undefined),
    [editingItemId, items],
  )

  // Calendar grids
  const calendarCells = useMemo(() => buildCalendarCells(viewMonth), [viewMonth])
  const deadlineCalendarCells = useMemo(() => buildCalendarCells(deadlineViewMonth), [deadlineViewMonth])

  // ── Load / reset on open ──
  useEffect(() => {
    if (!open) return
    setPanel('main')
    setShowRepeatUnitPicker(false)
    setExpandReminder(false)

    if (isEditMode && editingItem) {
      setText(editingItem.title)
      setImportant(editingItem.important ?? false)
      setScheduledDate(editingItem.startDate)
      setScheduledTime(editingItem.startTime)
      setDeadline(editingItem.deadline)
      setRepeatRule(editingItem.repeatRule ?? 'none')
      setReminders(editingItem.reminderConfig ?? [])
      setDescription(editingItem.description ?? '')
      setShowDescInput(Boolean(editingItem.description?.trim()))
      setCategoryId(editingItem.categoryId)
      setLocation(editingItem.location)
      setLocationQuery(editingItem.location ?? '')
      setShowLocationInput(Boolean(editingItem.location))
    } else {
      setText('')
      setImportant(false)
      setScheduledDate(undefined)
      setScheduledTime(undefined)
      setDeadline(undefined)
      setRepeatRule('none')
      setReminders([])
      setDescription('')
      setShowDescInput(false)
      setCategoryId(undefined)
      setNlDateDismissed(false)
      setNlTimeDismissed(false)
      setNlCategoryDismissed(false)
      setStudyTimeBefore(undefined)
      setLocation(undefined)
      setLocationQuery('')
      setLocationSuggestions([])
      setShowLocationInput(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Location autocomplete debounce ──
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

  // ── Android back handler ──
  useEffect(() => {
    if (!open) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return true }
      if (panel === 'repeat') { setPanel('date'); return true }
      if (panel !== 'main') { setPanel('main'); return true }
      onClose()
      return true
    })
    return () => handler.remove()
  }, [open, panel, onClose, deadlinePickerOpen])

  // ── Handlers ──

  const openDatePanel = useCallback(() => {
    Keyboard.dismiss()
    setTempDate(effectiveDate)
    setTempTime(effectiveTime)
    setTempDeadline(effectiveDeadline)
    setTempRepeat(repeatRule)
    setTempReminders(reminders)
    setTimeEnabled(Boolean(effectiveTime))
    setShowRepeatUnitPicker(false)
    setExpandReminder(false)
    setDeadlinePickerOpen(false)
    setViewMonth(effectiveDate ? new Date(effectiveDate + 'T00:00:00') : new Date())
    setPanel('date')
  }, [effectiveDate, effectiveTime, effectiveDeadline, repeatRule, reminders])

  const openDetailsPanel = useCallback(() => {
    Keyboard.dismiss()
    setPanel('details')
    setTimeout(() => descRef.current?.focus(), 150)
  }, [])

  const openRepeatPanel = useCallback(() => {
    setTempRepeatUnit(RULE_TO_UNIT[tempRepeat] ?? 'week')
    setTempRepeatInterval(1)
    setShowRepeatUnitPicker(false)
    setPanel('repeat')
  }, [tempRepeat])

  const commitRepeat = useCallback(() => {
    setTempRepeat(UNIT_TO_RULE[tempRepeatUnit])
    setPanel('date')
  }, [tempRepeatUnit])

  const toggleRepeatDay = (idx: number) => {
    setTempRepeatDays(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx],
    )
  }

  const commitDate = useCallback(() => {
    setScheduledDate(tempDate)
    setScheduledTime(timeEnabled ? tempTime : undefined)
    setDeadline(tempDeadline)
    setRepeatRule(tempRepeat)
    setReminders(tempReminders)
    if (tempDate) setNlDateDismissed(true)
    if (timeEnabled && tempTime) setNlTimeDismissed(true)
    setPanel('main')
    setTimeout(() => titleRef.current?.focus(), 150)
  }, [tempDate, timeEnabled, tempTime, tempDeadline, tempRepeat, tempReminders])

  const handleSave = async () => {
    const title = text.trim()
    if (!title) return

    const payload = {
      title,
      important,
      startDate: effectiveDate,
      startTime: effectiveTime,
      deadline: effectiveDeadline,
      repeatRule: repeatRule !== 'none' ? repeatRule : undefined,
      reminderConfig: reminders.length > 0 ? reminders : undefined,
      description: description.trim() || undefined,
      categoryId: effectiveCategoryId,
      location: location || undefined,
      academicConfig: studyTimeBefore ? { studyTimeBefore } : undefined,
    }

    if (isEditMode && editingItem) {
      await updateItem({ id: editingItem.id, patch: payload })
      // Sync license usage for edit mode
      const existingUsage = (licenseUsages ?? []).find(u => u.itemId === editingItem.id)
      const days = studyTimeBefore === 'half' ? 0.5 : studyTimeBefore === 'full' ? 1 : undefined
      if (days !== undefined) {
        await saveUsage({
          id: existingUsage?.id ?? createId(),
          itemId: editingItem.id,
          date: effectiveDate ?? effectiveDeadline ?? new Date().toISOString().slice(0, 10),
          days,
          note: title,
        })
      } else if (existingUsage) {
        await deleteUsage(existingUsage.id)
      }
    } else {
      const created = await createItem({
        ...payload,
        dateWindow: parsed?.inferred.dateWindow,
        goalConfig: parsed?.inferred.goalConfig,
      })
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
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!editingItem) return
    await removeItem(editingItem)
    onClose()
  }

  const handleDayPress = (day: Date) => {
    const str = format(day, 'yyyy-MM-dd')
    setTempDate(str === tempDate ? undefined : str)
  }

  const handleNativeTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowNativeTime(false)
    if (event.type === 'dismissed' || !date) return
    setTempTime(format(date, 'HH:mm'))
  }

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
      const totalMins = result.minutes + 5
      if (!tempReminders.some((r) => r.mode === 'departure')) {
        setTempReminders((prev) => [
          ...prev,
          { id: createId(), mode: 'departure', minutesBefore: totalMins, alarmType: selectedAlarmType },
        ])
      }
    } finally {
      setTravelTimeLoading(false)
    }
  }

  const togglePresetReminder = (minutesBefore: number) => {
    const exists = tempReminders.some((r) => r.minutesBefore === minutesBefore)
    if (exists) {
      setTempReminders(tempReminders.filter((r) => r.minutesBefore !== minutesBefore))
    } else {
      setTempReminders([...tempReminders, { id: createId(), mode: 'relative', minutesBefore, alarmType: selectedAlarmType }])
    }
  }

  const addCustomReminder = () => {
    const val = parseInt(customMinutesText, 10)
    if (isNaN(val) || val < 0) return
    const mins = customUnit === 'h' ? val * 60 : customUnit === 'días' ? val * 1440 : val
    const exists = tempReminders.some((r) => r.minutesBefore === mins)
    if (!exists) {
      setTempReminders([...tempReminders, { id: createId(), mode: 'relative', minutesBefore: mins, alarmType: selectedAlarmType }])
    }
    setCustomMinutesText('')
    setShowCustomInput(false)
  }

  const formatReminderLabel = (r: ReminderConfig): string => {
    const mins = r.minutesBefore
    if (mins === undefined) return 'Recordatorio'
    if (mins === 0) return 'A la hora'
    if (mins < 60) return `${mins} min antes`
    if (mins < 1440) {
      const h = mins / 60
      return Number.isInteger(h) ? (h === 1 ? '1 hora antes' : `${h} horas antes`) : `${mins} min antes`
    }
    const d = mins / 1440
    return Number.isInteger(d) ? (d === 1 ? '1 día antes' : `${d} días antes`) : `${Math.floor(mins / 60)}h antes`
  }

  const handleBackdropPress = () => {
    if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
    if (panel === 'repeat') { setPanel('date'); return }
    if (panel === 'date' || panel === 'details') {
      setPanel('main')
      setTimeout(() => titleRef.current?.focus(), 150)
      return
    }
    onClose()
  }

  // ── Computed display values ──

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
    const unit = UNIT_OPTIONS.find(o => o.value === (RULE_TO_UNIT[tempRepeat] ?? 'week'))?.label ?? 'semana'
    return tempRepeatInterval > 1 ? `Cada ${tempRepeatInterval} ${unit}s` : `Cada ${unit}`
  }, [tempRepeat, tempRepeatInterval])
  const reminderCount = tempReminders.length

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

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
          autoFocus={!isEditMode}
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
            {(settings?.categories ?? []).length > 0 && (
              <View style={styles.categoryRow}>
                <Tag size={15} color={categoryId ? colors.primary : colors.textMuted} />
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
          </>
        )}

        {/* Location input */}
        {showLocationInput && (
          <View>
            <View style={styles.locationInputRow}>
              <MapPin size={15} color={location ? colors.primary : colors.textMuted} />
              <TextInput
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
                onSubmitEditing={() => setLocationSuggestions([])}
              />
              {locationQuery ? (
                <Pressable
                  onPress={() => {
                    setLocationQuery('')
                    setLocation(undefined)
                    setLocationSuggestions([])
                  }}
                  hitSlop={8}
                >
                  <X size={14} color={colors.textMuted} />
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
        )}

        {/* NL parser chips */}
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
                label={`🏷 ${settings?.categories.find((c) => c.id === suggestedCategoryId)?.name ?? suggestedCategoryId}`}
                onDismiss={() => setNlCategoryDismissed(true)}
                colors={colors}
              />
            )}
          </View>
        )}

        {/* Study time selector (facultad + exam keywords) */}
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

        {/* Date badge when explicitly set */}
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
              }}
            >
              <X size={11} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        )}

        {/* Action bar */}
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
              icon={MapPin}
              label="Dirección"
              active={showLocationInput || Boolean(location)}
              onPress={() => {
                if (showLocationInput) {
                  setShowLocationInput(false)
                  setLocationQuery('')
                  setLocation(undefined)
                  setLocationSuggestions([])
                  Keyboard.dismiss()
                } else {
                  setShowLocationInput(true)
                  setTimeout(() => Keyboard.dismiss(), 50)
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
            {isEditMode && (
              <ActionIcon
                icon={Trash2}
                label="Eliminar"
                active={false}
                activeColor={colors.danger}
                onPress={() => void handleDelete()}
                colors={colors}
              />
            )}
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

  const renderCalendarGrid = (
    cells: (Date | null)[],
    selected: string | undefined,
    onSelect: (day: Date) => void,
    accentColor: string,
  ) => (
    <>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((d, i) => (
          <Text key={i} style={styles.weekdayLabel}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((day, idx) => {
          if (!day) return <View key={idx} style={styles.calCell} />
          const dayStr = format(day, 'yyyy-MM-dd')
          const isSel = dayStr === selected
          const today = isToday(day)
          return (
            <Pressable
              key={idx}
              style={[
                styles.calCell,
                isSel && { backgroundColor: accentColor, borderRadius: 999 },
                today && !isSel && { borderWidth: 1, borderColor: accentColor, borderRadius: 999 },
              ]}
              onPress={() => onSelect(day)}
              hitSlop={2}
            >
              <Text
                style={[
                  styles.calDayText,
                  isSel && styles.calDayTextSelected,
                  today && !isSel && { color: accentColor, fontWeight: '700' },
                ]}
              >
                {format(day, 'd')}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </>
  )

  const renderDeadlinePicker = () => (
    <>
      {/* Extra dim overlay behind the card */}
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        onPress={() => setDeadlinePickerOpen(false)}
      />
      {/* Centered card */}
      <View style={styles.deadlineOverlay} pointerEvents="box-none">
        <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.deadlineCardHeader}>
            <Text style={styles.deadlineCardTitle}>Fecha límite</Text>
            <Pressable onPress={() => setDeadlinePickerOpen(false)} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <Pressable onPress={() => setDeadlineViewMonth((m) => subMonths(m, 1))} hitSlop={12}>
              <ChevronLeft size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {format(deadlineViewMonth, 'MMMM yyyy', { locale: es })}
            </Text>
            <Pressable onPress={() => setDeadlineViewMonth((m) => addMonths(m, 1))} hitSlop={12}>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {renderCalendarGrid(
            deadlineCalendarCells,
            tempDeadline,
            (day) => {
              setTempDeadline(format(day, 'yyyy-MM-dd'))
              setDeadlinePickerOpen(false)
            },
            colors.accent,
          )}

          {/* Quitar fecha */}
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

  const renderDatePanel = () => (
      <View
        style={[styles.sheet, styles.datePanelSheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.dragHandle} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <Pressable onPress={() => setViewMonth((m) => subMonths(m, 1))} hitSlop={12}>
              <ChevronLeft size={20} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </Text>
            <Pressable onPress={() => setViewMonth((m) => addMonths(m, 1))} hitSlop={12}>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {renderCalendarGrid(
            calendarCells,
            tempDate,
            handleDayPress,
            colors.primary,
          )}

          <View style={styles.optionsSeparator} />

          {/* Establecer hora */}
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

          {/* Repetir → abre panel completo */}
          <OptionRow
            label="Repetir"
            value={repeatLabel}
            onPress={openRepeatPanel}
            onClear={tempRepeat !== 'none' ? () => setTempRepeat('none') : undefined}
            icon={Repeat}
            colors={colors}
          />

          <RowDivider colors={colors} />

          {/* Fecha límite → abre sub-calendario */}
          <OptionRow
            label="Fecha límite"
            value={tempDeadline ? fmtShort(tempDeadline) : undefined}
            onPress={() => {
              setDeadlineViewMonth(tempDeadline ? new Date(tempDeadline + 'T00:00:00') : new Date())
              setDeadlinePickerOpen(true)
            }}
            onClear={tempDeadline ? () => setTempDeadline(undefined) : undefined}
            icon={Flag}
            colors={colors}
          />

          <RowDivider colors={colors} />

          {/* Recordatorio */}
          <OptionRow
            label="Recordatorio"
            value={reminderCount > 0 ? `${reminderCount} activo${reminderCount !== 1 ? 's' : ''}` : undefined}
            onPress={() => setExpandReminder((v) => !v)}
            onClear={reminderCount > 0 ? () => setTempReminders([]) : undefined}
            icon={Bell}
            colors={colors}
          />
          {expandReminder && (
            <View style={styles.expandedList}>
              {/* Recordatorios ya agregados */}
              {tempReminders.map((r) => (
                <View key={r.id} style={styles.reminderAddedRow}>
                  <Text style={styles.reminderAddedText}>{formatReminderLabel(r)}</Text>
                  <View style={[styles.reminderTypePill, r.alarmType === 'alarm' && styles.reminderTypePillAlarm]}>
                    {r.alarmType === 'alarm'
                      ? <AlarmClock size={11} color={colors.accent} />
                      : <Bell size={11} color={colors.primary} />}
                    <Text style={[styles.reminderTypePillText, r.alarmType === 'alarm' && { color: colors.accent }]}>
                      {r.alarmType === 'alarm' ? 'Alarma' : 'Notif.'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setTempReminders(tempReminders.filter((x) => x.id !== r.id))} hitSlop={8}>
                    <X size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}

              {/* Selector de tipo */}
              <View style={styles.reminderTypeRow}>
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
              </View>

              {/* Presets */}
              {REMINDER_PRESETS.map((preset) => {
                const active = tempReminders.some((r) => r.minutesBefore === preset.minutesBefore)
                return (
                  <Pressable
                    key={preset.minutesBefore}
                    style={styles.expandedItem}
                    onPress={() => togglePresetReminder(preset.minutesBefore)}
                  >
                    <Text style={[styles.expandedItemText, active && { color: colors.primary, fontWeight: '600' }]}>
                      {preset.label}
                    </Text>
                    {active && <Check size={16} color={colors.primary} />}
                  </Pressable>
                )
              })}

              {/* Travel time — solo si hay dirección y fecha */}
              {location && tempDate && (
                <Pressable
                  style={styles.expandedItem}
                  onPress={() => void handleCalculateTravelTime()}
                  disabled={travelTimeLoading}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Navigation size={13} color={colors.primary} />
                    <Text style={[styles.expandedItemText, { color: colors.primary }]}>
                      {travelTimeLoading ? 'Calculando...' : 'Recordarme cuándo salir'}
                    </Text>
                  </View>
                  {travelTimeResult && (
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{travelTimeResult}</Text>
                  )}
                </Pressable>
              )}

              {/* Personalizado */}
              <Pressable style={styles.expandedItem} onPress={() => setShowCustomInput((v) => !v)}>
                <Text style={styles.expandedItemText}>Personalizado...</Text>
                <ChevronDown
                  size={14}
                  color={colors.textMuted}
                  style={{ transform: [{ rotate: showCustomInput ? '180deg' : '0deg' }] }}
                />
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
                    onSubmitEditing={addCustomReminder}
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
                  <Pressable style={styles.customReminderAdd} onPress={addCustomReminder}>
                    <Text style={styles.customReminderAddText}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* Footer */}
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

  const renderDetailsPanel = () => (
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.dragHandle} />

        <TextInput
          ref={descRef}
          value={description}
          onChangeText={setDescription}
          placeholder="Agrega una nota o descripción"
          placeholderTextColor={colors.textMuted}
          style={styles.detailsInput}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.actionBar}>
          <View />
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                setPanel('main')
                setTimeout(() => titleRef.current?.focus(), 150)
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '500' }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPanel('main')
                setTimeout(() => titleRef.current?.focus(), 150)
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700' }}>Listo</Text>
            </Pressable>
          </View>
        </View>
      </View>
  )

  const renderRepeatPanel = () => (
    <View
      style={[styles.sheet, styles.datePanelSheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}
      onStartShouldSetResponder={() => true}
    >
      {/* Header */}
      <View style={styles.repeatHeader}>
        <Pressable onPress={() => setPanel('date')} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.repeatTitle}>Se repite.</Text>
        <Pressable onPress={commitRepeat} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text style={[styles.footerBtnText, { color: colors.primary, fontWeight: '700' }]}>Listo</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Todos los [N] [unidad] */}
        <Text style={styles.repeatSectionLabel}>Todos los</Text>
        <View style={styles.repeatIntervalRow}>
          <TextInput
            value={String(tempRepeatInterval)}
            onChangeText={(v) => { const n = parseInt(v); if (!isNaN(n) && n > 0) setTempRepeatInterval(n) }}
            keyboardType="number-pad"
            style={styles.repeatIntervalInput}
            maxLength={3}
            selectTextOnFocus
          />
          <Pressable style={styles.repeatUnitBtn} onPress={() => setShowRepeatUnitPicker(v => !v)}>
            <Text style={styles.repeatUnitText}>
              {UNIT_OPTIONS.find(o => o.value === tempRepeatUnit)?.label ?? 'semana'}
            </Text>
            <ChevronDown size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {showRepeatUnitPicker && (
          <View style={[styles.expandedList, { marginBottom: 12 }]}>
            {UNIT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={styles.expandedItem}
                onPress={() => { setTempRepeatUnit(opt.value); setShowRepeatUnitPicker(false) }}
              >
                <Text style={[styles.expandedItemText, tempRepeatUnit === opt.value && { color: colors.primary, fontWeight: '600' }]}>
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

        <View style={styles.optionsSeparator} />

        {/* Comienza */}
        <Text style={[styles.repeatSectionLabel, { marginTop: 14 }]}>Comienza</Text>
        <View style={styles.repeatFieldBox}>
          <Text style={{ fontSize: 15, color: colors.text }}>
            {tempDate
              ? format(new Date(tempDate + 'T00:00:00'), "d 'de' MMMM", { locale: es })
              : format(new Date(), "d 'de' MMMM", { locale: es })}
          </Text>
        </View>

        <View style={styles.optionsSeparator} />

        {/* Finaliza */}
        <Text style={[styles.repeatSectionLabel, { marginTop: 14 }]}>Finaliza</Text>

        {/* Nunca */}
        <Pressable style={styles.repeatRadioRow} onPress={() => setTempRepeatEnd('never')}>
          <View style={[styles.radioOuter, tempRepeatEnd === 'never' && { borderColor: colors.primary }]}>
            {tempRepeatEnd === 'never' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
          </View>
          <Text style={styles.repeatRadioLabel}>Nunca</Text>
        </Pressable>

        {/* El [fecha] */}
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

        {/* Después de [n] repeticiones */}
        <View style={[styles.repeatRadioRow, { alignItems: 'center' }]}>
          <Pressable onPress={() => setTempRepeatEnd('after_occurrences')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.radioOuter, tempRepeatEnd === 'after_occurrences' && { borderColor: colors.primary }]}>
              {tempRepeatEnd === 'after_occurrences' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
            </View>
            <Text style={styles.repeatRadioLabel}>Después de</Text>
          </Pressable>
          <TextInput
            value={String(tempRepeatOccurrences)}
            onChangeText={(v) => { const n = parseInt(v); if (!isNaN(n) && n > 0) setTempRepeatOccurrences(n) }}
            keyboardType="number-pad"
            style={[styles.repeatIntervalInput, { marginHorizontal: 8 }]}
            maxLength={3}
            selectTextOnFocus
            onFocus={() => setTempRepeatEnd('after_occurrences')}
          />
          <Text style={styles.repeatRadioLabel}>repeticiones</Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
    <Modal
      visible={open}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => {
        if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
        if (panel === 'repeat') { setPanel('date'); return }
        if (panel !== 'main') { setPanel('main'); return }
        onClose()
      }}
    >
      {/* Root: flex: 1, overlay color. KeyboardAvoidingView here (not nested inside the
          absolutely-positioned sheet) so it has the real screen height to react to. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Backdrop — tap closes the sheet (only from main panel) */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]}
          onPress={handleBackdropPress}
        />

        {/* Sheet container — bottom-anchored */}
        <View style={styles.sheetAnchor} pointerEvents="box-none">
          {panel === 'main' && renderMainPanel()}
          {panel === 'date' && renderDatePanel()}
          {panel === 'repeat' && renderRepeatPanel()}
          {panel === 'details' && renderDetailsPanel()}
        </View>

        {/* Deadline picker — centered dialog over everything */}
        {panel === 'date' && deadlinePickerOpen && renderDeadlinePicker()}
      </KeyboardAvoidingView>
    </Modal>

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
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    sheetAnchor: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
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
    descPreview: {
      marginBottom: 6,
      paddingVertical: 4,
    },
    descPreviewText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 19,
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

    // Date panel
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    monthLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekdayLabel: {
      width: '14.2857%',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      paddingVertical: 4,
    },
    calGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    calCell: {
      width: '14.2857%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calDayText: {
      fontSize: 14,
      color: colors.text,
    },
    calDayTextSelected: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    optionsSeparator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    expandedList: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      marginBottom: 4,
      overflow: 'hidden',
    },
    expandedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    expandedItemText: {
      fontSize: 14,
      color: colors.text,
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

    // Repeat panel
    repeatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      marginBottom: 16,
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

    // Deadline picker — centered dialog
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

    // Details panel
    detailsInput: {
      fontSize: 16,
      color: colors.text,
      minHeight: 80,
      maxHeight: 160,
      padding: 0,
      marginBottom: 8,
      outlineWidth: 0,
    },

    // Location
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

    // Reminder UI
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
      marginRight: 2,
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
    },
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
    customReminderUnit: {
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
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
  })
