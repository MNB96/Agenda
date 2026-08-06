import { useQuery } from '@tanstack/react-query'
import { itemRepository } from '../../app/container'

export const SUBTASKS_KEY_PREFIX = 'subtasks'

// Usa idx_items_parentId en vez de filtrar el cache principal de useItems(), que ahora solo
// trae items activos + una página de completados — una subtarea completada vieja de un
// padre activo igual tiene que contarse y mostrarse.
export const useSubtasks = (parentId: string) =>
  useQuery({
    queryKey: [SUBTASKS_KEY_PREFIX, parentId],
    queryFn: () => itemRepository.getByParentIds([parentId]),
  })
