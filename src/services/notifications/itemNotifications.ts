import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { Item } from '../../domain/items/types'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export const initNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('recordatorios', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
  })
}

export const requestNotificationPermissions = async (): Promise<boolean> => {
  await initNotificationChannel()
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

const resolveNotificationDate = (item: Item): Date | null => {
  const dateStr = item.startDate ?? item.deadline
  if (!dateStr) return null
  const [hours, minutes] = item.startTime
    ? item.startTime.split(':').map(Number)
    : [9, 0]
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(hours, minutes, 0, 0)
  if (d <= new Date()) return null
  return d
}

export const scheduleItemNotification = async (item: Item): Promise<string | null> => {
  const date = resolveNotificationDate(item)
  if (!date) return null
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.description ?? undefined,
        data: { itemId: item.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    })
    return id
  } catch {
    return null
  }
}

export const cancelItemNotification = async (notificationId: string | undefined): Promise<void> => {
  if (!notificationId) return
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId)
  } catch {}
}
