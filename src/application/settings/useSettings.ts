import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsRepository } from '../../app/container'
import { updateSettings, createLicenseUsage, DEFAULT_SETTINGS, type LicenseUsage, type Settings } from '../../domain/settings/types'

const SETTINGS_KEY = ['settings']
const LICENSES_KEY = ['licenses']

export const useSettings = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => settingsRepository.get(),
  })

  // Patch-and-merge via updateSettings (validates), so callers don't spread the full object.
  const saveMutation = useMutation({
    mutationFn: (patch: Partial<Settings>) => {
      const current = query.data ?? DEFAULT_SETTINGS
      return settingsRepository.save(updateSettings(current, patch))
    },
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

  const saveMutation = useMutation({
    mutationFn: (usage: LicenseUsage) => settingsRepository.saveLicenseUsage(createLicenseUsage(usage)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LICENSES_KEY }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsRepository.deleteLicenseUsage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LICENSES_KEY }),
  })

  return {
    ...query,
    saveUsage: saveMutation.mutateAsync,
    deleteUsage: deleteMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  }
}