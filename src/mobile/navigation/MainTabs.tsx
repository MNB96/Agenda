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
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
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
            <Pressable onPress={onOpenSettings} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <CalendarDays color={colors.textSecondary} size={18} />
            </Pressable>
          ),
        }}
      >
        {() => <TodayScreen onOpenItemEditor={onOpenItemEditor} onOpenQuickAdd={onOpenQuickAdd} />}
      </Tab.Screen>
      <Tab.Screen
        name="Agenda"
        options={{
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
          headerRight: () => (
            <Pressable onPress={onOpenQuickAdd} style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Plus color={colors.textSecondary} size={18} />
            </Pressable>
          ),
        }}
      >
        {() => <AgendaScreen onOpenItemEditor={onOpenItemEditor} />}
      </Tab.Screen>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          onPress={onOpenQuickAdd}
          style={[styles.fab, { backgroundColor: colors.primary, borderColor: colors.secondarySoft }]}
        >
          <Plus color={colors.text} size={22} />
        </Pressable>
      </View>
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
  fabWrap: {
    position: 'absolute',
    right: 20,
    bottom: 82,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
})
