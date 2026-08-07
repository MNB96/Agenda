import { Briefcase, Cross, GraduationCap, Heart, Home, ShoppingCart } from 'lucide-react-native'

interface CategoryGlyphProps {
  iconName: string | undefined
  size: number
  color: string
}

// Each branch renders a directly-imported icon (never a variable holding a resolved
// component) — react-hooks/static-components flags any JSX tag produced by a function call.
export const CategoryGlyph = ({ iconName, size, color }: CategoryGlyphProps) => {
  if (iconName === 'GraduationCap') return <GraduationCap size={size} color={color} />
  if (iconName === 'Briefcase') return <Briefcase size={size} color={color} />
  if (iconName === 'Heart') return <Heart size={size} color={color} />
  if (iconName === 'Home') return <Home size={size} color={color} />
  if (iconName === 'Cross') return <Cross size={size} color={color} />
  if (iconName === 'ShoppingCart') return <ShoppingCart size={size} color={color} />
  return null
}
