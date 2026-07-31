import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsRepository } from '../../app/container'
import type { Settings } from '../../domain/settings/types'

const SETTINGS_KEY = ['settings']
const LICENSES_KEY = ['licenses']

export const useSettings = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => settingsRepository.get(),
  })

  const saveMutation = useMutation({
    mutationFn: (next: Settings) => settingsRepository.save(next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })

  return {
    ...query,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  }
}

export const useLicenseUsages = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: LICENSES_KEY,
    queryFn: () => settingsRepository.listLicenseUsages(),
  })

  const createMutation = useMutation({
    mutationFn: settingsRepository.saveLicenseUsage.bind(settingsRepository),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LICENSES_KEY }),
  })

  return {
    ...query,
    saveUsage: createMutation.mutateAsync,
    isSaving: createMutation.isPending,
  }
}