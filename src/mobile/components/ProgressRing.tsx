import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useAppTheme } from '../theme/useAppTheme'

interface ProgressRingProps {
  size: number
  strokeWidth?: number
  /** 0..1 */
  progress: number
  color: string
  label: string
}

export const ProgressRing = ({ size, strokeWidth = 4, progress, color, label }: ProgressRingProps) => {
  const { colors } = useAppTheme()
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))
  const dashOffset = circumference * (1 - clamped)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ position: 'absolute', fontSize: size * 0.26, fontWeight: '800', color }}>{label}</Text>
    </View>
  )
}
