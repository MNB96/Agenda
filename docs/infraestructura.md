# Infraestructura — SQLite, AsyncStorage, Notificaciones, Google APIs

Todo en `src/infrastructure/`. Las implementaciones concretas de los repositorios del dominio.

---

## 1. SQLite — schema DDL completo

Archivo: `src/infrastructure/persistence/sqlite/db.ts`

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id                   TEXT PRIMARY KEY NOT NULL,
  status               TEXT NOT NULL,           -- 'active' | 'completed'
  type                 TEXT NOT NULL,           -- 'task' | 'goal'
  parentId             TEXT,
  categoryId           TEXT,
  startDate            TEXT,                    -- YYYY-MM-DD
  deadline             TEXT,                    -- YYYY-MM-DD
  completedAt          TEXT,                    -- ISO timestamp
  googleCalendarId     TEXT,                    -- calendarLink.calendarId (desnormalizado)
  googleCalendarEventId TEXT,                   -- calendarLink.eventId (desnormalizado)
  calendarSyncPending  INTEGER,                 -- 0/1
  createdAt            TEXT NOT NULL,
  updatedAt            TEXT NOT NULL,
  data                 TEXT NOT NULL            -- JSON con todos los demás campos
);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_parentId ON items(parentId);

CREATE TABLE IF NOT EXISTS habits (
  id               TEXT PRIMARY KEY NOT NULL,
  title            TEXT NOT NULL,
  categoryId       TEXT,
  regularity       TEXT NOT NULL,   -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  timesPerDay      INTEGER NOT NULL DEFAULT 1,
  reminder         TEXT,            -- JSON de HabitReminderConfig
  notificationIds  TEXT,            -- JSON de string[]
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL,
  regularityChangedAt TEXT          -- ISO timestamp | null
);

CREATE TABLE IF NOT EXISTS habit_completions (
  habitId  TEXT NOT NULL,
  date     TEXT NOT NULL,           -- YYYY-MM-DD
  count    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (habitId, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habitId ON habit_completions(habitId);

CREATE TABLE IF NOT EXISTS habit_occurrences (
  id          TEXT PRIMARY KEY NOT NULL,
  habitId     TEXT NOT NULL,
  occurredAt  TEXT NOT NULL,        -- ISO timestamp
  source      TEXT NOT NULL,        -- 'manual' | 'notification'
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL,
  FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId ON habit_occurrences(habitId);
CREATE INDEX IF NOT EXISTS idx_habit_occurrences_habitId_occurredAt ON habit_occurrences(habitId, occurredAt);

CREATE TABLE IF NOT EXISTS subjects (
  id             TEXT PRIMARY KEY NOT NULL,
  name           TEXT NOT NULL,
  classesPerWeek INTEGER NOT NULL,   -- legacy name; entity lo lee como totalClasses
  absences       INTEGER NOT NULL DEFAULT 0,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);
```

**Nota de migraciones:** Para instalaciones nuevas (fresh data) no se necesitan migraciones — el `CREATE TABLE IF NOT EXISTS` crea todo correctamente. Las funciones de migración legacy en `db.ts` existen solo para upgrade de versiones anteriores.

### Mapping de columna legacy en subjects

```typescript
// subjectRepository.ts — fromRow():
const fromRow = (row): Subject => ({
  id: row.id,
  name: row.name,
  totalClasses: row.classesPerWeek,   // ← renombramiento
  absences: row.absences,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

// save():
await db.runAsync(
  'INSERT OR REPLACE INTO subjects VALUES (?, ?, ?, ?, ?, ?)',
  [subject.id, subject.name, subject.totalClasses, subject.absences, ...]
  //                          ↑ se guarda en columna classesPerWeek
)
```

### Hidratación safe

`Item.hydrate()` y `Habit.hydrate()` devuelven `{ success, item } | { success: false, error }`. Filas corruptas no crashean la lista.

---

## 2. AsyncStorage — claves

| Clave | Contenido |
|---|---|
| `agenda:main` | `Settings` (JSON) |
| `agenda:google-auth` | Partial de `GoogleAuthState` (accessToken, expiresAt, connectedEmail) |
| `@agenda/semester_config_v1` | `SemesterConfig` (JSON: `{ startDate, endDate }`) |
| `@agenda/license-usages` | `LicenseUsage[]` (JSON) |
| `@agenda/calendar-delete-queue` | `string[]` de eventIds pendientes de eliminar |

---

## 3. Notificaciones Android

Archivo: `src/infrastructure/notifications/itemNotifications.ts`

### Canales

| Canal | ID | Importance | Audio | Efecto |
|---|---|---|---|---|
| Recordatorios | `recordatorios` | HIGH | NOTIFICATION | Sonido normal, puede silenciarse |
| Alarmas | `alarmas` | MAX | ALARM | Bypasa DnD, suena siempre |

```typescript
await Notifications.setNotificationChannelAsync('recordatorios', {
  name: 'Recordatorios',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
})

await Notifications.setNotificationChannelAsync('alarmas', {
  name: 'Alarmas',
  importance: Notifications.AndroidImportance.MAX,
  sound: 'default',
  vibrationPattern: [0, 500, 250, 500],
})
```

### Acción "Completar"

`ITEM_COMPLETION_ACTION_ID` — aparece en todas las notificaciones de **tareas** (no metas).

```typescript
const ITEM_COMPLETION_ACTION_ID = 'COMPLETE_ITEM'

// Registrar acción:
await Notifications.setNotificationCategoryAsync('item', [
  { identifier: ITEM_COMPLETION_ACTION_ID, buttonTitle: 'Completar', options: { isDestructive: false } }
])
```

### Reglas de scheduling — Tareas

| Caso | Notificaciones generadas |
|---|---|
| Con `startDate + startTime`, sin `reminderConfig` | 1 notif en `startDate + startTime` |
| Con `reminderConfig[]` | 1 notif por reminder (`startTime - minutesBefore`) |
| Con `deadline` (sin startDate) | 3 auto: día anterior 9:00, mismo día 9:00, día siguiente 9:00 ("Vencida") |
| Con ambos `startDate + deadline` | Depende de si tiene `reminderConfig` o no |

### Reglas de scheduling — Metas

4 notificaciones al crear/actualizar una meta con `deadline`:

| Momento | Mensaje |
|---|---|
| 7 días antes (9:00) | "📅 Faltan 7 días" |
| 1 día antes (9:00) | "⚠️ Vence mañana" |
| Día del deadline (9:00) | "⚠️ Vence hoy" |
| Día siguiente (9:00) | "🔴 Meta vencida" |

Las metas **NO** tienen acción "Completar".

### Manejo de respuestas en App.tsx

Dual-listener para cubrir app cerrada Y en foreground:

```typescript
const processed = new Set<string>()  // evita duplicados

// 1. App cerrada → tocó notif mientras no estaba activa:
void Notifications.getLastNotificationResponseAsync().then(response => {
  if (response) void handleResponse(response)
})

// 2. App abierta / background:
const subscription = Notifications.addNotificationResponseReceivedListener(response => {
  void handleResponse(response)
})
```

**handleResponse:**
- `DEFAULT_ACTION_IDENTIFIER` + itemId → `setEditingItemId(itemId)` (abre ItemDetailModal)
- `ITEM_COMPLETION_ACTION_ID` + itemId → completa la tarea sin abrir la app (ver flujo en README.md)

### Permisos Android declarados

`RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `INTERNET`

### Notificaciones de hábitos

Archivo: `src/infrastructure/notifications/habitNotifications.ts`

Se schedulean según `HabitReminderConfig`:
- `mode: 'interval'`: una notif cada `intervalHours` horas, opcionalmente dentro de una ventana `windowStart`–`windowEnd`
- `mode: 'random'`: `timesPerDay` notifs en los `randomTimes` sorteados (HH:mm)

Al cambiar la regularidad del hábito (`regularityChangedAt`): se cancelan las notifs existentes y se regeneran.

---

## 4. Google Calendar

Archivo: `src/infrastructure/calendar/googleCalendarRepository.ts`

### Operaciones

- `listCalendars(accessToken)` → lista de calendarios del usuario
- `listEvents(calendarId, dateMin, dateMax, accessToken)` → eventos del rango
- `createEvent(calendarId, item, accessToken)` → crea evento, devuelve `CalendarLink`
- `updateEvent(calendarId, eventId, item, accessToken)` → actualiza evento
- `deleteEvent(calendarId, eventId, accessToken)` → elimina evento

### Flujo de sync de Calendar

```
Item.syncToCalendar = true + origin = 'app'
  → Al crear: createEvent() → Item.linkCalendar(item, link) → save
  → Al actualizar: updateEvent() → save
  → Al eliminar: deleteEvent(); si offline → enqueue en calendarDeleteQueue

Item con origin = 'external' (importado desde Calendar):
  → syncToCalendar = false
  → La app nunca modifica este evento en Calendar
  → Solo se muestra en la lista de tareas

calendarSyncPending = true:
  → useCalendarSyncRecovery intenta sync al montar
```

### Manejo de errores de Calendar

Archivo: `src/infrastructure/calendar/errors.ts`

- 401 Unauthorized → `markUnauthorized()` en Zustand
- Network error → `Item.markSyncPending(item)` → retry automático

---

## 5. Google Tasks

Archivo: `src/infrastructure/tasks/googleTasksRepository.ts`

Usado solo para metas (`type = 'goal'`).

- `createTask(item, accessToken)` → crea task en lista `@default`
- `updateTask(taskId, item, accessToken)` → actualiza
- `deleteTask(taskId, accessToken)` → elimina

### Flujo de postergación de meta

1. La meta ya tenía deadline y se cambia por uno distinto
2. Renombra tarea en Google Tasks a `"[Pospuesto] Título"`
3. Elimina la meta original + todas sus sub-metas localmente
4. Crea una meta nueva con los datos actualizados
5. Recrea las sub-metas bajo la nueva meta

---

## 6. Google OAuth (Android nativo)

Librería: `@react-native-google-signin/google-signin` v16

```typescript
// Configurar (solo una vez):
GoogleSignin.configure({ scopes: GOOGLE_OAUTH_SCOPES })

// Conectar (interactivo):
await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
// Intentar silent primero:
if (GoogleSignin.hasPreviousSignIn() && !authIssue) {
  const silent = await GoogleSignin.signInSilently()
  if (silent.type === 'success') {
    const tokens = await GoogleSignin.getTokens()
    setSession({ accessToken: tokens.accessToken, ... })
    return
  }
}
// Si silent falla, interactivo:
const result = await GoogleSignin.signIn()
const tokens = await GoogleSignin.getTokens()
setSession({ accessToken: tokens.accessToken, connectedEmail: result.data.user.email, ... })

// Refresh silencioso (en background, useGoogleSessionLifecycleMobile):
const silent = await GoogleSignin.signInSilently()
if (silent.type === 'success') {
  const tokens = await GoogleSignin.getTokens()
  setSession({...})
}

// Desconectar:
await GoogleSignin.signOut()
clearSession()
```

Para web: `expo-auth-session/providers/google` con `responseType: 'token'`.

### Setup requerido

1. Crear proyecto en Google Cloud Console
2. Habilitar Google Calendar API y Google Tasks API
3. Configurar OAuth consent screen con scopes `calendar` y `tasks`
4. Crear credencial OAuth para Android con SHA-1 del keystore de debug
5. Descargar `google-services.json` → colocar en raíz del proyecto
6. En `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`

---

## 7. Google Maps / Places

Archivos: `src/infrastructure/maps/googlePlaces.ts`, `travelTime.ts`

- `googlePlaces.ts` → autocompletado de ubicación (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`)
- `travelTime.ts` → calcula tiempo de viaje según modo de transporte para generar recordatorio de salida

---

## 8. Feriados

Archivo: `src/infrastructure/holidays/holidaysService.ts`

Obtiene feriados nacionales argentinos. Se muestran en TaskScreen (Tab Tareas) como filas inline junto a los eventos de Google Calendar.

---

## 9. Exportar / importar datos

Archivos: `src/infrastructure/persistence/sqlite/exportAllData.ts`, `importAllData.ts`

### Formato de exportación

```json
{
  "exportedAt": "2026-08-16T12:00:00.000Z",
  "items": [...],
  "habits": [...],
  "habitCompletions": [...],
  "habitOccurrences": [...],
  "subjects": [...]
}
```

### Importación

Reemplaza toda la data local con el JSON importado. Operación destructiva (muestra Alert de confirmación).

`useDataExport` → genera el JSON y lo comparte vía `expo-sharing`.  
`useDataImport` → abre el file picker (`expo-document-picker`), lee el JSON y llama a `importAllData()`.
