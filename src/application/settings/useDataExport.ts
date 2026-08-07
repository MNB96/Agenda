import { useState } from 'react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { exportAllSqliteData } from '../../infrastructure/persistence/sqlite/exportAllData'

// Written to cache (not document storage) since it only needs to exist long enough to be shared.
const buildExportFile = (json: string, exportedAt: string): File => {
  const filename = `agenda-backup-${exportedAt.replace(/[:.]/g, '-')}.json`
  const file = new File(Paths.cache, filename)
  file.create({ overwrite: true })
  file.write(json)
  return file
}

export const useDataExport = () => {
  const [isExporting, setIsExporting] = useState(false)

  const exportData = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const data = await exportAllSqliteData()
      const file = buildExportFile(JSON.stringify(data, null, 2), data.exportedAt)

      const isAvailable = await Sharing.isAvailableAsync()
      if (!isAvailable) {
        throw new Error('Compartir archivos no está disponible en este dispositivo.')
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exportar datos de Agenda' })
    } finally {
      setIsExporting(false)
    }
  }

  return { exportData, isExporting }
}
