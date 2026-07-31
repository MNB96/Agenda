import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { MainTabs } from './src/mobile/navigation/MainTabs'
import { QuickAddModal } from './src/mobile/modals/QuickAddModal'
import { SettingsModal } from './src/mobile/modals/SettingsModal'
import { ItemEditorModal } from './src/mobile/modals/ItemEditorModal'
import { useGoogleSessionLifecycleMobile } from './src/mobile/useGoogleSessionLifecycleMobile'

export default function App() {
  const queryClient = useMemo(() => new QueryClient(), [])
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined)

  useGoogleSessionLifecycleMobile()

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <MainTabs
            onOpenQuickAdd={() => setQuickAddOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenItemEditor={(itemId) => setEditingItemId(itemId)}
          />
        </NavigationContainer>

        <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <ItemEditorModal
          itemId={editingItemId}
          open={Boolean(editingItemId)}
          onClose={() => setEditingItemId(undefined)}
        />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
