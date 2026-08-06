import { useQuery } from '@tanstack/react-query'
import { itemRepository } from '../../app/container'

export const ITEM_KEY_PREFIX = 'item'

// Busca un item puntual por id contra la clave primaria en vez de escanear el cache
// principal de useItems(), que ahora solo trae items activos + una página de completados
// — un item completado viejo (fuera de esa página) igual tiene que poder abrirse.
export const useItem = (itemId: string | undefined) =>
  useQuery({
    queryKey: [ITEM_KEY_PREFIX, itemId],
    queryFn: () => itemRepository.getById(itemId!),
    enabled: Boolean(itemId),
  })
