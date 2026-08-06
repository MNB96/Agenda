import type { ItemCategory } from '../Item.types'

const CATEGORY_KEYWORDS: { categoryId: string; keywords: string[] }[] = [
  {
    categoryId: 'facultad',
    keywords: [
      'parcial', 'examen', 'cursada', 'materia', 'tesis', 'trabajo práctico',
      'facultad', 'apunte', 'uade', 'estudiar', 'tp de', 'final',
    ],
  },
  {
    categoryId: 'salud',
    keywords: [
      'medic', 'doctor', 'turno', 'hospital', 'clinica', 'clínica',
      'dentista', 'farmacia', 'pastilla', 'remedio',
      'analisis', 'análisis', 'consulta', 'enfermedad', 'vacuna',
      'ginec', 'otorrin', 'ortodon', 'oculista',
      'cardiol', 'dermatol', 'traumatol', 'oftalmol',
      'psicol', 'psiquiat', 'nutri', 'fisio', 'kinesi',
      'endocrin', 'neurol', 'urol', 'pediat', 'ciruj',
      'ecograf', 'radiograf', 'tomograf', 'resonancia',
      'laboratorio', 'sangre', 'orina',
    ],
  },
  {
    categoryId: 'trabajo',
    keywords: [
      'reunión', 'meeting', 'cliente', 'proyecto', 'informe',
      'presentación', 'laburo', 'jefe', 'entrevista', 'sprint',
      'reporte', 'deadline', 'capacitación', 'accenture',
    ],
  },
  {
    categoryId: 'compras',
    keywords: [
      'comprar', 'mercado', 'supermercado', 'kiosco', 'ferretería',
      'verdulería', 'carnicería', 'traer', 'buscar en',
    ],
  },
  {
    categoryId: 'casa',
    keywords: [
      'limpiar', 'ordenar', 'arreglar', 'pintar', 'electricista',
      'plomero', 'mudanza', 'lavar ropa', 'cocinar', 'aspirar',
      'barrer', 'planchar',
    ],
  },
]

export const detectCategoryFromText = (
  text: string,
  categories: readonly ItemCategory[],
): string | undefined => {
  if (!text.trim()) return undefined
  const normalized = text.toLowerCase()

  for (const { categoryId, keywords } of CATEGORY_KEYWORDS) {
    const category = categories.find((candidate) => candidate.id === categoryId)
    if (!category) continue
    if (keywords.some((keyword) => normalized.includes(keyword))) return categoryId
  }

  // Si el nombre de alguna categoría aparece en el texto, también sugiere
  for (const cat of categories) {
    if (normalized.includes(cat.name.toLowerCase())) return cat.id
  }

  return undefined
}
