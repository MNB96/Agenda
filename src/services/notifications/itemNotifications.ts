import { Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import type { Item, ReminderConfig } from '../../domain/items/types'

const CHANNEL_MIGRATION_KEY = 'agenda:notification-channels-v3-alarm-stream'

export const NOTIFICATION_PACKAGE = 'com.agenda.personal'

export const openExactAlarmSettings = async (): Promise<void> => {
  if (Platform.OS !== 'android') return
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')
  } catch {
    // Older Android versions (pre-12) don't have this screen; nothing to do.
  }
}

// Android 8+ controls sound/vibration per notification channel, and the system already
// ships a full ringtone picker for it — no need to build a custom one in-app. The app-level
// settings screen lists both channels (Recordatorios, Alarmas), so one entry point covers both.
export const openNotificationSoundSettings = async (): Promise<void> => {
  if (Platform.OS !== 'android') return
  try {
    await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: NOTIFICATION_PACKAGE },
    ])
  } catch {}
}

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

  // One-time migration: channels created before this fix have no sound configured, and
  // Android locks channel settings after creation — recreating is the only way to fix
  // existing installs. Only runs once, so it won't clobber a sound the user later picks
  // themselves via openChannelSoundSettings.
  const migrated = await AsyncStorage.getItem(CHANNEL_MIGRATION_KEY)
  if (!migrated) {
    try {
      await Notifications.deleteNotificationChannelAsync('recordatorios')
      await Notifications.deleteNotificationChannelAsync('alarmas')
    } catch {
      // Channels may not exist yet on a fresh install; nothing to clean up.
    }
    await AsyncStorage.setItem(CHANNEL_MIGRATION_KEY, '1')
  }

  await Notifications.setNotificationChannelAsync('recordatorios', {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    sound: 'default',
  })
  await Notifications.setNotificationChannelAsync('alarmas', {
    name: 'Alarmas',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    enableLights: true,
    bypassDnd: true,
    sound: 'default',
    // Use the ALARM audio stream, not NOTIFICATION: the notification stream is silenced
    // by the phone's ringer mode (vibrate/silent), which is exactly why a plain
    // notification sound never played. The alarm stream ignores that, like a real alarm clock.
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false,
      },
    },
  })
}

export const requestNotificationPermissions = async (): Promise<boolean> => {
  await initNotificationChannel()
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  const { status } = await Notifications.requestPermissionsAsync()
  const granted = status === 'granted'
  if (granted) {
    // First time granting notifications: also surface the exact-alarm toggle,
    // otherwise Android may silently delay or drop precisely-timed reminders.
    void openExactAlarmSettings()
  }
  return granted
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
