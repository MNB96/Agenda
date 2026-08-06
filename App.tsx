import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { StatusBar, useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useSettings } from './src/application/settings/useSettings'
import { MainTabs } from './src/mobile/navigation/MainTabs'
import { QuickAddSheet } from './src/mobile/modals/QuickAddSheet'
import { ItemDetailModal } from './src/mobile/modals/ItemDetailModal'
import { SettingsModal } from './src/mobile/modals/SettingsModal'
import { useGoogleSessionLifecycleMobile } from './src/mobile/useGoogleSessionLifecycleMobile'
import { useAppTheme } from './src/mobile/theme/useAppTheme'
import { FloatingAddButton } from './src/mobile/components/FloatingAddButton'
import { requestNotificationPermissions } from './src/infrastructure/notifications/itemNotifications'
import { useCalendarDeleteQueue } from './src/application/calendar/useCalendarDeleteQueue'
import { useCalendarSyncRecovery } from './src/application/calendar/useCalendarSyncRecovery'
import { useAutoArchiveCompleted } from './src/application/items/useAutoArchiveCompleted'
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
  const settingsQuery = useSettings()

  if (!settingsQuery.data) {
    return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0E191D' : '#FFFFFF' }} />
  }

  return (
    <AppShellInner
      quickAddOpen={quickAddOpen}
      settingsOpen={settingsOpen}
      editingItemId={editingItemId}
      setQuickAddOpen={setQuickAddOpen}
      setSettingsOpen={setSettingsOpen}
      setEditingItemId={setEditingItemId}
    />
  )
}

interface AppShellInnerProps {
  quickAddOpen: boolean
  settingsOpen: boolean
  editingItemId?: string
  setQuickAddOpen: (value: boolean) => void
  setSettingsOpen: (value: boolean) => void
  setEditingItemId: (value: string | undefined) => void
}

const AppShellInner = ({
  quickAddOpen,
  settingsOpen,
  editingItemId,
  setQuickAddOpen,
  setSettingsOpen,
  setEditingItemId,
}: AppShellInnerProps) => {
  const { colors, isDark } = useAppTheme()

  useGoogleSessionLifecycleMobile()

  const { accessToken, markUnauthorized } = useGoogleAuthStore()
  useCalendarDeleteQueue(accessToken ?? null, markUnauthorized)
  useCalendarSyncRecovery(accessToken ?? null, markUnauthorized)
  useAutoArchiveCompleted()

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

  const isAnyModalOpen = quickAddOpen || settingsOpen || Boolean(editingItemId)

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationContainer theme={navTheme}>
        <MainTabs
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenItemEditor={(itemId) => setEditingItemId(itemId)}
        />
      </NavigationContainer>

      {!isAnyModalOpen ? <FloatingAddButton onPress={() => setQuickAddOpen(true)} /> : null}

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
      <ItemDetailModal
        itemId={editingItemId}
        onClose={() => setEditingItemId(undefined)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
