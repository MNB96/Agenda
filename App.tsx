import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { useColorScheme, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useSettings } from './src/features/settings/useSettings'
import { MainTabs } from './src/mobile/navigation/MainTabs'
import { QuickAddSheet } from './src/mobile/modals/QuickAddSheet'
import { ItemDetailModal } from './src/mobile/modals/ItemDetailModal'
import { SettingsModal } from './src/mobile/modals/SettingsModal'
import { useGoogleSessionLifecycleMobile } from './src/mobile/useGoogleSessionLifecycleMobile'
import { ThemePreferenceProvider } from './src/mobile/theme/ThemePreferenceContext'
import { useAppTheme } from './src/mobile/theme/useAppTheme'
import { FloatingAddButton } from './src/mobile/components/FloatingAddButton'
import { requestNotificationPermissions } from './src/services/notifications/itemNotifications'

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
  const preference = settingsQuery.data?.themePreference ?? 'system'

  if (!settingsQuery.data) {
    return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0E191D' : '#FFFFFF' }} />
  }

  return (
    <ThemePreferenceProvider preference={preference}>
      <AppShellInner
        quickAddOpen={quickAddOpen}
        settingsOpen={settingsOpen}
        editingItemId={editingItemId}
        setQuickAddOpen={setQuickAddOpen}
        setSettingsOpen={setSettingsOpen}
        setEditingItemId={setEditingItemId}
      />
    </ThemePreferenceProvider>
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
  const { colors } = useAppTheme()

  useGoogleSessionLifecycleMobile()

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
      <NavigationContainer theme={navTheme}>
        <MainTabs
          onOpenQuickAdd={() => setQuickAddOpen(true)}
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
        open={Boolean(editingItemId)}
        onClose={() => setEditingItemId(undefined)}
        itemId={editingItemId ?? ''}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
