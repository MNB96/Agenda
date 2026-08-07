import { useMemo, useRef } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Trash2 } from 'lucide-react-native'
import { ItemCard } from './ItemCard'
import type { Item } from '../../domain/items'
import { useAppTheme } from '../theme/useAppTheme'
import type { ThemeTokens } from '../theme/tokens'

interface SwipeableItemCardProps {
  item: Item
  overdueLabel?: string
  overdueDeadlineLabel?: string
  subtasks?: Item[]
  onToggle: (item: Item) => Promise<void>
  onToggleSubtask?: (subtask: Item) => Promise<void>
  onOpen: () => void
  onDelete: (item: Item) => Promise<void>
  deleteConfirmTitle: string
  deleteConfirmMessage: string
}

export const SwipeableItemCard = ({
  item,
  overdueLabel,
  overdueDeadlineLabel,
  subtasks,
  onToggle,
  onToggleSubtask,
  onOpen,
  onDelete,
  deleteConfirmTitle,
  deleteConfirmMessage,
}: SwipeableItemCardProps) => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const swipeableRef = useRef<Swipeable>(null)

  const handleSwipeOpen = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      if (item.status === 'completed') return
      void (async () => {
        try {
          await onToggle(item)
        } catch (error) {
          Alert.alert('No se pudo completar', error instanceof Error ? error.message : 'Intentá de nuevo.')
        }
      })()
      return
    }

    Alert.alert(deleteConfirmTitle, deleteConfirmMessage, [
      { text: 'Cancelar', style: 'cancel', onPress: () => swipeableRef.current?.close() },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => void onDelete(item),
      },
    ])
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={80}
      leftThreshold={80}
      renderRightActions={
        item.status === 'completed'
          ? undefined
          : () => (
              <View style={styles.completeAction}>
                <Text style={styles.completeActionText}>✓</Text>
              </View>
            )
      }
      renderLeftActions={() => (
        <View style={styles.deleteAction}>
          <Trash2 size={22} color="#FFFFFF" />
        </View>
      )}
      onSwipeableOpen={handleSwipeOpen}
    >
      <ItemCard
        item={item}
        overdueDeadlineLabel={overdueDeadlineLabel}
        overdueLabel={overdueLabel}
        subtasks={subtasks}
        onToggle={onToggle}
        onToggleSubtask={onToggleSubtask}
        onOpen={onOpen}
      />
    </Swipeable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    completeAction: {
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      width: 72,
    },
    completeActionText: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
    },
    deleteAction: {
      backgroundColor: colors.danger,
      justifyContent: 'center',
      alignItems: 'center',
      width: 72,
    },
  })
