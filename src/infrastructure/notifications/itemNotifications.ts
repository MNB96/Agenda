import { Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import type { Item, ReminderConfig } from '../../domain/items'

const CHANNEL_MIGRATION_KEY = 'agenda:notification-channels-v3-alarm-stream'

const NOTIFICATION_PACKAGE = 'com.agenda.personal'

export const ITEM_COMPLETION_CATEGORY_ID = 'item_completion'
export const ITEM_COMPLETION_ACTION_ID = 'mark_item_complete'

export const registerItemNotificationActions = async (): Promise<void> => {
  await Notifications.setNotificationCategoryAsync(ITEM_COMPLETION_CATEGORY_ID, [
    {
      identifier: ITEM_COMPLETION_ACTION_ID,
      buttonTitle: 'Completar',
      options: { opensAppToForeground: false },
    },
  ])
}

export const openExactAlarmSettings = async (): Promise<void> => {
  if (Platform.OS !== 'android') return
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM')
  } catch {
    // Older Android versions (pre-12) don't have this screen; nothing to do.
  }
}

// Android's own channel settings already has a full ringtone picker, no need to build one in-app.
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

  // One-time migration: Android locks channel settings after creation, so old silent
  // channels must be deleted and recreated to pick up the sound.
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
  })
  await Notifications.setNotificationChannelAsync('alarmas', {
    name: 'Alarmas',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    enableLights: true,
    bypassDnd: true,
    // Sin 'sound' explícito: cae al sonido default del sistema sin disparar la validación de sonido custom.
    // ALARM stream, not NOTIFICATION — the latter is silenced by ringer mode (vibrate/silent).
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
  const resolvedDate = new Date(`${dateStr}T00:00:00`)
  resolvedDate.setHours(hours, minutes, 0, 0)
  return resolvedDate
}

const resolveReminderDate = (item: Item, reminder: ReminderConfig): Date | null => {
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
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  return `En ${hours}h ${minutes}min`
}

// Metas: aviso 7 días antes, 1 día antes, el día mismo y el día siguiente (vencida).
const scheduleGoalDeadlineNotifications = async (item: Item): Promise<string[]> => {
  if (!item.deadline) return []
  const deadlineAt = new Date(`${item.deadline}T09:00:00`)
  const weekBeforeAt = new Date(deadlineAt.getTime() - 7 * 24 * 60 * 60 * 1000)
  const dayBeforeAt = new Date(deadlineAt.getTime() - 24 * 60 * 60 * 1000)
  const overdueAt = new Date(deadlineAt.getTime() + 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    [
      { date: weekBeforeAt, body: '📅 Faltan 7 días' },
      { date: dayBeforeAt, body: '⚠️ Vence mañana' },
      { date: deadlineAt, body: '⚠️ Vence hoy' },
      { date: overdueAt, body: '🔴 Meta vencida' },
    ]
      .filter(({ date }) => date > new Date())
      .map(async ({ date, body }): Promise<string | null> => {
        try {
          return await Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body,
              data: { itemId: item.id },
              sound: true,
              color: '#FF3B30',
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
              ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
            },
          })
        } catch {
          return null
        }
      }),
  )

  return results.filter((id): id is string => id !== null)
}

// Toda tarea con deadline recibe aviso automático: día antes, mismo día, y vencida al día siguiente.
const scheduleDeadlineNotifications = async (item: Item): Promise<string[]> => {
  if (!item.deadline) return []

  const deadlineAt = new Date(`${item.deadline}T09:00:00`)
  const dayBeforeAt = new Date(deadlineAt.getTime() - 24 * 60 * 60 * 1000)
  const overdueAt = new Date(deadlineAt.getTime() + 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    [
      { date: dayBeforeAt, body: '⚠️ Vence mañana' },
      { date: deadlineAt, body: '⚠️ Vence hoy' },
      { date: overdueAt, body: '🔴 Vencida' },
    ]
      .filter(({ date }) => date > new Date())
      .map(async ({ date, body }): Promise<string | null> => {
        try {
          return await Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body,
              data: { itemId: item.id },
              sound: true,
              color: '#FF3B30',
              priority: Notifications.AndroidNotificationPriority.HIGH,
              categoryIdentifier: ITEM_COMPLETION_CATEGORY_ID,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
              ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
            },
          })
        } catch {
          return null
        }
      }),
  )

  return results.filter((id): id is string => id !== null)
}

export const scheduleItemNotifications = async (item: Item): Promise<string[]> => {
  if (item.type === 'goal') return scheduleGoalDeadlineNotifications(item)

  const deadlineIds = await scheduleDeadlineNotifications(item)
  const reminders = item.reminderConfig
  if (!reminders?.length) {
    // Sin recordatorios configurados: notificar a la hora del ítem. Si es una tarea de
    // solo fecha límite (sin fecha/hora agendada), ya quedó cubierta arriba.
    if (!item.startDate) return deadlineIds
    const base = resolveBaseDate(item)
    if (!base || base <= new Date()) return deadlineIds
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.description ?? undefined,
          data: { itemId: item.id },
          sound: true,
          categoryIdentifier: ITEM_COMPLETION_CATEGORY_ID,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: base,
          ...(Platform.OS === 'android' ? { channelId: 'recordatorios' } : {}),
        },
      })
      return [...deadlineIds, id]
    } catch {
      return deadlineIds
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
            sticky: r.persistent ?? false,
            categoryIdentifier: ITEM_COMPLETION_CATEGORY_ID,
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

  return [...deadlineIds, ...results.filter((id): id is string => id !== null)]
}

export const cancelItemNotifications = async (
  item: { notificationIds?: readonly string[] },
): Promise<void> => {
  const toCancel = item.notificationIds ?? []
  await Promise.all(
    toCancel.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id)
      } catch {}
    }),
  )
  // cancelScheduledNotificationAsync only removes future-scheduled ones; already-delivered
  // sticky notifications stay in the tray until explicitly dismissed.
  if (toCancel.length > 0) {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync()
      const cancelSet = new Set(toCancel)
      await Promise.all(
        presented
          .filter(n => cancelSet.has(n.request.identifier))
          .map(n => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {})),
      )
    } catch {}
  }
}

export const notifyCalendarDeleteFailed = async (taskTitle: string): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'No se pudo eliminar del calendario',
        body: `"${taskTitle}" no se pudo borrar de Google Calendar`,
        sound: true,
      },
      trigger: null,
    })
  } catch {}
}
