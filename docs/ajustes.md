# Ajustes — SettingsModal y operaciones de datos

Modal full-screen accesible desde el botón ⚙ en el header del Tab Tareas.

---

## 1. SettingsModal

Archivo: `src/mobile/modals/SettingsModal.tsx`

`transparent={false}`, `animationType="slide"`, `statusBarTranslucent`.

### Layout

```typescript
fullScreen: { flex: 1, backgroundColor: colors.background }
header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }
headerBtn: { padding: 8 }   // ChevronLeft size={24}
content: { paddingHorizontal: 16 }
title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 10 }
// Texto: "Ajustes"

section: {
  borderWidth: 1, borderColor: colors.border
  backgroundColor: colors.surface, borderRadius: 14
  padding: 10, marginBottom: 10
}
sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }
metaText: { color: colors.textSecondary, fontSize: 12 }
warnText: { color: colors.danger, fontSize: 12, marginTop: 4 }
actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 }
switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }
inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }
input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.text, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 }
```

### Botones reutilizables

```typescript
primaryButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }
primaryButtonText: { color: colors.fabText, fontWeight: '700' }

secondaryButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }
secondaryButtonText: { color: colors.textSecondary, fontWeight: '700' }

disabled: { opacity: 0.4 }

dangerButton: { backgroundColor: colors.danger + '18', borderWidth: 1, borderColor: colors.danger + '55', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6, alignItems: 'center' }
dangerButtonText: { color: colors.danger, fontWeight: '600', fontSize: 14 }
```

---

## 2. Secciones del modal

### Sección: Tema

3 chips:

```typescript
themeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }
themeOption: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }
themeOptionSystem: { backgroundColor: colors.primarySoft, borderColor: colors.primary }
themeOptionLight:  { backgroundColor: colors.secondarySoft, borderColor: colors.secondary }
themeOptionDark:   { backgroundColor: colors.creamSoft, borderColor: colors.cream }
themeOptionText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 }
themeOptionTextActive: { color: colors.onPrimary }
```

Al seleccionar: `saveSettings({ themePreference: mode })`.

Opciones: `Sistema` · `Claro` · `Oscuro`.

### Sección: Google Calendar

Estado de la conexión:
- Texto "Conectado: email@gmail.com" (si conectado) o "No conectado"
- Texto de advertencia si `authIssue` (naranja/rojo)
- Botón **Conectar** / **Reconectar** (si `!isConnected`)
- Botón **Desconectar** (si `hasSessionToDisconnect`)

Flujo de conexión en Android nativo:
1. `GoogleSignin.configure({ scopes: GOOGLE_OAUTH_SCOPES })`
2. Si ya hubo sesión y no hay `authIssue` → intenta `signInSilently` primero
3. Si silent falla → `signIn()` interactivo
4. Al tener `result.type === 'success'` → `getTokens()` → `setSession({...})`

Flujo de desconexión: `GoogleSignin.signOut()` + `clearSession()`.

Lista de calendarios:
```typescript
calendarOption: { marginTop: 6 }
calendarOptionText: { color: colors.textSecondary, fontSize: 12 }
// Texto: "✓ Nombre del calendario" (si seleccionado) o "○ Nombre"
```

Al tocar un calendario: toggle en `settings.selectedCalendarIds`.

### Sección: Recordatorios (solo Android)

```typescript
// Botón "Permitir alarmas exactas":
openExactAlarmSettings()  // abre Settings del sistema
// Descripción: "Sin este permiso, Android puede demorar o no disparar los recordatorios a la hora exacta."

// Botón "Sonido de notificaciones":
openNotificationSoundSettings()  // abre configuración de sonido de notifs
```

### Sección: Licencias por examen

```typescript
// Input numérico:
<TextInput
  value={String(settings.availableExamLeaveDaysPerYear)}
  onChangeText={(value) => saveSettings({ availableExamLeaveDaysPerYear: Math.max(0, Number(value) || 0) })}
  keyboardType="numeric"
  style={[styles.input, { width: 60 }]}
/>
// Label: "días disponibles por año"
```

Si se configura en 0: la barra de licencias y el contador desaparecen de StudiesScreen.

### Sección: Categorías

```typescript
<Switch
  value={settings.showCategoryIcons}
  onValueChange={(value) => saveSettings({ showCategoryIcons: value })}
/>
// Label: "Mostrar íconos de categoría"
```

Afecta los chips de categoría en TaskScreen (muestra/oculta el ícono a la izquierda del nombre).

### Sección: Datos

| Botón | Acción |
|---|---|
| "Descargar mis datos (JSON)" | `exportData()` → genera JSON → comparte via `expo-sharing` |
| "Cargar backup (JSON)" | `importData()` → file picker → reemplaza toda la data local |
| "Borrar completadas (N)" | Alert de confirmación → elimina todas las tareas completadas |

```typescript
// Borrar completadas: deshabilita el botón si completedCount === 0
// Alert: "¿Borrar las N tareas completadas? Esta acción no se puede deshacer."
// [Cancelar] [Borrar (destructive)]
```

---

## 3. Exportar datos

Hook: `src/application/settings/useDataExport.ts`  
Implementación: `src/infrastructure/persistence/sqlite/exportAllData.ts`

### Formato del JSON exportado

```json
{
  "exportedAt": "2026-08-16T12:00:00.000Z",
  "items": [
    {
      "id": "...",
      "type": "task",
      "status": "active",
      "title": "Mi tarea",
      "categoryId": "personal",
      "startDate": "2026-08-20",
      "startTime": "09:00",
      "repeatRule": "none",
      "syncToCalendar": false,
      "createdAt": "2026-08-16T...",
      "updatedAt": "2026-08-16T..."
    }
  ],
  "habits": [
    {
      "id": "...",
      "title": "Tomar agua",
      "categoryId": "salud",
      "regularity": "daily",
      "timesPerDay": 3,
      "reminder": { "mode": "random", "timesPerDay": 3, "randomTimes": ["11:11", "19:04", "22:30"] },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "habitCompletions": [
    { "habitId": "...", "date": "2026-08-16", "count": 2 }
  ],
  "habitOccurrences": [
    { "id": "...", "habitId": "...", "occurredAt": "2026-08-16T11:11:00.000Z", "source": "manual", "createdAt": "...", "updatedAt": "..." }
  ],
  "subjects": [
    { "id": "...", "name": "Desarrollo de aplicaciones II", "totalClasses": 16, "absences": 1, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

### Proceso de exportación

1. `exportAllData()` lee todas las tablas SQLite
2. Genera el JSON
3. Escribe en un archivo temporal
4. `expo-sharing` muestra el sheet de compartir del sistema

### Proceso de importación

1. `expo-document-picker` → usuario selecciona el archivo JSON
2. Parseo y validación básica del formato
3. Alert de confirmación: "¿Reemplazar todos los datos actuales?"
4. `importAllData(json)` → transacción SQLite: DELETE + INSERT de todas las tablas
5. `queryClient.invalidateQueries()` para refrescar la UI

---

## 4. Permisos

### Permiso de ubicación

Solicitado la primera vez que el usuario activa el tiempo de viaje en QuickAddSheet/ItemDetailModal.

`settings.locationPermissionRequested` se marca como `true` tras la primera solicitud, independientemente de si el usuario aceptó o rechazó.

Se solicita vía `expo-location`. Requiere `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` en AndroidManifest.

### Permiso de notificaciones

Se solicita al montar `AppShellInner`:
```typescript
void requestNotificationPermissions()
```

Se solicita el permiso estándar de Android 13+ (`POST_NOTIFICATIONS`).

Para alarmas exactas en Android 12+: el usuario debe habilitarlo manualmente desde Ajustes → botón "Permitir alarmas exactas".
