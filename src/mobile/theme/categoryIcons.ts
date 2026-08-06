import { Briefcase, Cross, GraduationCap, Heart, Home, ShoppingCart, Tag } from 'lucide-react-native'

// Traducción explícita de nombre de ícono (string) a componente, sin indexar lucide dinámicamente.
const CATEGORY_ICONS: Record<string, typeof Tag> = {
  GraduationCap,
  Briefcase,
  Heart,
  Home,
  Cross,
  ShoppingCart,
}

// Ícono no reconocido cae en uno genérico en vez de romper el render.
export const resolveCategoryIcon = (icon: string): typeof Tag => CATEGORY_ICONS[icon] ?? Tag
