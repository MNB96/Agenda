import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { searchPlaceSuggestions, type PlaceSuggestion } from '../../services/googlePlaces'
import type { ItemType } from '../../domain/items/types'
import { useItems } from '../../features/items/useItems'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface ItemEditorModalProps {
  open: boolean
  itemId?: string
  onClose: () => void
}

const nextType = (current: ItemType): ItemType => {
  const order: ItemType[] = ['task', 'event', 'deadline', 'goal', 'date_window', 'important_date', 'reminder']
  const index = order.indexOf(current)
  return order[(index + 1) % order.length]
}

export const ItemEditorModal = ({ open, itemId, onClose }: ItemEditorModalProps) => {
  const { items, updateItem, removeItem } = useItems()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const item = items.find((entry) => entry.id === itemId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [deadline, setDeadline] = useState('')
  const [location, setLocation] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([])
  const resolvedLocationRef = useRef('')
  const [type, setType] = useState<ItemType>('task')
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState(false)

  useEffect(() => {
    if (!item) {
      return
    }
    setTitle(item.title)
    setDescription(item.description ?? '')
    setStartDate(item.startDate ?? '')
    setStartTime(item.startTime ?? '')
    setDeadline(item.deadline ?? '')
    setLocation(item.location ?? '')
    resolvedLocationRef.current = item.location ?? ''
    setLocationSuggestions([])
    setType(item.type)
    setSyncToGoogleCalendar(Boolean(item.syncToGoogleCalendar))
  }, [item])

  useEffect(() => {
    const q = location.trim()
    if (!q || q === resolvedLocationRef.current) {
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
  }, [location])

  if (!item) {
    return null
  }

  const onSave = async () => {
    await updateItem({
      id: item.id,
      patch: {
        title,
        description: description || undefined,
        startDate: startDate || undefined,
        startTime: startTime || undefined,
        deadline: deadline || undefined,
        location: location || undefined,
        type,
        syncToGoogleCalendar,
      },
    })
    onClose()
  }

  const onDelete = async () => {
    await removeItem(item)
    onClose()
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Editar item</Text>

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
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            style={styles.input}
            placeholder="Fecha (yyyy-mm-dd)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            value={startTime}
            onChangeText={setStartTime}
            style={styles.input}
            placeholder="Hora (HH:mm)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            value={deadline}
            onChangeText={setDeadline}
            style={styles.input}
            placeholder="Deadline (yyyy-mm-dd)"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            value={location}
            onChangeText={(text) => {
              setLocation(text)
              if (!text.trim()) resolvedLocationRef.current = ''
            }}
            style={styles.input}
            placeholder="Dirección (opcional)"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={() => setLocationSuggestions([])}
          />
          {locationSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {locationSuggestions.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={({ pressed }) => [styles.suggestionItem, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    setLocation(s.description)
                    resolvedLocationRef.current = s.description
                    setLocationSuggestions([])
                    Keyboard.dismiss()
                  }}
                >
                  <Text style={styles.suggestionText} numberOfLines={2}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.typeButton} onPress={() => setType((current) => nextType(current))}>
            <Text style={styles.typeButtonText}>Tipo: {type}</Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Sincronizar con Google Calendar</Text>
            <Switch value={syncToGoogleCalendar} onValueChange={setSyncToGoogleCalendar} />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.deleteButton} onPress={() => void onDelete()}>
              <Text style={styles.deleteButtonText}>Eliminar</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void onSave()}>
              <Text style={styles.primaryButtonText}>Guardar</Text>
            </Pressable>
          </View>
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
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: -4,
    backgroundColor: colors.surfaceSecondary,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
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
    marginTop: 4,
  },
  switchLabel: { color: colors.textSecondary, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  deleteButton: {
    backgroundColor: colors.accentStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
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
