import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { Item, ReminderConfig } from '../../domain/items/types'

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
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
  })
  await Notifications.setNotificationChannelAsync('alarmas', {
    name: 'Alarmas',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    enableLights: true,
    bypassDnd: true,
  })
}

export const requestNotificationPermissions = async (): Promise<boolean> => {
  await initNotificationChannel()
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

const resolveBaseDate = (item: Item): Date | null => {
  const dateStr = item.startDate ?? item.deadline
  if (!dateStr) return null
  const [hours, minutes] = item.startTime
    ? item.startTime.split(':').map(Number)
    : [9, 0]
  const d = new Date(`${dateStr}T00:00:00`)
  d.setHours(hours, minutes, 0, 0)
  return d
}

const resolveReminderDate = (item: Item, reminder: ReminderConfig): Date | null => {
  if (reminder.mode === 'absolute' && reminder.dateTime) {
    const d = new Date(reminder.dateTime)
    return d > new Date() ? d : null
  }
  const base = resolveBaseDate(item)
  if (!base) return null
  const notifyAt = new Date(base.getTime() - (reminder.minutesBefore ?? 0) * 60_000)
  return notifyAt > new Date() ? notifyAt : null
}

const formatReminderBody = (reminder: ReminderConfig): string => {
  const mins = reminder.minutesBefore
  if (!mins) return 'Es ahora'
  if (mins < 60) return `En ${mins} minutos`
  if (mins === 60) return 'En 1 hora'
  if (mins % 60 === 0) return `En ${mins / 60} horas`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `En ${h}h ${m}min`
}

export const scheduleItemNotifications = async (item: Item): Promise<string[]> => {
  const reminders = item.reminderConfig

  if (!reminders?.length) {
    // Sin recordatorios configurados: notificar a la hora del ítem
    const base = resolveBaseDate(item)
    if (!base || base <= new Date()) return []
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
          date: base,
          ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
        },
      })
      return [id]
    } catch {
      return []
    }
  }

  const results = await Promise.all(
    reminders.map(async (r): Promise<string | null> => {
      const date = resolveReminderDate(item, r)
      if (!date) return null
      try {
        return await Notifications.scheduleNotificationAsync({
          content: {
            title: item.title,
            body: formatReminderBody(r),
            data: { itemId: item.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            ...(Platform.OS === 'android'
              ? { channelId: r.alarmType === 'alarm' ? 'alarmas' : 'recordatorios' }
              : {}),
          },
        })
      } catch {
        return null
      }
    }),
  )

  return results.filter((id): id is string => id !== null)
}

export const cancelItemNotifications = async (
  item: { notificationId?: string; notificationIds?: string[] },
): Promise<void> => {
  const toCancel = [
    ...(item.notificationIds ?? []),
    ...(item.notificationId ? [item.notificationId] : []),
  ]
  await Promise.all(
    toCancel.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id)
      } catch {}
    }),
  )
}

export const notifyCalendarDeleteFailed = async (taskTitle: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'No se pudo eliminar del calendario',
        body: `"${taskTitle}" no se pudo borrar de Google Calendar`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 3000),
      },
    })
  } catch {}
}
