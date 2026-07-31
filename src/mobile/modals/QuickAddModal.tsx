import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { parseQuickInput } from '../../services/parser/quickInputParser'
import { useItems } from '../../features/items/useItems'
import type { ItemType } from '../../domain/items/types'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface QuickAddModalProps {
  open: boolean
  onClose: () => void
}

export const QuickAddModal = ({ open, onClose }: QuickAddModalProps) => {
  const { createItem, isSaving } = useItems()
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseQuickInput(text || ''), [text])

  const [title, setTitle] = useState('')
  const [type, setType] = useState<ItemType>('task')

  useEffect(() => {
    setTitle(parsed.inferred.title ?? '')
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
    setType('task')
  }

  const onSave = async () => {
    if (!title.trim()) {
      return
    }

    await createItem({
      title,
      type,
      startDate: parsed.inferred.startDate,
      startTime: parsed.inferred.startTime,
      deadline: parsed.inferred.deadline,
      dateWindow: parsed.inferred.dateWindow,
      location: parsed.inferred.location,
      goalConfig: type === 'goal' ? parsed.inferred.goalConfig : undefined,
    })

    reset()
    onClose()
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Alta rapida</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="¿Que queres agregar?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Detectado: {parsed.detectedType}</Text>
            <Text style={styles.previewTitle}>{title || 'Sin titulo'}</Text>
            <Text style={styles.previewMeta}>
              {parsed.hints.join(' · ') || 'Completa el texto para inferir fecha, hora, deadline o ventana.'}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} disabled={isSaving} onPress={() => void onSave()}>
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
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
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
  previewTitle: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 2 },
  previewMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
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
