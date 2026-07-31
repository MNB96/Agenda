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
  AlignLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Repeat,
  Star,
  Trash2,
  X,
} from 'lucide-react-native'
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
import { useItems } from '../../features/items/useItems'
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

const fmtShort = (dateStr: string) =>
  format(new Date(dateStr + 'T00:00:00'), "d MMM", { locale: es })

const fmtFull = (dateStr: string) =>
  format(new Date(dateStr + 'T00:00:00'), "EEE d 'de' MMM", { locale: es })

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

  // NL dismissal flags (user tapped × on auto-detected chip)
  const [nlDateDismissed, setNlDateDismissed] = useState(false)
  const [nlTimeDismissed, setNlTimeDismissed] = useState(false)

  // ── Date panel temp state (committed on "Listo") ──
  const [tempDate, setTempDate] = useState<string | undefined>()
  const [tempTime, setTempTime] = useState<string | undefined>()
  const [tempDeadline, setTempDeadline] = useState<string | undefined>()
  const [tempRepeat, setTempRepeat] = useState<RepeatRule>('none')
  const [tempReminders, setTempReminders] = useState<ReminderConfig[]>([])
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
      setNlDateDismissed(false)
      setNlTimeDismissed(false)
    }
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
    }

    if (isEditMode && editingItem) {
      await updateItem({ id: editingItem.id, patch: payload })
    } else {
      await createItem({
        ...payload,
        dateWindow: parsed?.inferred.dateWindow,
        goalConfig: parsed?.inferred.goalConfig,
      })
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

  const toggleReminder = (minutesBefore: number) => {
    const exists = tempReminders.some((r) => r.mode === 'relative' && r.minutesBefore === minutesBefore)
    if (exists) {
      setTempReminders(tempReminders.filter((r) => !(r.mode === 'relative' && r.minutesBefore === minutesBefore)))
    } else {
      setTempReminders([...tempReminders, { id: createId(), mode: 'relative', minutesBefore }])
    }
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        )}

        {/* NL parser chips */}
        {(showNlDate || showNlTime) && (
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
    </KeyboardAvoidingView>
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
              {REMINDER_PRESETS.map((preset) => {
                const active = tempReminders.some(
                  (r) => r.mode === 'relative' && r.minutesBefore === preset.minutesBefore,
                )
                return (
                  <Pressable
                    key={preset.minutesBefore}
                    style={styles.expandedItem}
                    onPress={() => toggleReminder(preset.minutesBefore)}
                  >
                    <Text style={[styles.expandedItemText, active && { color: colors.primary, fontWeight: '600' }]}>
                      {preset.label}
                    </Text>
                    {active && <Check size={16} color={colors.primary} />}
                  </Pressable>
                )
              })}
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
    </KeyboardAvoidingView>
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
      {/* Root: flex: 1, overlay color */}
      <View style={{ flex: 1 }}>
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
      </View>
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
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
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
  })
