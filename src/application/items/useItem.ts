import { useQuery } from '@tanstack/react-query'
import { itemRepository } from '../../app/container'

export const ITEM_KEY_PREFIX = 'item'

// Busca por id contra la clave primaria en vez del cache de useItems(), que solo pagina completados.
export const useItem = (itemId: string | undefined) =>
  useQuery({
    queryKey: [ITEM_KEY_PREFIX, itemId],
    queryFn: () => itemRepository.getById(itemId!),
    enabled: Boolean(itemId),
  })
