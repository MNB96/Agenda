import { useMemo, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { differenceInCalendarWeeks, format, parse, parseISO } from 'date-fns'
import { Bell, Check, ChevronLeft, Shuffle, Trash2, X } from 'lucide-react-native'
import { useHabits } from '../../application/habits/useHabits'
import {
  HABIT_REGULARITY,
  HABIT_REMINDER_MODE,
  computeStreaks,
  generateRandomTimes,
  weekCompletionStatus,
  type HabitReminderConfig,
  type HabitReminderMode,
  type HabitRegularity,
} from '../../domain/habits'
import { DEFAULT_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

interface AddHabitSheetProps {
  open: boolean
  /** Present when editing an existing habit instead of creating a new one. */
  habitId?: string
  onClose: () => void
}

const REGULARITY_OPTIONS: { value: HabitRegularity; label: string }[] = [
  { value: HABIT_REGULARITY.DAILY, label: 'Diaria' },
  { value: HABIT_REGULARITY.WEEKLY, label: 'Semanal' },
  { value: HABIT_REGULARITY.MONTHLY, label: 'Mensual' },
  { value: HABIT_REGULARITY.YEARLY, label: 'Anual' },
]

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const REMINDER_MODE_OPTIONS: { value: HabitReminderMode; label: string }[] = [
  { value: HABIT_REMINDER_MODE.INTERVAL, label: 'Intervalo fijo' },
  { value: HABIT_REMINDER_MODE.RANDOM, label: 'Horario random' },
]

const daysLabel = (count: number): string => `${count} ${count === 1 ? 'día' : 'días'}`

// "5.0/7" style weekly average — only a meaningful denominator for daily habits, so others just show the raw average.
const weeklyAverageLabel = (totalCompletions: number, createdAt: string, regularity: HabitRegularity): string => {
  const weeksSinceCreated = Math.max(1, differenceInCalendarWeeks(new Date(), parseISO(createdAt), { weekStartsOn: 1 }) + 1)
  const average = totalCompletions / weeksSinceCreated
  return regularity === HABIT_REGULARITY.DAILY ? `${average.toFixed(1)}/7 días` : `${average.toFixed(1)} por semana`
}

export const AddHabitSheet = ({ open, habitId, onClose }: AddHabitSheetProps) => {
  const { habits, completionsByHabitId, createHabit, updateHabit, removeHabit } = useHabits()
  const habit = habits.find((h) => h.id === habitId)
  const isEditing = Boolean(habitId)
  // Editing gets the full-screen form (same treatment as AddGoalSheet/ItemDetailModal) since
  // streak stats + the week grid rarely fit a half-screen sheet; creating stays a quick sheet.
  const fullScreen = isEditing
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const [title, setTitle] = useState('')
  const [regularity, setRegularity] = useState<HabitRegularity>(HABIT_REGULARITY.DAILY)
  const [categoryId, setCategoryId] = useState<string | undefined>()

  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderMode, setReminderMode] = useState<HabitReminderMode>(HABIT_REMINDER_MODE.INTERVAL)
  const [intervalHours, setIntervalHours] = useState('3')
  const [timesPerDay, setTimesPerDay] = useState('3')
  const [windowStart, setWindowStart] = useState<string | undefined>()
  const [windowEnd, setWindowEnd] = useState<string | undefined>()
  const [randomTimes, setRandomTimes] = useState<string[]>([])
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  // Same "adjust state during render" pattern AddGoalSheet uses: create mode resets to blank
  // as soon as the sheet opens; edit mode prefills once the fetched habit actually arrives.
  const [wasOpen, setWasOpen] = useState(open)
  const [syncedHabitId, setSyncedHabitId] = useState<string | undefined>(undefined)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && !habitId) {
      setTitle('')
      setRegularity(HABIT_REGULARITY.DAILY)
      setCategoryId(undefined)
      setReminderEnabled(false)
      setReminderMode(HABIT_REMINDER_MODE.INTERVAL)
      setIntervalHours('3')
      setTimesPerDay('3')
      setWindowStart(undefined)
      setWindowEnd(undefined)
      setRandomTimes([])
      setSyncedHabitId(undefined)
    } else if (!open) {
      setSyncedHabitId(undefined)
    }
  }
  if (open && habit && syncedHabitId !== habit.id) {
    setSyncedHabitId(habit.id)
    setTitle(habit.title)
    setRegularity(habit.regularity)
    setCategoryId(habit.categoryId)
    const reminder = habit.reminder
    setReminderEnabled(Boolean(reminder))
    setReminderMode(reminder?.mode ?? HABIT_REMINDER_MODE.INTERVAL)
    setIntervalHours(reminder?.intervalHours !== undefined ? String(reminder.intervalHours) : '3')
    setTimesPerDay(reminder?.timesPerDay !== undefined ? String(reminder.timesPerDay) : '3')
    setWindowStart(reminder?.windowStart)
    setWindowEnd(reminder?.windowEnd)
    setRandomTimes(reminder?.randomTimes ? [...reminder.randomTimes] : [])
  }

  const canSave = title.trim().length > 0

  const handleReroll = () => {
    setRandomTimes(generateRandomTimes({ timesPerDay: Number(timesPerDay) || 1, windowStart, windowEnd }))
  }

  // If the user enabled random mode but never tapped "sortear", roll once right at save time
  // instead of blocking save — domain validation requires randomTimes to be non-empty.
  const buildReminderPayload = (): HabitReminderConfig | undefined => {
    if (!reminderEnabled) return undefined
    if (reminderMode === HABIT_REMINDER_MODE.INTERVAL) {
      return { mode: HABIT_REMINDER_MODE.INTERVAL, intervalHours: Number(intervalHours) || 1, windowStart, windowEnd }
    }
    const finalRandomTimes = randomTimes.length > 0
      ? randomTimes
      : generateRandomTimes({ timesPerDay: Number(timesPerDay) || 1, windowStart, windowEnd })
    return { mode: HABIT_REMINDER_MODE.RANDOM, timesPerDay: Number(timesPerDay) || 1, windowStart, windowEnd, randomTimes: finalRandomTimes }
  }

  // Only reachable from the compact create sheet — editing saves via handleClose instead.
  const handleSave = async () => {
    if (!canSave) return
    try {
      await createHabit({ title: title.trim(), regularity, categoryId, reminder: buildReminderPayload() })
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
      return
    }
    onClose()
  }

  // Editing has no explicit Guardar — like task/goal editing, the back button saves and closes.
  const handleClose = async () => {
    if (isEditing && habitId && canSave) {
      try {
        await updateHabit({ id: habitId, patch: { title: title.trim(), regularity, categoryId, reminder: buildReminderPayload() } })
      } catch (error) {
        Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
        return
      }
    }
    onClose()
  }

  const handleDelete = () => {
    if (!habit) return
    Alert.alert('Eliminar hábito', '¿Eliminar este hábito?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => { await removeHabit(habit.id); onClose() },
      },
    ])
  }

  const completions = habit ? completionsByHabitId.get(habit.id) ?? [] : []
  const streaks = habit ? computeStreaks(completions, habit.regularity) : { current: 0, best: 0 }
  const weekStatus = habit?.regularity === HABIT_REGULARITY.DAILY ? weekCompletionStatus(completions) : undefined

  const renderFormFields = () => (
    <>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Nuevo hábito"
        placeholderTextColor={colors.textMuted}
        style={styles.mainInput}
        multiline
        autoFocus={!isEditing}
        selectionColor={colors.primary}
      />

      <View style={styles.optionsSeparator} />

      <Text style={styles.fieldLabel}>Regularidad</Text>
      <View style={styles.chipsRow}>
        {REGULARITY_OPTIONS.map((option) => {
          const active = regularity === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => setRegularity(option.value)}
              style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.chipText, active && { color: '#FFFFFF', fontWeight: '700' }]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.fieldLabel}>Categoría</Text>
      <View style={styles.chipsRow}>
        {DEFAULT_CATEGORIES.map((cat) => {
          const active = categoryId === cat.id
          const CategoryIcon = resolveCategoryIcon(cat.icon)
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategoryId(active ? undefined : cat.id)}
              style={[
                styles.chip,
                { flexDirection: 'row', alignItems: 'center', gap: 6 },
                active && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
            >
              <CategoryIcon size={14} color={active ? '#FFFFFF' : colors.textMuted} />
              <Text style={[styles.chipText, active && { color: '#FFFFFF', fontWeight: '700' }]}>{cat.name}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.optionsSeparator} />

      <Pressable style={styles.reminderToggleRow} onPress={() => setReminderEnabled((v) => !v)}>
        <Bell size={16} color={reminderEnabled ? colors.primary : colors.textMuted} />
        <Text style={styles.fieldLabelInline}>Recordatorios</Text>
        <View style={{ flex: 1 }} />
        <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
      </Pressable>

      {reminderEnabled && (
        <View style={styles.reminderPanel}>
          <View style={styles.chipsRow}>
            {REMINDER_MODE_OPTIONS.map((option) => {
              const active = reminderMode === option.value
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setReminderMode(option.value)}
                  style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.chipText, active && { color: '#FFFFFF', fontWeight: '700' }]}>{option.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {reminderMode === HABIT_REMINDER_MODE.INTERVAL ? (
            <View style={styles.reminderFieldRow}>
              <Text style={styles.reminderFieldLabel}>Cada cuántas horas</Text>
              <TextInput
                value={intervalHours}
                onChangeText={setIntervalHours}
                keyboardType="number-pad"
                style={styles.numberInput}
                selectionColor={colors.primary}
              />
            </View>
          ) : (
            <>
              <View style={styles.reminderFieldRow}>
                <Text style={styles.reminderFieldLabel}>Veces por día</Text>
                <TextInput
                  value={timesPerDay}
                  onChangeText={setTimesPerDay}
                  keyboardType="number-pad"
                  style={styles.numberInput}
                  selectionColor={colors.primary}
                />
              </View>
              <Pressable onPress={handleReroll} style={styles.rerollBtn}>
                <Shuffle size={14} color={colors.primary} />
                <Text style={styles.rerollBtnText}>Sortear horarios</Text>
              </Pressable>
              {randomTimes.length > 0 && (
                <View style={styles.randomTimesRow}>
                  {randomTimes.map((time) => (
                    <View key={time} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{time}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={styles.windowRow}>
            <Pressable onPress={() => setShowStartPicker(true)} style={styles.windowField}>
              <Text style={styles.reminderFieldLabel}>Desde</Text>
              <Text style={styles.windowValue}>{windowStart ?? 'Todo el día'}</Text>
            </Pressable>
            <Pressable onPress={() => setShowEndPicker(true)} style={styles.windowField}>
              <Text style={styles.reminderFieldLabel}>Hasta</Text>
              <Text style={styles.windowValue}>{windowEnd ?? 'Todo el día'}</Text>
            </Pressable>
            {(windowStart || windowEnd) && (
              <Pressable onPress={() => { setWindowStart(undefined); setWindowEnd(undefined) }} hitSlop={8} style={styles.windowClearBtn}>
                <X size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isEditing && habit && (
        <>
          <View style={styles.optionsSeparator} />
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Racha actual</Text>
              <Text style={styles.statValue}>{daysLabel(streaks.current)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Mejor racha</Text>
              <Text style={styles.statValue}>{daysLabel(streaks.best)}</Text>
            </View>
          </View>

          {weekStatus && (
            <>
              <Text style={styles.fieldLabel}>Esta semana</Text>
              <View style={styles.weekRow}>
                {weekStatus.map((done, index) => (
                  <View key={index} style={styles.weekDay}>
                    <Text style={styles.weekDayLabel}>{WEEKDAY_LABELS[index]}</Text>
                    <View style={[styles.weekDot, done && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      {done && <Check size={12} color="#FFFFFF" />}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>Estadísticas</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Completados</Text>
              <Text style={styles.statValue}>{daysLabel(completions.length)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Promedio semanal</Text>
              <Text style={styles.statValue}>{weeklyAverageLabel(completions.length, habit.createdAt, habit.regularity)}</Text>
            </View>
          </View>
        </>
      )}
    </>
  )

  return (
    <>
      <Modal visible={open} animationType="slide" transparent={!fullScreen} statusBarTranslucent onRequestClose={() => void (fullScreen ? handleClose() : onClose())}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {fullScreen ? (
            <View style={[styles.fullScreen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
              <View style={styles.fullScreenHeader}>
                <Pressable onPress={() => void handleClose()} hitSlop={12} style={styles.headerBtn}>
                  <ChevronLeft size={24} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
                  <Trash2 size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.fullScreenContent} keyboardShouldPersistTaps="handled">
                {renderFormFields()}
              </ScrollView>
            </View>
          ) : (
            <>
              <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]} onPress={onClose} />
              <View style={styles.sheetAnchor} pointerEvents="box-none">
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]} onStartShouldSetResponder={() => true}>
                  <View style={styles.dragHandle} />
                  {renderFormFields()}
                  <View style={styles.actionBar}>
                    <Pressable
                      onPress={() => void handleSave()}
                      disabled={!canSave}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginLeft: 'auto' })}
                    >
                      <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>Guardar</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Outside the Modal to avoid Android's nested-dialog issue, same as QuickAddSheet's time pickers. */}
      {open && showStartPicker && (
        <DateTimePicker
          value={windowStart ? parse(windowStart, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS !== 'ios') setShowStartPicker(false)
            if (event.type === 'dismissed' || !date) return
            setWindowStart(format(date, 'HH:mm'))
          }}
        />
      )}
      {open && showEndPicker && (
        <DateTimePicker
          value={windowEnd ? parse(windowEnd, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (Platform.OS !== 'ios') setShowEndPicker(false)
            if (event.type === 'dismissed' || !date) return
            setWindowEnd(format(date, 'HH:mm'))
          }}
        />
      )}
    </>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    sheetAnchor: { flex: 1, justifyContent: 'flex-end' },
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
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    fullScreen: { flex: 1 },
    fullScreenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    headerBtn: { padding: 8 },
    fullScreenContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
    mainInput: {
      fontSize: 18,
      color: colors.text,
      minHeight: 40,
      maxHeight: 100,
      padding: 0,
      outlineWidth: 0,
    },
    optionsSeparator: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 4 },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 14,
      marginBottom: 8,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    reminderToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    fieldLabelInline: { fontSize: 15, color: colors.text, fontWeight: '500' },
    reminderPanel: { gap: 12, paddingTop: 4, paddingBottom: 10 },
    reminderFieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reminderFieldLabel: { fontSize: 14, color: colors.textSecondary },
    numberInput: {
      width: 64,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      textAlign: 'center',
    },
    rerollBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.primary + '18',
    },
    rerollBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    randomTimesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    timeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceSecondary,
    },
    timeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    windowRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    windowField: { flex: 1 },
    windowValue: { fontSize: 15, color: colors.primary, fontWeight: '600', marginTop: 2 },
    windowClearBtn: { padding: 6 },
    statsRow: { flexDirection: 'row', gap: 12 },
    statBox: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    statLabel: { fontSize: 12, color: colors.textMuted },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: 6 },
    weekDayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    weekDot: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1.6,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBar: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    saveBtn: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingVertical: 6, paddingHorizontal: 4 },
    saveBtnDisabled: { color: colors.textMuted },
  })
