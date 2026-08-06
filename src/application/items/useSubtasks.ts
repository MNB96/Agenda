import { useQuery } from '@tanstack/react-query'
import { itemRepository } from '../../app/container'

export const SUBTASKS_KEY_PREFIX = 'subtasks'

// Usa idx_items_parentId en vez del cache de useItems(), que no pagina subtareas completadas viejas.
export const useSubtasks = (parentId: string) =>
  useQuery({
    queryKey: [SUBTASKS_KEY_PREFIX, parentId],
    queryFn: () => itemRepository.getByParentIds([parentId]),
  })
