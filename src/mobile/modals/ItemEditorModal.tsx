import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import type { ItemType } from '../../domain/items/types'
import { useItems } from '../../features/items/useItems'

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
  const item = items.find((entry) => entry.id === itemId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [deadline, setDeadline] = useState('')
  const [location, setLocation] = useState('')
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
    setType(item.type)
    setSyncToGoogleCalendar(Boolean(item.syncToGoogleCalendar))
  }, [item])

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

          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Titulo" />
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.multiline]}
            multiline
            placeholder="Descripcion"
          />
          <TextInput value={startDate} onChangeText={setStartDate} style={styles.input} placeholder="Fecha (yyyy-mm-dd)" />
          <TextInput value={startTime} onChangeText={setStartTime} style={styles.input} placeholder="Hora (HH:mm)" />
          <TextInput value={deadline} onChangeText={setDeadline} style={styles.input} placeholder="Deadline (yyyy-mm-dd)" />
          <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="Ubicacion" />

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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  typeButton: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#faf6f0',
  },
  typeButtonText: { color: '#57534e', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  switchLabel: { color: '#44403c', fontSize: 13 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteButtonText: { color: '#9f1239', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#e7ddd0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: '#57534e', fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#9a3412',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
})
