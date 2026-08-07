import { useMemo, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, CornerDownRight, Flag, Plus, Star, Trash2, X, XCircle } from 'lucide-react-native'
import { format, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { MonthCalendar } from '../components/MonthCalendar'
import { useItems } from '../../application/items/useItems'
import { useItem } from '../../application/items/useItem'
import { useSubtasks } from '../../application/items/useSubtasks'
import { Item, ITEM_TYPE } from '../../domain/items'
import { GOAL_CATEGORIES } from '../../domain/settings/types'
import { useAppTheme } from '../theme/useAppTheme'
import { resolveCategoryIcon } from '../theme/categoryIcons'
import type { ThemeTokens } from '../theme/tokens'

interface AddGoalSheetProps {
  open: boolean
  /** Present when editing an existing goal instead of creating a new one. */
  goalId?: string
  onClose: () => void
}

const fmtShort = (dateStr: string) => {
  const date = new Date(dateStr + 'T00:00:00')
  return isToday(date) ? 'HOY' : format(date, 'd MMM', { locale: es })
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

export const AddGoalSheet = ({ open, goalId, onClose }: AddGoalSheetProps) => {
  const { createItem, updateItem, removeItem, toggleCompleted, isSaving } = useItems()
  const { data: item } = useItem(goalId)
  const { data: subgoals = [] } = useSubtasks(goalId ?? '')
  const isEditing = Boolean(goalId)
  // Editing gets the full-screen form (same treatment as ItemDetailModal for tasks) since a
  // goal with subgoals + details rarely fits a half-screen sheet; creating stays a quick sheet.
  const fullScreen = isEditing
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [important, setImportant] = useState(false)
  const [deadline, setDeadline] = useState<string | undefined>()
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false)
  const [newSubgoalText, setNewSubgoalText] = useState('')
  // Subgoals typed before the goal itself is saved (no parentId yet) — created in handleSave.
  const [pendingSubgoals, setPendingSubgoals] = useState<string[]>([])

  // Same "adjust state during render" pattern QuickAddSheet uses: create mode resets to blank
  // as soon as the sheet opens; edit mode prefills once the fetched item actually arrives.
  const [wasOpen, setWasOpen] = useState(open)
  const [syncedGoalId, setSyncedGoalId] = useState<string | undefined>(undefined)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && !goalId) {
      setTitle('')
      setDescription('')
      setImportant(false)
      setDeadline(undefined)
      setCategoryId(undefined)
      setDeadlinePickerOpen(false)
      setNewSubgoalText('')
      setPendingSubgoals([])
      setSyncedGoalId(undefined)
    } else if (!open) {
      setSyncedGoalId(undefined)
    }
  }
  if (open && item && item.type === ITEM_TYPE.GOAL && syncedGoalId !== item.id) {
    setSyncedGoalId(item.id)
    setTitle(item.title)
    setDescription(item.description ?? '')
    setImportant(item.important ?? false)
    setDeadline(item.deadline)
    setCategoryId(item.categoryId)
    setDeadlinePickerOpen(false)
    setNewSubgoalText('')
  }

  const canSave = title.trim().length > 0

  // Only reachable from the compact create sheet — editing saves via handleClose instead.
  const handleSave = async () => {
    if (!canSave) return
    try {
      const created = await createItem({
        title: title.trim(),
        description: description.trim() || undefined,
        type: ITEM_TYPE.GOAL,
        important,
        deadline,
        categoryId,
      })
      for (const subgoalTitle of pendingSubgoals) {
        await createItem({ title: subgoalTitle, parentId: created.id, type: ITEM_TYPE.GOAL })
      }
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
      return
    }
    onClose()
  }

  const addSubgoal = async () => {
    const text = newSubgoalText.trim()
    if (!text) return
    setNewSubgoalText('')
    if (goalId) {
      await createItem({ title: text, parentId: goalId, type: ITEM_TYPE.GOAL })
    } else {
      setPendingSubgoals((prev) => [...prev, text])
    }
  }

  const removePendingSubgoal = (index: number) => {
    setPendingSubgoals((prev) => prev.filter((_, i) => i !== index))
  }

  const removeSubgoal = async (subgoal: Item) => {
    await removeItem(subgoal)
  }

  // Editing has no explicit Guardar — like task editing, the back button saves and closes.
  const handleClose = async () => {
    if (deadlinePickerOpen) { setDeadlinePickerOpen(false); return }
    if (isEditing && goalId && canSave) {
      try {
        await updateItem({
          id: goalId,
          patch: {
            title: title.trim(),
            description: description.trim() || undefined,
            important,
            deadline,
            categoryId,
          },
        })
      } catch (error) {
        Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Revisá los datos ingresados.')
        return
      }
    }
    onClose()
  }

  const handleDelete = () => {
    if (!item) return
    Alert.alert('Eliminar meta', '¿Eliminar esta meta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => { await removeItem(item); onClose() },
      },
    ])
  }

  const isCompleted = item?.status === 'completed'
  const canComplete = item ? Item.canComplete(item, subgoals) : false

  const handleToggleComplete = async () => {
    if (!item) return
    if (!canComplete && !isCompleted) {
      Alert.alert('Submetas pendientes', 'Completá todas las submetas primero.')
      return
    }
    await toggleCompleted(item)
    onClose()
  }

  const renderFormFields = () => (
    <>
      <View style={styles.titleRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nueva meta"
          placeholderTextColor={colors.textMuted}
          style={styles.mainInput}
          multiline
          autoFocus={!isEditing}
          selectionColor={colors.primary}
        />
        <Pressable onPress={() => setImportant((v) => !v)} hitSlop={8}>
          <Star size={22} color={important ? '#F38630' : colors.textMuted} fill={important ? '#F38630' : 'transparent'} />
        </Pressable>
      </View>

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Agregar detalles"
        placeholderTextColor={colors.textMuted}
        style={styles.descriptionInput}
        multiline
        selectionColor={colors.primary}
      />

      <View style={styles.optionsSeparator} />

      <OptionRow
        label="Fecha límite"
        value={deadline ? fmtShort(deadline) : undefined}
        onPress={() => setDeadlinePickerOpen(true)}
        onClear={deadline ? () => setDeadline(undefined) : undefined}
        icon={Flag}
        colors={colors}
      />

      <View style={styles.optionsSeparator} />

      <View style={styles.categoryRow}>
        {GOAL_CATEGORIES.map((cat) => {
          const active = categoryId === cat.id
          const CategoryIcon = resolveCategoryIcon(cat.icon)
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategoryId(active ? undefined : cat.id)}
              style={[styles.categoryChip, active && { backgroundColor: cat.color, borderColor: cat.color }]}
            >
              <CategoryIcon size={14} color={active ? '#FFFFFF' : colors.textMuted} />
              <Text style={[styles.categoryChipText, active && { color: '#FFFFFF', fontWeight: '700' }]}>{cat.name}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.optionsSeparator} />
      {isEditing
        ? subgoals.map((sub) => (
            <View key={sub.id} style={styles.subgoalRow}>
              <Pressable
                onPress={() => void toggleCompleted(sub)}
                style={[styles.subgoalCheck, sub.status === 'completed' && { backgroundColor: colors.success, borderColor: colors.success }]}
              />
              <Text style={[styles.subgoalTitle, sub.status === 'completed' && styles.subgoalTitleDone]}>{sub.title}</Text>
              <Pressable onPress={() => void removeSubgoal(sub)} hitSlop={8}>
                <XCircle size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        : pendingSubgoals.map((subgoalTitle, index) => (
            <View key={index} style={styles.subgoalRow}>
              <View style={styles.subgoalCheck} />
              <Text style={styles.subgoalTitle}>{subgoalTitle}</Text>
              <Pressable onPress={() => removePendingSubgoal(index)} hitSlop={8}>
                <XCircle size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
      <View style={styles.subgoalInputRow}>
        <CornerDownRight size={18} color={colors.textMuted} />
        <TextInput
          value={newSubgoalText}
          onChangeText={setNewSubgoalText}
          placeholder="Agregar submeta"
          placeholderTextColor={colors.textMuted}
          style={styles.subgoalInput}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={() => void addSubgoal()}
          selectionColor={colors.primary}
        />
        <Pressable onPress={() => void addSubgoal()} disabled={!newSubgoalText.trim()} hitSlop={8}>
          <Plus size={20} color={newSubgoalText.trim() ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>
    </>
  )

  const renderActionBar = () => (
    <View style={styles.actionBar}>
      {isEditing && item && (
        <Pressable
          onPress={() => void handleToggleComplete()}
          disabled={!canComplete && !isCompleted}
          style={({ pressed }) => [
            styles.completeBtn,
            !canComplete && !isCompleted && styles.completeBtnDisabled,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.completeBtnText, !canComplete && !isCompleted && { color: colors.textMuted }]}>
            {isCompleted ? 'Marcar como no cumplida' : 'Marcar como cumplida'}
          </Text>
        </Pressable>
      )}
      {!fullScreen && (
        <Pressable
          onPress={() => void handleSave()}
          disabled={!canSave || isSaving}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginLeft: 'auto' })}
        >
          <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>Guardar</Text>
        </Pressable>
      )}
    </View>
  )

  const renderDeadlinePicker = () => (
    <>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} onPress={() => setDeadlinePickerOpen(false)} />
      <View style={styles.deadlineOverlay} pointerEvents="box-none">
        <View style={styles.deadlineCard} onStartShouldSetResponder={() => true}>
          <View style={styles.deadlineCardHeader}>
            <Text style={styles.deadlineCardTitle}>Fecha límite</Text>
            <Pressable onPress={() => setDeadlinePickerOpen(false)} hitSlop={12}>
              <X size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <MonthCalendar
            selectedDate={deadline}
            onSelectDate={(d) => { setDeadline(d); setDeadlinePickerOpen(false) }}
            colors={colors}
            accentColor={colors.accent}
          />
        </View>
      </View>
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
              <View style={[styles.fullScreenFooter, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
                {renderActionBar()}
              </View>
              {deadlinePickerOpen && renderDeadlinePicker()}
            </View>
          ) : (
            <>
              <Pressable
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlayAccent }]}
                onPress={deadlinePickerOpen ? () => setDeadlinePickerOpen(false) : onClose}
              />
              <View style={styles.sheetAnchor} pointerEvents="box-none">
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]} onStartShouldSetResponder={() => true}>
                  <View style={styles.dragHandle} />
                  {renderFormFields()}
                  {renderActionBar()}
                </View>
              </View>
              {deadlinePickerOpen && renderDeadlinePicker()}
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
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
    fullScreenFooter: {
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    mainInput: {
      flex: 1,
      fontSize: 18,
      color: colors.text,
      minHeight: 40,
      maxHeight: 100,
      padding: 0,
      outlineWidth: 0,
    },
    descriptionInput: {
      fontSize: 15,
      color: colors.textSecondary,
      minHeight: 24,
      maxHeight: 80,
      marginTop: 4,
      padding: 0,
      outlineWidth: 0,
    },
    optionsSeparator: { height: 1, backgroundColor: colors.border, marginTop: 4 },
    categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    categoryChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    subgoalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
    subgoalCheck: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.8, borderColor: colors.borderStrong, backgroundColor: 'transparent' },
    subgoalTitle: { fontSize: 15, color: colors.text, flex: 1 },
    subgoalTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    subgoalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    subgoalInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0, outlineWidth: 0 },
    actionBar: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    completeBtn: {
      flex: 1,
      backgroundColor: colors.primary + '22',
      borderRadius: 999,
      paddingVertical: 14,
      alignItems: 'center',
    },
    completeBtnDisabled: { backgroundColor: colors.border },
    completeBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    saveBtn: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingVertical: 6, paddingHorizontal: 4 },
    saveBtnDisabled: { color: colors.textMuted },
    deadlineOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
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
    deadlineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    deadlineCardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  })
