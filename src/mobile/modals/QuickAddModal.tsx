import { useEffect, useMemo, useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { format, parse } from 'date-fns'
import { parseQuickInput } from '../../services/parser/quickInputParser'
import { useItems } from '../../features/items/useItems'
import type { ItemType } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface QuickAddModalProps {
  open: boolean
  onClose: () => void
}

type PickerTarget = 'startDate' | 'startTime' | 'deadline' | null

const nextType = (current: ItemType): ItemType => {
  const order: ItemType[] = ['task', 'event', 'deadline', 'goal', 'date_window', 'important_date', 'reminder']
  const index = order.indexOf(current)
  return order[(index + 1) % order.length]
}

const typeLabel: Record<ItemType, string> = {
  task: 'Tarea',
  event: 'Evento',
  deadline: 'Deadline',
  reminder: 'Recordatorio',
  goal: 'Meta',
  important_date: 'Fecha importante',
  date_window: 'Ventana de fecha',
}

const parseDateValue = (value: string): Date => {
  const parsed = parse(value, 'yyyy-MM-dd', new Date())
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

const parseTimeValue = (value: string): Date => {
  const parsed = parse(value, 'HH:mm', new Date())
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export const QuickAddModal = ({ open, onClose }: QuickAddModalProps) => {
  const { createItem, isSaving } = useItems()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseQuickInput(text || ''), [text])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [deadline, setDeadline] = useState('')
  const [location, setLocation] = useState('')
  const [type, setType] = useState<ItemType>('task')
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)

  useEffect(() => {
    setTitle(parsed.inferred.title ?? '')
    setDescription(parsed.inferred.description ?? '')
    setStartDate(parsed.inferred.startDate ?? '')
    setStartTime(parsed.inferred.startTime ?? '')
    setDeadline(parsed.inferred.deadline ?? '')
    setLocation(parsed.inferred.location ?? '')
    if (parsed.detectedType === 'Evento') {
      setType('event')
    } else if (parsed.detectedType === 'Deadline') {
      setType('deadline')
    } else if (parsed.detectedType === 'Meta') {
      setType('goal')
    } else if (parsed.detectedType === 'Ventana de fecha') {
      setType('date_window')
    } else {
      setType('task')
    }
  }, [parsed])

  const reset = () => {
    setText('')
    setTitle('')
    setDescription('')
    setStartDate('')
    setStartTime('')
    setDeadline('')
    setLocation('')
    setType('task')
    setSyncToGoogleCalendar(false)
    setPickerTarget(null)
  }

  const onPickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setPickerTarget(null)
    }
    if (event.type === 'dismissed' || !selectedDate || !pickerTarget) {
      return
    }

    if (pickerTarget === 'startDate') {
      setStartDate(format(selectedDate, 'yyyy-MM-dd'))
      return
    }
    if (pickerTarget === 'deadline') {
      setDeadline(format(selectedDate, 'yyyy-MM-dd'))
      return
    }
    setStartTime(format(selectedDate, 'HH:mm'))
  }

  const pickerValue =
    pickerTarget === 'startDate'
      ? parseDateValue(startDate)
      : pickerTarget === 'deadline'
        ? parseDateValue(deadline)
        : parseTimeValue(startTime)

  const onSave = async () => {
    if (!title.trim()) {
      return
    }

    await createItem({
      title,
      description: description || undefined,
      type,
      startDate: startDate || undefined,
      startTime: startTime || undefined,
      deadline: deadline || undefined,
      dateWindow: parsed.inferred.dateWindow,
      location: location || undefined,
      goalConfig: type === 'goal' ? parsed.inferred.goalConfig : undefined,
      syncToGoogleCalendar,
    })

    reset()
    onClose()
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Nuevo item:</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Texto rapido (opcional)"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[styles.input, styles.multiline]}
            />

            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Detectado: {parsed.detectedType}</Text>
              <Text style={styles.previewMeta}>
                {parsed.hints.join(' · ') || 'Completa el texto para inferir fecha, hora, deadline o ventana.'}
              </Text>
            </View>

            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Titulo"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.multiline]}
              multiline
              placeholder="Descripcion"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Fecha</Text>
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerButton} onPress={() => setPickerTarget('startDate')}>
                  <Text style={styles.pickerButtonText}>{startDate || 'Seleccionar'}</Text>
                </Pressable>
                {startDate ? (
                  <Pressable style={styles.clearButton} onPress={() => setStartDate('')}>
                    <Text style={styles.clearButtonText}>Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Hora</Text>
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerButton} onPress={() => setPickerTarget('startTime')}>
                  <Text style={styles.pickerButtonText}>{startTime || 'Seleccionar'}</Text>
                </Pressable>
                {startTime ? (
                  <Pressable style={styles.clearButton} onPress={() => setStartTime('')}>
                    <Text style={styles.clearButtonText}>Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.pickerRow}>
              <Text style={styles.pickerLabel}>Deadline</Text>
              <View style={styles.pickerActions}>
                <Pressable style={styles.pickerButton} onPress={() => setPickerTarget('deadline')}>
                  <Text style={styles.pickerButtonText}>{deadline || 'Seleccionar'}</Text>
                </Pressable>
                {deadline ? (
                  <Pressable style={styles.clearButton} onPress={() => setDeadline('')}>
                    <Text style={styles.clearButtonText}>Quitar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <TextInput
              value={location}
              onChangeText={setLocation}
              style={styles.input}
              placeholder="Ubicacion"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable style={styles.typeButton} onPress={() => setType((current) => nextType(current))}>
              <Text style={styles.typeButtonText}>Tipo: {typeLabel[type]}</Text>
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Sincronizar con Google Calendar</Text>
              <Switch value={syncToGoogleCalendar} onValueChange={setSyncToGoogleCalendar} />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} disabled={isSaving} onPress={() => void onSave()}>
              <Text style={styles.primaryButtonText}>Guardar</Text>
            </Pressable>
          </View>

          {pickerTarget ? (
            <DateTimePicker
              value={pickerValue}
              mode={pickerTarget === 'startTime' ? 'time' : 'date'}
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ThemeTokens) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayAccent,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlignVertical: 'center',
    marginBottom: 8,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  previewBox: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  previewLabel: { fontSize: 12, color: colors.textMuted },
  previewMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  pickerRow: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 8,
  },
  pickerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  pickerButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  clearButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  typeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.creamSoft,
  },
  typeButtonText: { color: colors.onPrimary, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  switchLabel: { color: colors.textSecondary, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: colors.textSecondary, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: colors.fabText, fontWeight: '700' },
})
