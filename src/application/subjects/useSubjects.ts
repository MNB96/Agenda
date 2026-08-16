import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subjectRepository } from '../../app/container'
import {
  createSubject as buildSubject,
  updateSubject as patchSubject,
  type NewSubjectInput,
  type SemesterConfig,
  type Subject,
} from '../../domain/subjects'

const SUBJECTS_KEY = ['subjects']
const SEMESTER_CONFIG_STORAGE_KEY = '@agenda/semester_config_v1'

const getDefaultSemesterConfig = (): SemesterConfig => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  let startDate: string
  let endDate: string
  if (month >= 3 && month <= 7) {
    startDate = `${year}-03-01`
    endDate = `${year}-07-31`
  } else if (month >= 8 && month <= 11) {
    startDate = `${year}-08-01`
    endDate = `${year}-11-30`
  } else {
    const nextYear = month === 12 ? year + 1 : year
    startDate = `${nextYear}-03-01`
    endDate = `${nextYear}-07-31`
  }

  return { startDate, endDate }
}

export const useSubjects = () => {
  const queryClient = useQueryClient()

  const subjectsQuery = useQuery({
    queryKey: SUBJECTS_KEY,
    queryFn: () => subjectRepository.list(),
  })

  const [semesterConfig, setSemesterConfig] = useState<SemesterConfig>(getDefaultSemesterConfig)

  useEffect(() => {
    AsyncStorage.getItem(SEMESTER_CONFIG_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return
        try {
          const parsed = JSON.parse(raw) as SemesterConfig
          if (parsed.startDate && parsed.endDate) {
            setSemesterConfig(parsed)
          }
        } catch {
          // use default
        }
      })
      .catch(() => {})
  }, [])

  const saveSemesterConfig = useCallback(async (config: SemesterConfig) => {
    await AsyncStorage.setItem(SEMESTER_CONFIG_STORAGE_KEY, JSON.stringify(config))
    setSemesterConfig(config)
  }, [])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY })
  }, [queryClient])

  const findCurrent = (id: string): Subject => {
    const found = (subjectsQuery.data ?? []).find((s) => s.id === id)
    if (!found) throw new Error('No se encontró la materia.')
    return found
  }

  const createMutation = useMutation({
    mutationFn: async (input: NewSubjectInput) => {
      const subject = buildSubject(input)
      return subjectRepository.save(subject)
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<Subject, 'name' | 'totalClasses' | 'absences'>>
    }) => {
      const next = patchSubject(findCurrent(id), patch)
      return subjectRepository.save(next)
    },
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await subjectRepository.remove(id)
    },
    onSuccess: invalidate,
  })

  const addAbsenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = findCurrent(id)
      const next = patchSubject(current, { absences: current.absences + 1 })
      return subjectRepository.save(next)
    },
    onSuccess: invalidate,
  })

  const removeAbsenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const current = findCurrent(id)
      const next = patchSubject(current, { absences: Math.max(0, current.absences - 1) })
      return subjectRepository.save(next)
    },
    onSuccess: invalidate,
  })

  return {
    subjects: subjectsQuery.data ?? [],
    semesterConfig,
    saveSemesterConfig,
    createSubject: createMutation.mutateAsync,
    updateSubject: updateMutation.mutateAsync,
    removeSubject: removeMutation.mutateAsync,
    addAbsence: addAbsenceMutation.mutateAsync,
    removeAbsence: removeAbsenceMutation.mutateAsync,
    isLoading: subjectsQuery.isLoading,
  }
}
