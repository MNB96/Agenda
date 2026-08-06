import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Path } from 'react-native-svg'

const ROTATION_DURATION_MS = 1100

interface LoadingSpinnerProps {
  /** Width and height in px — the icon is square. */
  size?: number
}

// The app's own arc-and-checkmark mark, minus the checkmark, spun continuously as a loading
// indicator — same five colors and segment gaps as the app icon, transparent background, no
// center element. Rotated via RN's Animated (native driver) instead of the SVG's own
// <animateTransform>, since SMIL animation support in react-native-svg is less consistent
// across platforms than a plain Animated.View transform.
export const LoadingSpinner = ({ size = 100 }: LoadingSpinnerProps) => {
  const [rotation] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: ROTATION_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => animation.stop()
  }, [rotation])

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate: spin }] }}>
      <Svg width={size} height={size} viewBox="0 0 800 800" fill="none">
        {/* Arco celeste principal */}
        <Path
          d="M540.93 611.32 A254 254 0 1 1 468.73 155.48"
          stroke="#68C5D7"
          strokeWidth={47}
          strokeLinecap="round"
        />
        {/* Verde */}
        <Path
          d="M529.68 181.60 A254 254 0 0 1 584.55 225.48"
          stroke="#AED3C7"
          strokeWidth={47}
          strokeLinecap="round"
        />
        {/* Amarillo */}
        <Path
          d="M617.95 269.56 A254 254 0 0 1 645.57 335.12"
          stroke="#E7DFAE"
          strokeWidth={47}
          strokeLinecap="round"
        />
        {/* Naranja */}
        <Path
          d="M653.83 390.69 A254 254 0 0 1 648.72 451.51"
          stroke="#FAA01F"
          strokeWidth={47}
          strokeLinecap="round"
        />
        {/* Naranja fuerte */}
        <Path
          d="M632.22 502.91 A254 254 0 0 1 595.71 561.91"
          stroke="#FC6900"
          strokeWidth={47}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  )
}
