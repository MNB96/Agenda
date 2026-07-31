import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { CalendarDays, Plus, SunMedium } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
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

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontSize: 22, fontWeight: '700', color: colors.text },
        headerTintColor: colors.text,
        tabBarStyle: {
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Hoy"
        options={{
          tabBarIcon: ({ color, size }) => <SunMedium color={color} size={size} />,
          headerRight: () => (
            <Pressable
              onPress={onOpenSettings}
              style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <CalendarDays color={colors.textSecondary} size={18} />
            </Pressable>
          ),
        }}
      >
        {() => <TodayScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>
      <Tab.Screen
        name="Agenda"
        options={{
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
          headerRight: () => (
            <Pressable
              onPress={onOpenQuickAdd}
              style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Plus color={colors.textSecondary} size={18} />
            </Pressable>
          ),
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
