import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react-native'
import { Animated, Pressable, StyleSheet, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../theme/useAppTheme'

interface FloatingAddButtonProps {
  onPress: () => void
  style?: ViewStyle
}

export const FloatingAddButton = ({ onPress, style }: FloatingAddButtonProps) => {
  const { colors, isDark } = useAppTheme()
  const insets = useSafeAreaInsets()
  const [isHovered, setIsHovered] = useState(false)
  const scale = useRef(new Animated.Value(0.94)).current

  useEffect(() => {
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: false }).start()
  }, [scale])

  const animatedStyle = useMemo(
    () => ({
      transform: [{ scale }],
      opacity: 1,
    }),
    [scale],
  )

  const onPressIn = () => {
    Animated.timing(scale, { toValue: 0.96, duration: 120, useNativeDriver: false }).start()
  }

  const onPressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: false }).start()
  }

  return (
    <Animated.View style={[animatedStyle, { pointerEvents: 'box-none' }]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: pressed || isHovered ? colors.accentStrong : colors.accent,
            borderColor: colors.accentSoft,
            shadowColor: colors.accent,
            bottom: Math.max(insets.bottom + 18, 86),
            shadowOpacity: isDark ? 0.34 : 0.24,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Agregar item"
      >
        <Plus size={24} color={colors.fabText} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
})
