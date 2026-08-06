import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { StatusBar, useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useSettings } from './src/application/settings/useSettings'
import { MainTabs } from './src/mobile/navigation/MainTabs'
import { QuickAddSheet } from './src/mobile/modals/QuickAddSheet'
import { AddGoalSheet } from './src/mobile/modals/AddGoalSheet'
import { ItemDetailModal } from './src/mobile/modals/ItemDetailModal'
import { SettingsModal } from './src/mobile/modals/SettingsModal'
import { useGoogleSessionLifecycleMobile } from './src/mobile/useGoogleSessionLifecycleMobile'
import { useAppTheme } from './src/mobile/theme/useAppTheme'
import { FloatingAddButton } from './src/mobile/components/FloatingAddButton'
import { requestNotificationPermissions } from './src/infrastructure/notifications/itemNotifications'
import { useCalendarDeleteQueue } from './src/application/calendar/useCalendarDeleteQueue'
import { useCalendarSyncRecovery } from './src/application/calendar/useCalendarSyncRecovery'
import { useAutoPurgeCompleted } from './src/application/items/useAutoPurgeCompleted'
import { useAutoRegenerateOverdueRecurring } from './src/application/items/useAutoRegenerateOverdueRecurring'
import { useMarkOverdueGoals } from './src/application/items/useMarkOverdueGoals'
import { useGoogleAuthStore } from './src/state/googleAuthStore'

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const AppShell = () => {
  const colorScheme = useColorScheme()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined)
  const [editingGoalId, setEditingGoalId] = useState<string | undefined>(undefined)
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
      setQuickAddOpen={setQuickAddOpen}
      setSettingsOpen={setSettingsOpen}
      setEditingItemId={setEditingItemId}
      setEditingGoalId={setEditingGoalId}
    />
  )
}

interface AppShellInnerProps {
  quickAddOpen: boolean
  settingsOpen: boolean
  editingItemId?: string
  editingGoalId?: string
  setQuickAddOpen: (value: boolean) => void
  setSettingsOpen: (value: boolean) => void
  setEditingItemId: (value: string | undefined) => void
  setEditingGoalId: (value: string | undefined) => void
}

const AppShellInner = ({
  quickAddOpen,
  settingsOpen,
  editingItemId,
  editingGoalId,
  setQuickAddOpen,
  setSettingsOpen,
  setEditingItemId,
  setEditingGoalId,
}: AppShellInnerProps) => {
  const { colors, isDark } = useAppTheme()
  const navigationRef = useNavigationContainerRef()
  const [activeTab, setActiveTab] = useState('Tareas')

  useGoogleSessionLifecycleMobile()

  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  useCalendarDeleteQueue(accessToken ?? null, markUnauthorized)
  useCalendarSyncRecovery(accessToken ?? null, markUnauthorized)
  useAutoPurgeCompleted()
  useAutoRegenerateOverdueRecurring()
  useMarkOverdueGoals()

  useEffect(() => {
    requestNotificationPermissions()
  }, [])

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

  const isAnyModalOpen = quickAddOpen || settingsOpen || Boolean(editingItemId) || Boolean(editingGoalId)

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
        />
      </NavigationContainer>

      {!isAnyModalOpen ? <FloatingAddButton onPress={() => setQuickAddOpen(true)} /> : null}

      {/* Metas siempre crea goals, todo el resto siempre crea tasks (sin inferencia por NLP). */}
      <QuickAddSheet
        open={quickAddOpen && activeTab !== 'Metas'}
        onClose={() => setQuickAddOpen(false)}
      />
      <AddGoalSheet
        open={(quickAddOpen && activeTab === 'Metas') || Boolean(editingGoalId)}
        goalId={editingGoalId}
        onClose={() => { setQuickAddOpen(false); setEditingGoalId(undefined) }}
      />
      <ItemDetailModal
        itemId={editingItemId}
        onClose={() => setEditingItemId(undefined)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
