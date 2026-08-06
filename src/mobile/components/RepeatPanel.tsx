import { useEffect, useReducer } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { addMonths, format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, ChevronDown, ChevronLeft } from 'lucide-react-native'
import type { EdgeInsets } from 'react-native-safe-area-context'
import type { RepeatConfigInput, RepeatRule } from '../../domain/items/types'
import type { ThemeTokens } from '../theme/tokens'

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const UNIT_OPTIONS: { label: string; value: RepeatConfigInput['unit'] }[] = [
  { label: 'día', value: 'day' },
  { label: 'semana', value: 'week' },
  { label: 'mes', value: 'month' },
  { label: 'año', value: 'year' },
]

const UNIT_TO_RULE: Record<RepeatConfigInput['unit'], RepeatRule> = {
  day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
}
export const RULE_TO_UNIT: Partial<Record<RepeatRule, RepeatConfigInput['unit']>> = {
  daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
}

interface RepeatDraft {
  unit: RepeatConfigInput['unit']
  interval: number
  daysOfWeek: number[]
  time?: string
  end: RepeatConfigInput['end']
  endDate?: string
  occurrences: number
  showUnitPicker: boolean
  showTimePicker: boolean
  showEndDatePicker: boolean
}

const buildInitialDraft = (rule: RepeatRule, config?: RepeatConfigInput): RepeatDraft => ({
  unit: RULE_TO_UNIT[rule] ?? 'week',
  interval: config?.interval ?? 1,
  daysOfWeek: config?.daysOfWeek ?? [],
  time: config?.time,
  end: config?.end ?? 'never',
  endDate: config?.endDate,
  occurrences: config?.occurrences ?? 13,
  showUnitPicker: false,
  showTimePicker: false,
  showEndDatePicker: false,
})

type RepeatDraftAction =
  | { type: 'reset'; rule: RepeatRule; config?: RepeatConfigInput }
  | { type: 'patch'; patch: Partial<RepeatDraft> }
  | { type: 'toggleDay'; idx: number }

const repeatDraftReducer = (state: RepeatDraft, action: RepeatDraftAction): RepeatDraft => {
  switch (action.type) {
    case 'reset':
      return buildInitialDraft(action.rule, action.config)
    case 'patch':
      return { ...state, ...action.patch }
    case 'toggleDay': {
      const has = state.daysOfWeek.includes(action.idx)
      return {
        ...state,
        daysOfWeek: has ? state.daysOfWeek.filter((dayIndex) => dayIndex !== action.idx) : [...state.daysOfWeek, action.idx],
      }
    }
  }
}

interface RepeatPanelProps {
  visible: boolean
  rule: RepeatRule
  config?: RepeatConfigInput
  /** yyyy-MM-dd. Shown read-only in "Comienza" — falls back to today when not set yet. */
  startDate?: string
  onClose: () => void
  onDone: (rule: RepeatRule, config: RepeatConfigInput) => void
  colors: ThemeTokens
  insets: Pick<EdgeInsets, 'top' | 'bottom'>
}

export const RepeatPanel = ({ visible, rule, config, startDate, onClose, onDone, colors, insets }: RepeatPanelProps) => {
  const [draft, dispatch] = useReducer(repeatDraftReducer, buildInitialDraft(rule, config))
  const styles = createStyles(colors)

  // Re-seed the draft from the committed rule/config every time the panel opens, so an
  // abandoned edit (back button, no "Listo") never leaks into the next time it's opened.
  useEffect(() => {
    if (visible) dispatch({ type: 'reset', rule, config })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const handleDone = () => {
    const nextRule = UNIT_TO_RULE[draft.unit]
    const nextConfig: RepeatConfigInput = {
      unit: draft.unit,
      interval: draft.interval,
      daysOfWeek: draft.unit === 'week' ? draft.daysOfWeek : undefined,
      time: draft.time,
      end: draft.end,
      endDate: draft.end === 'on_date' ? draft.endDate : undefined,
      occurrences: draft.end === 'after_occurrences' ? draft.occurrences : undefined,
    }
    onDone(nextRule, nextConfig)
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={onClose}>
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12}>
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Se repite.</Text>
            <Pressable onPress={handleDone} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text style={styles.doneText}>Listo</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Todos los [N] [unidad] */}
            <Text style={styles.sectionLabel}>Todos los</Text>
            <View style={styles.intervalRow}>
              <TextInput
                value={String(draft.interval)}
                onChangeText={(text) => {
                  const parsedInterval = parseInt(text, 10)
                  if (!isNaN(parsedInterval) && parsedInterval > 0) dispatch({ type: 'patch', patch: { interval: parsedInterval } })
                }}
                keyboardType="number-pad"
                style={styles.intervalInput}
                maxLength={3}
                selectTextOnFocus
                selectionColor={colors.primary}
              />
              <Pressable
                style={styles.unitBtn}
                onPress={() => dispatch({ type: 'patch', patch: { showUnitPicker: !draft.showUnitPicker } })}
              >
                <Text style={styles.unitText}>
                  {UNIT_OPTIONS.find((option) => option.value === draft.unit)?.label ?? 'semana'}
                </Text>
                <ChevronDown size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {draft.showUnitPicker && (
              <View style={[styles.dropdownList, { marginBottom: 12 }]}>
                {UNIT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={styles.dropdownItem}
                    onPress={() => dispatch({ type: 'patch', patch: { unit: opt.value, showUnitPicker: false } })}
                  >
                    <Text style={[styles.dropdownItemText, draft.unit === opt.value && { color: colors.primary, fontWeight: '600' }]}>
                      {opt.label}
                    </Text>
                    {draft.unit === opt.value && <Check size={16} color={colors.primary} />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Días de la semana (solo weekly) */}
            {draft.unit === 'week' && (
              <View style={styles.weekdayCircleRow}>
                {WEEKDAY_SHORT.map((label, idx) => {
                  const active = draft.daysOfWeek.includes(idx)
                  return (
                    <Pressable
                      key={idx}
                      style={[styles.weekdayCircle, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => dispatch({ type: 'toggleDay', idx })}
                    >
                      <Text style={[styles.weekdayCircleText, active && { color: colors.onPrimary }]}>{label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* Establecer hora */}
            <Pressable style={styles.fieldBox} onPress={() => dispatch({ type: 'patch', patch: { showTimePicker: true } })}>
              <Text style={{ fontSize: 15, color: draft.time ? colors.text : colors.textMuted }}>
                {draft.time ?? 'Establecer hora'}
              </Text>
            </Pressable>

            <View style={styles.divider} />

            {/* Comienza */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Comienza</Text>
            <View style={styles.fieldBox}>
              <Text style={{ fontSize: 15, color: colors.text }}>
                {startDate
                  ? format(new Date(startDate + 'T00:00:00'), "d 'de' MMMM", { locale: es })
                  : format(new Date(), "d 'de' MMMM", { locale: es })}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Finaliza */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Finaliza</Text>

            <Pressable style={styles.radioRow} onPress={() => dispatch({ type: 'patch', patch: { end: 'never' } })}>
              <View style={[styles.radioOuter, draft.end === 'never' && { borderColor: colors.primary }]}>
                {draft.end === 'never' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={styles.radioLabel}>Nunca</Text>
            </Pressable>

            <View style={styles.radioRow}>
              <Pressable
                onPress={() => dispatch({ type: 'patch', patch: { end: 'on_date' } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
              >
                <View style={[styles.radioOuter, draft.end === 'on_date' && { borderColor: colors.primary }]}>
                  {draft.end === 'on_date' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={styles.radioLabel}>El</Text>
              </Pressable>
              <Pressable
                style={styles.endField}
                onPress={() => dispatch({ type: 'patch', patch: { end: 'on_date', showEndDatePicker: true } })}
              >
                <Text style={{ fontSize: 15, color: colors.text }}>
                  {draft.endDate
                    ? format(new Date(draft.endDate + 'T00:00:00'), "d 'de' MMMM", { locale: es })
                    : format(addMonths(new Date(), 3), "d 'de' MMMM", { locale: es })}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.radioRow, { alignItems: 'center' }]}>
              <Pressable
                onPress={() => dispatch({ type: 'patch', patch: { end: 'after_occurrences' } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={[styles.radioOuter, draft.end === 'after_occurrences' && { borderColor: colors.primary }]}>
                  {draft.end === 'after_occurrences' && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={styles.radioLabel}>Después de</Text>
              </Pressable>
              <TextInput
                value={String(draft.occurrences)}
                onChangeText={(text) => {
                  const parsedOccurrences = parseInt(text, 10)
                  if (!isNaN(parsedOccurrences) && parsedOccurrences > 0) dispatch({ type: 'patch', patch: { occurrences: parsedOccurrences } })
                }}
                keyboardType="number-pad"
                style={[styles.intervalInput, { marginHorizontal: 8 }]}
                maxLength={3}
                selectTextOnFocus
                selectionColor={colors.primary}
                onFocus={() => dispatch({ type: 'patch', patch: { end: 'after_occurrences' } })}
              />
              <Text style={styles.radioLabel}>repeticiones</Text>
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Native pickers outside the Modal to avoid the Android nested-dialog issue */}
      {visible && draft.showTimePicker && (
        <DateTimePicker
          value={draft.time ? parse(draft.time, 'HH:mm', new Date()) : new Date()}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') dispatch({ type: 'patch', patch: { showTimePicker: false } })
            if (event.type === 'dismissed' || !date) return
            dispatch({ type: 'patch', patch: { time: format(date, 'HH:mm') } })
          }}
        />
      )}
      {visible && draft.showEndDatePicker && (
        <DateTimePicker
          value={draft.endDate ? new Date(draft.endDate + 'T00:00:00') : addMonths(new Date(), 3)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') dispatch({ type: 'patch', patch: { showEndDatePicker: false } })
            if (event.type === 'dismissed' || !date) return
            dispatch({ type: 'patch', patch: { endDate: format(date, 'yyyy-MM-dd') } })
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
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 8,
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    doneText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 15,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    intervalInput: {
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
    unitBtn: {
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
    unitText: {
      fontSize: 15,
      color: colors.text,
    },
    dropdownList: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      marginBottom: 4,
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    dropdownItemText: {
      fontSize: 14,
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
    fieldBox: {
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      justifyContent: 'center',
      marginBottom: 14,
      backgroundColor: colors.surfaceSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    radioRow: {
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
    radioLabel: {
      fontSize: 15,
      color: colors.text,
    },
    endField: {
      flex: 1,
      height: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
    },
  })
