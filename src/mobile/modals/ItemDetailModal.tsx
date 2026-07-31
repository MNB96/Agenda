import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  AlignLeft,
  ChevronLeft,
  CircleCheck,
  Clock,
  CornerDownRight,
  MoreVertical,
  Star,
  Tag,
  X,
} from 'lucide-react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, isToday, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { useItems } from '../../features/items/useItems'
import { useSettings } from '../../features/settings/useSettings'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface ItemDetailModalProps {
  open: boolean
  onClose: () => void
  itemId: string
}

const fmtDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00')
  if (isToday(d)) return 'HOY'
  return format(d, "EEE d 'de' MMM", { locale: es })
}

export const ItemDetailModal = ({ open, onClose, itemId }: ItemDetailModalProps) => {
  const { items, createItem, updateItem, removeItem, toggleCompleted } = useItems()
  const { data: settings } = useSettings()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const titleRef = useRef<TextInput>(null)
  const descRef = useRef<TextInput>(null)

  const item = useMemo(() => items.find(i => i.id === itemId), [items, itemId])
  const subtasks = useMemo(() => items.filter(i => i.parentId === itemId), [items, itemId])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [important, setImportant] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string | undefined>()
  const [scheduledTime, setScheduledTime] = useState<string | undefined>()
  const [deadline, setDeadline] = useState<string | undefined>()

  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const subtaskInputRef = useRef<TextInput>(null)

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false)

  useEffect(() => {
    if (!open || !item) return
    setTitle(item.title)
    setDescription(item.description ?? '')
    setImportant(item.important ?? false)
    setScheduledDate(item.startDate)
    setScheduledTime(item.startTime)
    setDeadline(item.deadline)
    setCategoryId(item.categoryId)
  }, [open, item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(async () => {
    if (!item) { onClose(); return }
    if (title.trim()) {
      await updateItem({
        id: item.id,
        patch: {
          title: title.trim(),
          description: description.trim() || undefined,
          important,
          startDate: scheduledDate,
          startTime: scheduledTime,
          deadline,
          categoryId,
        },
      })
    }
    onClose()
  }, [item, title, description, important, scheduledDate, scheduledTime, deadline, updateItem, onClose])

  useEffect(() => {
    if (!open) return
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      void handleClose()
      return true
    })
    return () => handler.remove()
  }, [open, handleClose])

  const handleToggleComplete = async () => {
    if (!item) return
    await toggleCompleted(item)
    onClose()
  }

  const handleDelete = () => {
    if (!item) return
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
    if (!text || !item) return
    setNewSubtaskText('')
    await createItem({ title: text, parentId: item.id, type: 'task' })
    setTimeout(() => subtaskInputRef.current?.focus(), 100)
  }

  if (!open) return null

  const isCompleted = item?.status === 'completed'
  const allSubtasksDone = subtasks.length === 0 || subtasks.every(s => s.status === 'completed')
  const canComplete = allSubtasksDone
  const dateLabel = scheduledDate ? fmtDate(scheduledDate) : undefined
  const deadlineLabel = deadline ? fmtDate(deadline) : undefined

  return (
    <>
      <Modal
        visible={open}
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
              ref={titleRef}
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
                ref={descRef}
                value={description}
                onChangeText={setDescription}
                style={[styles.detailRowInput, description.trim() ? { color: colors.text } : {}]}
                placeholder="Agregar detalles"
                placeholderTextColor={colors.textMuted}
                multiline
                selectionColor={colors.primary}
              />
            </View>

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
            <Pressable style={styles.detailRow} onPress={() => setShowDatePicker(true)}>
              <Clock size={20} color={scheduledDate ? colors.primary : colors.textMuted} style={styles.rowIcon} />
              {dateLabel ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    style={[styles.chip, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '15' }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.chipText, { color: colors.primary }]}>
                      {dateLabel}{scheduledTime ? `, ${scheduledTime}` : ''}
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
                </View>
              ) : (
                <Text style={styles.detailRowPlaceholder}>Agregar fecha</Text>
              )}
            </Pressable>

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

      {/* Native pickers outside Modal to avoid Android nested dialog issue */}
      {open && showDatePicker && (
        <DateTimePicker
          value={scheduledDate ? new Date(scheduledDate + 'T00:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setShowDatePicker(false)
            if (event.type === 'dismissed' || !date) return
            setScheduledDate(format(date, 'yyyy-MM-dd'))
          }}
        />
      )}
      {open && showTimePicker && (
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
      {open && showDeadlinePicker && (
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
  })
