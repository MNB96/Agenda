import { useState } from 'react'
import { Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useQueryClient } from '@tanstack/react-query'
import { importAllSqliteData, isValidExport } from '../../infrastructure/persistence/sqlite/importAllData'

export const useDataImport = () => {
  const [isImporting, setIsImporting] = useState(false)
  const queryClient = useQueryClient()

  const importData = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    })

    if (result.canceled || !result.assets?.[0]) return

    const uri = result.assets[0].uri
    let raw: string
    try {
      raw = await FileSystem.readAsStringAsync(uri)
    } catch {
      Alert.alert('Error', 'No se pudo leer el archivo.')
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      Alert.alert('Error', 'El archivo no es un JSON válido.')
      return
    }

    if (!isValidExport(parsed)) {
      Alert.alert('Error', 'El archivo no tiene el formato esperado de backup de Agenda.')
      return
    }

    const itemCount = parsed.items.length
    const habitCount = parsed.habits.length

    await new Promise<void>((resolve) => {
      Alert.alert(
        'Restaurar datos',
        `Se van a reemplazar todos tus datos actuales con el backup:\n\n• ${itemCount} tareas/metas\n• ${habitCount} hábitos\n• Materias y asistencia\n\nEsta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              setIsImporting(true)
              try {
                await importAllSqliteData(parsed)
                await queryClient.invalidateQueries()
                Alert.alert('Listo', 'Datos restaurados correctamente.')
              } catch {
                Alert.alert('Error', 'Ocurrió un error al restaurar los datos.')
              } finally {
                setIsImporting(false)
              }
              resolve()
            },
          },
        ],
      )
    })
  }

  return { importData, isImporting }
}
