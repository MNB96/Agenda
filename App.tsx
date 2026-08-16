import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { StatusBar, useColorScheme, View } from 'react-native'
import * as Notifications from 'expo-notifications'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSettings } from './src/application/settings/useSettings'
import { MainTabs } from './src/mobile/navigation/MainTabs'
import { QuickAddSheet } from './src/mobile/modals/QuickAddSheet'
import { AddGoalSheet } from './src/mobile/modals/AddGoalSheet'
import { AddHabitSheet } from './src/mobile/modals/AddHabitSheet'
import { ItemDetailModal } from './src/mobile/modals/ItemDetailModal'
import { SettingsModal } from './src/mobile/modals/SettingsModal'
import { useGoogleSessionLifecycleMobile } from './src/mobile/useGoogleSessionLifecycleMobile'
import { useAppTheme } from './src/mobile/theme/useAppTheme'
import { FloatingAddButton } from './src/mobile/components/FloatingAddButton'
import { requestNotificationPermissions, ITEM_COMPLETION_ACTION_ID, registerItemNotificationActions, cancelItemNotifications } from './src/infrastructure/notifications/itemNotifications'
import { registerHabitNotificationActions } from './src/infrastructure/notifications/habitNotifications'
import { useCalendarDeleteQueue } from './src/application/calendar/useCalendarDeleteQueue'
import { useCalendarSyncRecovery } from './src/application/calendar/useCalendarSyncRecovery'
import { useAutoPurgeCompleted } from './src/application/items/useAutoPurgeCompleted'
import { useAutoRegenerateOverdueRecurring } from './src/application/items/useAutoRegenerateOverdueRecurring'
import { useAutoCompleteReminderOnly } from './src/application/items/useAutoCompleteReminderOnly'
import { useMarkOverdueGoals } from './src/application/items/useMarkOverdueGoals'
import { useGoogleAuthStore } from './src/state/googleAuthStore'
import { itemRepository } from './src/app/container'
import { Item } from './src/domain/items'

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const AppShell = () => {
  const colorScheme = useColorScheme()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined)
  const [editingGoalId, setEditingGoalId] = useState<string | undefined>(undefined)
  const [editingHabitId, setEditingHabitId] = useState<string | undefined>(undefined)
  const settingsQuery = useSettings()

  if (!settingsQuery.data) {
    return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0E191D' : '#FFFFFF' }} />
  }

  return (
    <AppShellInner
      quickAddOpen={quickAddOpen}
      settingsOpen={settingsOpen}
      editingItemId={editingItemId}
      editingGoalId={editingGoalId}
      editingHabitId={editingHabitId}
      setQuickAddOpen={setQuickAddOpen}
      setSettingsOpen={setSettingsOpen}
      setEditingItemId={setEditingItemId}
      setEditingGoalId={setEditingGoalId}
      setEditingHabitId={setEditingHabitId}
    />
  )
}

interface AppShellInnerProps {
  quickAddOpen: boolean
  settingsOpen: boolean
  editingItemId?: string
  editingGoalId?: string
  editingHabitId?: string
  setQuickAddOpen: (value: boolean) => void
  setSettingsOpen: (value: boolean) => void
  setEditingItemId: (value: string | undefined) => void
  setEditingGoalId: (value: string | undefined) => void
  setEditingHabitId: (value: string | undefined) => void
}

const AppShellInner = ({
  quickAddOpen,
  settingsOpen,
  editingItemId,
  editingGoalId,
  editingHabitId,
  setQuickAddOpen,
  setSettingsOpen,
  setEditingItemId,
  setEditingGoalId,
  setEditingHabitId,
}: AppShellInnerProps) => {
  const { colors, isDark } = useAppTheme()
  const navigationRef = useNavigationContainerRef()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('Tareas')

  useGoogleSessionLifecycleMobile()

  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  useCalendarDeleteQueue(accessToken ?? null, markUnauthorized)
  useCalendarSyncRecovery(accessToken ?? null, markUnauthorized)
  useAutoPurgeCompleted()
  useAutoRegenerateOverdueRecurring()
  useAutoCompleteReminderOnly()
  useMarkOverdueGoals()

  useEffect(() => {
    void requestNotificationPermissions()
    void registerHabitNotificationActions()
    void registerItemNotificationActions()

    // IDs ya procesados para evitar duplicados entre el listener y getLastNotificationResponseAsync.
    const processed = new Set<string>()

    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const actionId = response.actionIdentifier
      const itemId = response.notification.request.content.data?.itemId as string | undefined
      const notifId = response.notification.request.identifier

      // Abrir la tarea al tocar el cuerpo de la notificación.
      if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER && itemId) {
        setEditingItemId(itemId)
        return
      }

      // Completar tarea desde la bandeja sin abrir la app.
      if (actionId === ITEM_COMPLETION_ACTION_ID && itemId) {
        if (processed.has(notifId)) return
        processed.add(notifId)
        setTimeout(() => processed.delete(notifId), 30_000)

        // Descartar la notificación primero; si la completar falla igual desaparece de la bandeja.
        void Notifications.dismissNotificationAsync(notifId).catch(() => {})

        try {
          const item = await itemRepository.getById(itemId)
          if (!item || item.status === 'completed') return
          const subtasks = await itemRepository.getByParentIds([item.id])
          const completed = Item.complete(item, subtasks)
          await cancelItemNotifications(item)
          const linked = Item.linkNotifications(completed, [])
          await itemRepository.save(linked)
          queryClient.invalidateQueries({ queryKey: ['items'] })
        } catch {}
      }
    }

    // Caso app cerrada: si el usuario tocó la acción mientras la app no estaba activa,
    // el listener no la vio — getLastNotificationResponseAsync la recupera al montar.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handleResponse(response)
    })

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response)
    })

    return () => subscription.remove()
  }, [queryClient, setEditingItemId])

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.surface,
        primary: colors.primary,
        text: colors.text,
        border: colors.border,
        notification: colors.accentStrong,
      },
    }),
    [colors],
  )

  const isAnyModalOpen = quickAddOpen || settingsOpen || Boolean(editingItemId) || Boolean(editingGoalId) || Boolean(editingHabitId)

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onReady={() => setActiveTab((navigationRef.getCurrentRoute() as { name?: string } | undefined)?.name ?? 'Tareas')}
        onStateChange={() => setActiveTab((navigationRef.getCurrentRoute() as { name?: string } | undefined)?.name ?? 'Tareas')}
      >
        <MainTabs
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenItemEditor={(itemId) => setEditingItemId(itemId)}
          onOpenGoalEditor={(itemId) => setEditingGoalId(itemId)}
          onOpenHabitEditor={(habitId) => setEditingHabitId(habitId)}
        />
      </NavigationContainer>

      {!isAnyModalOpen ? <FloatingAddButton onPress={() => setQuickAddOpen(true)} /> : null}

      {/* Metas siempre crea goals, Hábitos siempre crea hábitos, el resto siempre crea tasks (sin inferencia por NLP). */}
      <QuickAddSheet
        open={quickAddOpen && activeTab !== 'Metas' && activeTab !== 'Hábitos'}
        onClose={() => setQuickAddOpen(false)}
      />
      <AddGoalSheet
        open={(quickAddOpen && activeTab === 'Metas') || Boolean(editingGoalId)}
        goalId={editingGoalId}
        onClose={() => { setQuickAddOpen(false); setEditingGoalId(undefined) }}
      />
      <AddHabitSheet
        open={(quickAddOpen && activeTab === 'Hábitos') || Boolean(editingHabitId)}
        habitId={editingHabitId}
        onClose={() => { setQuickAddOpen(false); setEditingHabitId(undefined) }}
      />
      <ItemDetailModal
        itemId={editingItemId}
        onClose={() => setEditingItemId(undefined)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
