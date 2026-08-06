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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AlignLeft,
  Bell,
  Clock,
  Flag,
  MapPin,
  Repeat,
  Star,
  Tag,
  X,
} from 'lucide-react-native'
import { fetchTravelTime, getCurrentLocation } from '../../services/travelTime'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { MonthCalendar } from '../components/MonthCalendar'
import { RepeatPanel, UNIT_OPTIONS, RULE_TO_UNIT } from '../components/RepeatPanel'
import { ReminderPanel } from '../components/ReminderPanel'
import { parseQuickInput } from '../../services/parser/quickInputParser'
import { detectCategoryFromText } from '../../services/parser/categoryDetector'
import { isExamTask } from '../../services/parser/examDetector'
import { useItems } from '../../features/items/useItems'
import { useLocationAutocomplete } from '../../features/items/useLocationAutocomplete'
import { useSettings, useLicenseUsages } from '../../features/settings/useSettings'
import { useGoogleAuthStore } from '../../state/googleAuthStore'
import { computeNextDate } from '../../services/items/recurrence'
import type { ReminderConfig, RepeatConfig, RepeatRule, TravelConfig } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'
import { createId } from '../../utils/id'

// ─── Types ───────────────────────────────────────────────────────────────────

type Panel = 'main' | 'date' | 'repeat'

interface QuickAddSheetProps {
  open: boolean
  onClose: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtShort = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return isToday(date) ? 'HOY' : format(date, 'd MMM', { locale: es })
}

const fmtFull = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return isToday(date) ? 'HOY' : format(date, "EEE d 'de' MMM", { locale: es })
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

export const QuickAddSheet = ({ open, onClose }: QuickAddSheetProps) => {
  const { createItem, isSaving } = useItems()
  const { data: settings } = useSettings()
  const { saveUsage } = useLicenseUsages()
  const { accessToken } = useGoogleAuthStore()
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
  const [endTime, setEndTime] = useState<string | undefined>()
  const [deadline, setDeadline] = useState<string | undefined>()
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(true)
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none')
  const [repeatConfig, setRepeatConfig] = useState<RepeatConfig | undefined>()
  const [reminders, setReminders] = useState<ReminderConfig[]>([])
  const [description, setDescription] = useState('')

  const [showDescInput, setShowDescInput] = useState(false)
  const [categoryId, setCategoryId] = useState<string | undefined>()

  // Location
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
  const [studyTimeBefore, setStudyTimeBefore] = useState<'half' | 'full' | undefined>()

  // ── Date panel temp state (committed on "Listo") ──
  const [tempDate, setTempDate] = useState<string | undefined>()
  const [tempTime, setTempTime] = useState<string | undefined>()
  const [tempEndTime, setTempEndTime] = useState<string | undefined>()
  const [showNativeEndTime, setShowNativeEndTime] = useState(false)
  const [tempDeadline, setTempDeadline] = useState<string | undefined>()
  const [tempRepeat, setTempRepeat] = useState<RepeatRule>('none')
  const [tempReminders, setTempReminders] = useState<ReminderConfig[]>([])
  const [selectedAlarmType, setSelectedAlarmType] = useState<'notification' | 'alarm'>('notification')
  const [selectedPersistent, setSelectedPersistent] = useState(false)
  const [travelTimeLoading, setTravelTimeLoading] = useState(false)
  const [travelTimeResult, setTravelTimeResult] = useState<string | null>(null)
  const [travelConfig, setTravelConfig] = useState<TravelConfig | undefined>()
  // Bumped whenever the date panel should jump its visible month back to tempDate/tempDeadline
  // (opening the sheet, opening the deadline picker, auto-filling a date from a repeat rule) —
  // forces MonthCalendar to remount and re-read its initial month from selectedDate.
  const [dateCalendarKey, setDateCalendarKey] = useState(0)
  const [deadlineCalendarKey, setDeadlineCalendarKey] = useState(0)
  const [timeEnabled, setTimeEnabled] = useState(false)
  const [showNativeTime, setShowNativeTime] = useState(false)
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false)
  const [expandReminder, setExpandReminder] = useState(false)

  // Draft repeat config while the RepeatPanel is open — assembled fully by the panel
  // itself, promoted to repeatRule/repeatConfig only when the outer date panel commits.
  const [tempRepeatConfig, setTempRepeatConfig] = useState<RepeatConfig | undefined>()

  // ── NL parsing ──
  const parsed = useMemo(() => {
    if (!text.trim()) return null
    return parseQuickInput(text)
  }, [text])

  // Effective values: explicit takes priority over NL-inferred
  const effectiveDate = scheduledDate ?? (nlDateDismissed ? undefined : parsed?.inferred.startDate)
  const effectiveTime = scheduledTime ?? (nlTimeDismissed ? undefined : parsed?.inferred.startTime)
  const effectiveDeadline = deadline ?? parsed?.inferred.deadline

  // NL chips to show
  const showNlDate = !scheduledDate && !nlDateDismissed && Boolean(parsed?.inferred.startDate)
  const showNlTime = !scheduledTime && !nlTimeDismissed && Boolean(parsed?.inferred.startTime)

  // Category auto-detection
  const suggestedCategoryId = useMemo(() => {
    if (categoryId || nlCategoryDismissed) return undefined
    return detectCategoryFromText(text, settings?.categories ?? [])
  }, [text, categoryId, nlCategoryDismissed, settings?.categories])
  const effectiveCategoryId = categoryId ?? suggestedCategoryId
  const showNlCategory = Boolean(suggestedCategoryId) && !categoryId && !nlCategoryDismissed

  // ── Load / reset on open ──
  useEffect(() => {
    if (!open) return
    setPanel('main')
    setExpandReminder(false)

    setText('')
    setImportant(false)
    setScheduledDate(undefined)
    setScheduledTime(undefined)
    setEndTime(undefined)
    setDeadline(undefined)
    setSyncToGoogleCalendar(true)
    setRepeatRule('none')
    setRepeatConfig(undefined)
    setReminders([])
    setTravelConfig(undefined)
    setDescription('')
    setShowDescInput(false)
    setCategoryId(undefined)
    setNlDateDismissed(false)
    setNlTimeDismissed(false)
    setNlCategoryDismissed(false)
    setStudyTimeBefore(undefined)
    setLocation(undefined)
    resetLocationAutocomplete('')
    setShowLocationInput(false)
    // Deliberately keyed on [open] only: this blanks the draft each time the sheet opens, but
    // must NOT re-fire while the sheet stays open — that would wipe out text the user is
    // actively typing.
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setTempRepeatConfig(repeatConfig)
    setTempReminders(reminders)
    setTempEndTime(endTime)
    setTimeEnabled(Boolean(effectiveTime))
    setExpandReminder(false)
    setDeadlinePickerOpen(false)
    setDateCalendarKey((k) => k + 1)
    setPanel('date')
  }, [effectiveDate, effectiveTime, effectiveDeadline, repeatRule, repeatConfig, reminders, endTime])

  const openRepeatPanel = useCallback(() => {
    setPanel('repeat')
  }, [])

  const handleRepeatDone = useCallback((rule: RepeatRule, config: RepeatConfig) => {
    setTempRepeat(rule)
    setTempRepeatConfig(config)
    // Si todavía no eligieron un día en el calendario, la fecha se infiere de la
    // repetición misma (ej. "todos los días" -> mañana; "cada semana" siendo hoy
    // lunes -> el próximo lunes), en vez de dejar la tarea sin fecha.
    if (!tempDate) {
      const nextDate = computeNextDate(new Date(), {
        unit: config.unit,
        interval: config.interval,
        daysOfWeek: config.unit === 'week' ? config.daysOfWeek : undefined,
        end: 'never',
      })
      setTempDate(format(nextDate, 'yyyy-MM-dd'))
      setDateCalendarKey((k) => k + 1)
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
      startDate: effectiveDate,
      startTime: effectiveTime,
      endDate: effectiveTime && endTime ? effectiveDate : undefined,
      endTime: effectiveTime ? endTime : undefined,
      deadline: effectiveDeadline,
      syncToGoogleCalendar,
      repeatRule: repeatRule !== 'none' ? repeatRule : undefined,
      repeatConfig: repeatRule !== 'none' ? repeatConfig : undefined,
      reminderConfig: reminders.length > 0 ? reminders : undefined,
      travelConfig,
      description: description.trim() || undefined,
      categoryId: effectiveCategoryId,
      location: location || undefined,
      academicConfig: studyTimeBefore ? { studyTimeBefore } : undefined,
    }

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
    onClose()
  }

  const handleDayPress = (dayStr: string) => {
    setTempDate(dayStr === tempDate ? undefined : dayStr)
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
      // Recalcula con el tráfico actual y reemplaza el recordatorio de salida anterior.
      const totalMins = result.minutes + 5
      setTempReminders((prev) => [
        ...prev.filter((reminder) => reminder.mode !== 'departure'),
        { id: createId(), mode: 'departure', minutesBefore: totalMins, alarmType: selectedAlarmType, persistent: selectedPersistent },
      ])
      setTravelConfig({ transport: 'driving', extraMinutes: 5, departureReminderEnabled: true })
    } finally {
      setTravelTimeLoading(false)
    }
  }

  const handleBackdropPress = () => {
    if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
    if (panel === 'repeat') { setPanel('date'); return }
    if (panel === 'date') {
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
    const interval = tempRepeatConfig?.interval ?? 1
    const unit = UNIT_OPTIONS.find(option => option.value === (RULE_TO_UNIT[tempRepeat] ?? 'week'))?.label ?? 'semana'
    return interval > 1 ? `Cada ${interval} ${unit}s` : `Cada ${unit}`
  }, [tempRepeat, tempRepeatConfig])
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
                label={`🏷 ${settings?.categories.find((category) => category.id === suggestedCategoryId)?.name ?? suggestedCategoryId}`}
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
                  clearLocationSuggestions()
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
          <MonthCalendar
            key={dateCalendarKey}
            selectedDate={tempDate}
            onSelectDate={handleDayPress}
            colors={colors}
            accentColor={colors.primary}
          />

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

          {/* Hasta (hora de fin) — solo si hay hora de inicio */}
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

          {/* Repetir → abre panel completo */}
          <OptionRow
            label="Repetir"
            value={repeatLabel}
            onPress={openRepeatPanel}
            onClear={tempRepeat !== 'none' ? () => { setTempRepeat('none'); setTempRepeatConfig(undefined) } : undefined}
            icon={Repeat}
            colors={colors}
          />

          <RowDivider colors={colors} />

          {/* Fecha límite → abre sub-calendario */}
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
              colors={colors}
            />
          )}

          {accessToken && (
            <>
              <RowDivider colors={colors} />
              <View style={styles.syncRow}>
                <Text style={styles.syncRowLabel}>Sincronizar con Google Calendar</Text>
                <Switch value={syncToGoogleCalendar} onValueChange={setSyncToGoogleCalendar} />
              </View>
            </>
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
        </View>

        {/* Deadline picker — centered dialog over everything */}
        {panel === 'date' && deadlinePickerOpen && renderDeadlinePicker()}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    sheetAnchor: {
      // flex + justifyContent instead of position:'absolute' — the sheet's height is
      // content-driven (ScrollView with no explicit height), and Android's layout engine
      // sometimes fails to measure that correctly on first mount inside an absolutely
      // positioned parent, clipping content until a later re-render forces a re-layout.
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
  })
