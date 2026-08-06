import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GraduationCap, ListTodo, Settings, Target } from 'lucide-react-native'
import { Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { StudiesScreen } from '../screens/StudiesScreen'
import { TaskScreen } from '../screens/TaskScreen'
import { GoalsScreen } from '../screens/GoalsScreen'
import { useAppTheme } from '../theme/useAppTheme'

const Tab = createBottomTabNavigator()

export const TAB_BAR_HEIGHT = 70

interface MainTabsProps {
  onOpenSettings: () => void
  onOpenItemEditor: (itemId: string) => void
  onOpenGoalEditor: (itemId: string) => void
}

export const MainTabs = ({ onOpenSettings, onOpenItemEditor, onOpenGoalEditor }: MainTabsProps) => {
  const { colors } = useAppTheme()
  const { bottom } = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 28, fontWeight: '800', color: colors.text },
        headerTintColor: colors.text,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + bottom,
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
        {() => <TaskScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>
      <Tab.Screen
        name="Facultad"
        options={{
          tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} />,
        }}
      >
        {() => <StudiesScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>
      <Tab.Screen
        name="Metas"
        options={{
          headerTitle: `Metas ${new Date().getFullYear()}`,
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      >
        {() => <GoalsScreen onOpenGoalEditor={onOpenGoalEditor} />}
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
