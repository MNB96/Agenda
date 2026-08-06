import { useReducer } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { AlarmClock, Bell, Check, ChevronDown, Navigation, Pin, X } from 'lucide-react-native'
import type { ReminderConfig } from '../../domain/items/types'
import type { ThemeTokens } from '../theme/tokens'
import { createId } from '../../utils/id'

const REMINDER_PRESETS: { label: string; minutesBefore: number }[] = [
  { label: 'A la hora', minutesBefore: 0 },
  { label: '10 min antes', minutesBefore: 10 },
  { label: '30 min antes', minutesBefore: 30 },
  { label: '1 hora antes', minutesBefore: 60 },
  { label: '1 día antes', minutesBefore: 1440 },
]

const formatReminderLabel = (reminder: ReminderConfig): string => {
  const mins = reminder.minutesBefore
  if (mins === undefined) return 'Recordatorio'
  if (reminder.mode === 'departure') {
    if (mins < 60) return `Salir ${mins} min antes`
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return minutes > 0 ? `Salir ${hours}h ${minutes}min antes` : `Salir ${hours}h antes`
  }
  if (mins === 0) return 'A la hora'
  if (mins < 60) return `${mins} min antes`
  if (mins < 1440) {
    const hours = mins / 60
    return Number.isInteger(hours) ? (hours === 1 ? '1 hora antes' : `${hours} horas antes`) : `${mins} min antes`
  }
  const days = mins / 1440
  return Number.isInteger(days) ? (days === 1 ? '1 día antes' : `${days} días antes`) : `${Math.floor(mins / 60)}h antes`
}

type CustomUnit = 'min' | 'h' | 'días'

interface CustomDraft {
  minutesText: string
  unit: CustomUnit
  showInput: boolean
}

type CustomDraftAction =
  | { type: 'patch'; patch: Partial<CustomDraft> }
  | { type: 'reset' }

const customDraftReducer = (state: CustomDraft, action: CustomDraftAction): CustomDraft => {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch }
    case 'reset':
      return { minutesText: '', unit: 'min', showInput: false }
  }
}

interface ReminderPanelProps {
  reminders: ReminderConfig[]
  onChangeReminders: (next: ReminderConfig[]) => void
  alarmType: 'notification' | 'alarm'
  onChangeAlarmType: (type: 'notification' | 'alarm') => void
  persistent: boolean
  onChangePersistent: (value: boolean) => void
  /** Show the "recordarme cuándo salir" travel-time row (needs a location + a relevant date). */
  showTravelButton: boolean
  travelTimeLoading: boolean
  hasTravelConfig: boolean
  travelTimeResult: string | null
  onCalculateTravelTime: () => void
  colors: ThemeTokens
  /** ItemDetailModal indents the panel under its row icon; QuickAddSheet doesn't. */
  indent?: boolean
  /** ItemDetailModal separates each row with a bottom border; QuickAddSheet doesn't. */
  rowDividers?: boolean
}

export const ReminderPanel = ({
  reminders,
  onChangeReminders,
  alarmType,
  onChangeAlarmType,
  persistent,
  onChangePersistent,
  showTravelButton,
  travelTimeLoading,
  hasTravelConfig,
  travelTimeResult,
  onCalculateTravelTime,
  colors,
  indent,
  rowDividers,
}: ReminderPanelProps) => {
  const [draft, dispatch] = useReducer(customDraftReducer, { minutesText: '', unit: 'min', showInput: false })
  const styles = createStyles(colors, Boolean(rowDividers))

  const togglePreset = (minutesBefore: number) => {
    const exists = reminders.some((reminder) => reminder.minutesBefore === minutesBefore)
    onChangeReminders(
      exists
        ? reminders.filter((reminder) => reminder.minutesBefore !== minutesBefore)
        : [...reminders, { id: createId(), mode: 'relative', minutesBefore, alarmType, persistent }],
    )
  }

  const addCustomReminder = () => {
    const parsedMinutes = parseInt(draft.minutesText, 10)
    if (isNaN(parsedMinutes) || parsedMinutes < 0) return
    const mins = draft.unit === 'h' ? parsedMinutes * 60 : draft.unit === 'días' ? parsedMinutes * 1440 : parsedMinutes
    if (!reminders.some((reminder) => reminder.minutesBefore === mins)) {
      onChangeReminders([...reminders, { id: createId(), mode: 'relative', minutesBefore: mins, alarmType, persistent }])
    }
    dispatch({ type: 'reset' })
  }

  return (
    <View style={[styles.container, indent && styles.containerIndented]}>
      {/* Recordatorios ya agregados */}
      {reminders.map((reminder) => (
        <View key={reminder.id} style={styles.addedRow}>
          <Text style={styles.addedText}>{formatReminderLabel(reminder)}</Text>
          <View style={[styles.typePill, reminder.alarmType === 'alarm' && styles.typePillAlarm]}>
            {reminder.alarmType === 'alarm'
              ? <AlarmClock size={11} color={colors.accent} />
              : <Bell size={11} color={colors.primary} />}
            <Text style={[styles.typePillText, reminder.alarmType === 'alarm' && { color: colors.accent }]}>
              {reminder.alarmType === 'alarm' ? 'Alarma' : 'Notif.'}
            </Text>
          </View>
          <Pressable onPress={() => onChangeReminders(reminders.filter((entry) => entry.id !== reminder.id))} hitSlop={8}>
            <X size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      {/* Selector de tipo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        <Text style={styles.typeLabel}>Tipo:</Text>
        <Pressable
          style={[styles.typeBtn, alarmType === 'notification' && styles.typeBtnActive]}
          onPress={() => onChangeAlarmType('notification')}
        >
          <Bell size={12} color={alarmType === 'notification' ? colors.primary : colors.textMuted} />
          <Text style={[styles.typeBtnText, alarmType === 'notification' && { color: colors.primary, fontWeight: '600' }]}>
            Notificación
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, alarmType === 'alarm' && styles.typeBtnAlarmActive]}
          onPress={() => onChangeAlarmType('alarm')}
        >
          <AlarmClock size={12} color={alarmType === 'alarm' ? colors.accent : colors.textMuted} />
          <Text style={[styles.typeBtnText, alarmType === 'alarm' && { color: colors.accent, fontWeight: '600' }]}>
            Alarma
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, persistent && styles.typeBtnActive]}
          onPress={() => onChangePersistent(!persistent)}
        >
          <Pin size={12} color={persistent ? colors.primary : colors.textMuted} />
          <Text style={[styles.typeBtnText, persistent && { color: colors.primary, fontWeight: '600' }]}>
            Persistente
          </Text>
        </Pressable>
      </ScrollView>

      {/* Presets */}
      {REMINDER_PRESETS.map((preset) => {
        const active = reminders.some((reminder) => reminder.minutesBefore === preset.minutesBefore)
        return (
          <Pressable key={preset.minutesBefore} style={styles.presetRow} onPress={() => togglePreset(preset.minutesBefore)}>
            <Text style={[styles.presetText, active && { color: colors.primary, fontWeight: '600' }]}>
              {preset.label}
            </Text>
            {active && <Check size={16} color={colors.primary} />}
          </Pressable>
        )
      })}

      {/* Travel time — solo si hay dirección y una fecha relevante */}
      {showTravelButton && (
        <Pressable style={styles.presetRow} onPress={onCalculateTravelTime} disabled={travelTimeLoading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Navigation size={13} color={colors.primary} />
            <Text style={[styles.presetText, { color: colors.primary }]}>
              {travelTimeLoading
                ? 'Calculando...'
                : hasTravelConfig
                  ? 'Recalcular salida (tráfico actual)'
                  : 'Recordarme cuándo salir'}
            </Text>
          </View>
          {travelTimeResult && <Text style={{ fontSize: 12, color: colors.textMuted }}>{travelTimeResult}</Text>}
        </Pressable>
      )}

      {/* Personalizado */}
      <Pressable style={styles.presetRow} onPress={() => dispatch({ type: 'patch', patch: { showInput: !draft.showInput } })}>
        <Text style={styles.presetText}>Personalizado...</Text>
        <ChevronDown
          size={14}
          color={colors.textMuted}
          style={{ transform: [{ rotate: draft.showInput ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {draft.showInput && (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={draft.minutesText}
            onChangeText={(text) => dispatch({ type: 'patch', patch: { minutesText: text } })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={addCustomReminder}
            selectionColor={colors.primary}
          />
          <View style={styles.customUnitRow}>
            {(['min', 'h', 'días'] as const).map((unitOption) => (
              <Pressable
                key={unitOption}
                style={[styles.customUnitBtn, draft.unit === unitOption && styles.customUnitBtnActive]}
                onPress={() => dispatch({ type: 'patch', patch: { unit: unitOption } })}
              >
                <Text style={[styles.customUnitText, draft.unit === unitOption && { color: colors.primary, fontWeight: '600' }]}>{unitOption}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.customBeforeLabel}>antes</Text>
          <Pressable style={styles.customAdd} onPress={addCustomReminder}>
            <Text style={styles.customAddText}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ThemeTokens, rowDividers: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      marginBottom: 4,
      overflow: 'hidden',
    },
    containerIndented: {
      marginLeft: 36,
    },
    addedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    addedText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    typePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary + '60',
    },
    typePillAlarm: {
      borderColor: colors.accent + '60',
      backgroundColor: colors.accent + '15',
    },
    typePillText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    typeLabel: {
      fontSize: 13,
      color: colors.textMuted,
      marginRight: 2,
    },
    typeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    typeBtnAlarmActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    typeBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 14,
      ...(rowDividers ? { borderBottomWidth: 1 as const, borderColor: colors.border } : null),
    },
    presetText: {
      fontSize: 14,
      color: colors.text,
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    customInput: {
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
    customBeforeLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    customAdd: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    customAddText: {
      fontSize: 13,
      color: colors.onPrimary,
      fontWeight: '600',
    },
  })
