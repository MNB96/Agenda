import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GraduationCap, ListTodo, Settings } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AgendaScreen } from '../screens/AgendaScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { useAppTheme } from '../theme/useAppTheme'

const Tab = createBottomTabNavigator()

interface MainTabsProps {
  onOpenQuickAdd: () => void
  onOpenSettings: () => void
  onOpenItemEditor: (itemId: string) => void
}

export const MainTabs = ({ onOpenQuickAdd, onOpenSettings, onOpenItemEditor }: MainTabsProps) => {
  const { colors } = useAppTheme()
  const { bottom } = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 22, fontWeight: '700', color: colors.text },
        headerTintColor: colors.text,
        tabBarStyle: {
          height: 62 + bottom,
          paddingTop: 8,
          paddingBottom: 8 + bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Tareas"
        options={{
          headerTitle: format(new Date(), "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, c => c.toUpperCase()),
          tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} />,
          headerRight: () => (
            <Pressable
              onPress={onOpenSettings}
              style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Settings color={colors.textSecondary} size={18} />
            </Pressable>
          ),
        }}
      >
        {() => <TodayScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>
      <Tab.Screen
        name="Facultad"
        options={{
          tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} />,
        }}
      >
        {() => <AgendaScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  headerButton: {
    marginRight: 14,
    borderWidth: 1,
    borderRadius: 999,
    padding: 8,
  },
})
