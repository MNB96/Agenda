# CLAUDE.md — Agenda Personal

Guía técnica completa para entender, modificar y replicar esta app en Android.  
**Toda la data es nueva — no hay datos de versiones anteriores que migrar.**

---

## Qué es esta app

App mobile-first de productividad personal. Nombre de display: **Tasks**. Package: `com.agenda.personal`.

4 tabs principales:
- **Tareas** — lista de tareas con secciones, swipe, búsqueda y filtros por categoría
- **Facultad** — seguimiento académico: exámenes, materias, ausencias, licencias
- **Metas** — objetivos con deadline, sub-metas, sync con Google Tasks
- **Hábitos** — rastreador con streaks, multi-repetición diaria, estadísticas

---

## Stack técnico

| Tecnología | Versión | Rol |
|---|---|---|
| React Native | ~0.86.2 | Motor UI nativo |
| Expo | ~57 | Toolchain, plugins nativos |
| TypeScript | 6.0 strict | Todo el proyecto |
| Hermes | - | JS runtime Android |
| @react-navigation/bottom-tabs | 7 | Navegación (solo tabs) |
| @tanstack/react-query | 5 | Estado servidor / async |
| zustand | 5 | Estado sesión Google OAuth |
| expo-sqlite | ~57 | Base de datos local |
| @react-native-async-storage/async-storage | 2 | Settings |
| expo-notifications | ~57 | Notificaciones con acciones |
| expo-location | ~57 | Tiempo de viaje |
| @react-native-google-signin/google-signin | 16 | Google OAuth Android |
| expo-auth-session | ~57 | Google OAuth Web |
| date-fns | 4 (locale es) | Fechas en español |
| lucide-react-native | 1 | Iconos |
| react-native-gesture-handler | 2 | Swipe en tarjetas |
| vitest | 4 | Tests unitarios |

---

## Comandos esenciales

```bash
# Desarrollo
npm install
npm run android          # debug en emulador o dispositivo
npm run start            # solo Metro (Expo Go)
npm test                 # vitest watch
npm run test:run         # una sola pasada

# Build release
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

El skill `/install-app` hace build release e instala en dispositivo conectado.

### Variables de entorno

Copiar `.env.example` a `.env`:

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=        # Google Places + travel time
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=      # Expo Go / desarrollo
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=  # OAuth Android release
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=      # OAuth iOS
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=      # OAuth Web (solo para web)
```

---

## Arquitectura en capas

```
domain/          ← Entidades + interfaces + servicios puros (cero React, cero infra)
infrastructure/  ← SQLite, AsyncStorage, Google APIs, Notifications
application/     ← Hooks React Query (casos de uso)
mobile/          ← UI React Native
state/           ← Zustand (solo sesión Google)
app/             ← container.ts: único punto de DI
utils/           ← Helpers sin dependencias
```

**Regla de dependencia:** el dominio no importa nada de React, infra ni librerías externas. Las interfaces (`ItemRepository`, `HabitRepository`) viven en domain. Las implementaciones SQLite en infrastructure. El único lugar que los conecta es `src/app/container.ts`.

---

## Mapa de archivos clave

```
App.tsx                                    ← Root: QueryClient, AppShellInner, notif handling
index.js                                   ← Expo entry (registerRootComponent)
app.json                                   ← Config Expo (plugins, permisos, icono)
src/
  app/container.ts                         ← DI: singletons de repositorios
  domain/
    items/
      Item.ts                              ← Entidad principal + namespace estático
      Item.types.ts                        ← RepeatRule, ItemStatus, ItemCategory
      Item.inputs.ts                       ← NewItemInput, ItemPatch
      ItemRepository.ts                    ← Interface repositorio
      index.ts
      valueObjects/
        RepeatConfig.ts                    ← unit, interval, end, daysOfWeek, occurrencesDone
        ReminderConfig.ts                  ← id, mode, minutesBefore, persistent, alarmType
        AcademicConfig.ts                  ← studyTimeBefore, grade
        TravelConfig.ts                    ← transport, extraMinutes, departureReminderEnabled
        CalendarLink.ts                    ← calendarId, eventId, lastSyncedAt, origin, kind
      services/
        quickInputParser.ts               ← Parser NL español
        recurrence.ts                     ← buildNextOccurrence, catchUpOverdueOccurrence
        categoryDetector.ts
        examDetector.ts                   ← isExamTask: keywords
        goalDeadline.ts
        autoPurge.ts
        eventDateTimes.ts
        relevance.ts
    habits/
      Habit.ts                             ← Entidad hábito + namespace
      HabitOccurrence.ts
      HabitReminder.ts                     ← HabitReminderConfig, validateHabitReminder
      HabitRepository.ts
      index.ts
      services/
        streaks.ts
        completionCounts.ts
        reminderSchedule.ts
    settings/
      Settings.ts
      LicenseUsage.ts
      types.ts                             ← Settings, DEFAULT_CATEGORIES, GOAL_CATEGORIES, HABIT_CATEGORIES
      repositories.ts
    subjects/
      Subject.ts
      index.ts                             ← computeAttendance
    calendar/types.ts, repositories.ts
    holidays/types.ts
  infrastructure/
    persistence/
      sqlite/
        db.ts                              ← Init DB, schema DDL, migraciones
        itemRepository.ts
        habitRepository.ts
        subjectRepository.ts
        itemRow.ts
        exportAllData.ts / importAllData.ts
      asyncstorage/settingsRepository.ts
    calendar/googleCalendarRepository.ts, errors.ts
    tasks/googleTasksRepository.ts
    notifications/itemNotifications.ts, habitNotifications.ts
    maps/googlePlaces.ts, travelTime.ts
    holidays/holidaysService.ts
  application/
    items/
      useItems.ts                          ← Hook principal CRUD, queryKey ['items']
      useTaskEntries.ts                    ← Secciones, búsqueda, filtros, paginación
      useItem.ts
      useSubtasks.ts
      useAutoPurgeCompleted.ts            ← Auto-borra completadas > 60 días
      useAutoRegenerateOverdueRecurring.ts
      useAutoCompleteReminderOnly.ts
      useMarkOverdueGoals.ts
      useLocationAutocomplete.ts
    habits/useHabits.ts
    calendar/
      useGoogleCalendar.ts
      itemCalendarSync.ts
      useCalendarDeleteQueue.ts
      useCalendarSyncRecovery.ts
      calendarDeleteQueue.ts
    settings/useSettings.ts, useDataExport.ts, useDataImport.ts
    subjects/useSubjects.ts
    holidays/useHolidays.ts
  state/
    googleAuthStore.ts                     ← Zustand: accessToken, expiresAt, connectedEmail
  mobile/
    navigation/MainTabs.tsx               ← Bottom tabs (4 screens)
    screens/
      TaskScreen.tsx                      ← Tab 1
      StudiesScreen.tsx                   ← Tab 2
      GoalsScreen.tsx                     ← Tab 3
      HabitsScreen.tsx                    ← Tab 4
    modals/
      QuickAddSheet.tsx                   ← Sheet alta rápida (tareas)
      AddGoalSheet.tsx
      AddHabitSheet.tsx
      ItemDetailModal.tsx                 ← Editor completo tarea/meta
      SettingsModal.tsx
      HabitStatsModal.tsx
    components/
      SwipeableItemCard.tsx               ← Tarjeta con swipe
      ItemCard.tsx
      HabitCard.tsx
      FloatingAddButton.tsx               ← FAB (+) global
      MonthCalendar.tsx
      ReminderPanel.tsx
      RepeatPanel.tsx
      ProgressRing.tsx
      LoadingSpinner.tsx
    theme/
      tokens.ts                           ← ThemeTokens: light/dark tokens
      useAppTheme.ts
      CategoryGlyph.tsx
      categoryIcons.ts
    useGoogleSessionLifecycleMobile.ts
  utils/id.ts, calendarDate.ts, assertNever.ts
android/                                   ← Proyecto nativo Android (bare workflow)
docs/tareas.md, metas.md, habits-flow.md, facultad.md
```

---

## Schema SQLite — DDL completo

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id                   TEXT PRIMARY KEY NOT NULL,
  status               TEXT NOT NULL,          -- 'active' | 'completed'
  type                 TEXT NOT NULL,          -- 'task' | 'goal'
  parentId             TEXT,                   -- sub-meta / subtarea
  categoryId           TEXT,
  startDate            TEXT,                   -- YYYY-MM-DD
  deadline             TEXT,                   -- YYYY-MM-DD
  completedAt          TEXT,                   -- ISO timestamp
  googleCalendarId     TEXT,                   -- calendarLink.calendarId (desnormalizado)
  googleCalendarEventId TEXT,                  -- calendarLink.eventId (desnormalizado)
  calendarSyncPending  INTEGER,                -- 0/1 (boolean SQLite)
  createdAt            TEXT NOT NULL,          -- ISO timestamp
  updatedAt            TEXT NOT NULL,          -- ISO timestamp
  data                 TEXT NOT NULL           -- JSON con todos los demás campos
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
  classesPerWeek INTEGER NOT NULL,   -- total de clases en el cuatrimestre (columna legacy; entity la lee como totalClasses)
  absences       INTEGER NOT NULL DEFAULT 0,
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);
```

**Nota sobre migraciones:** el schema arriba es el final. Para instalaciones nuevas (fresh data) no se necesitan migraciones — el `CREATE TABLE IF NOT EXISTS` ya crea todo correctamente. Las migraciones legacy en `db.ts` existen solo para upgrades de versiones anteriores.

---

## Dominio: Item

### Tipos base

```typescript
type RepeatRule = 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
type ItemStatus = 'active' | 'completed'
type ItemType = 'task' | 'goal'

interface ItemCategory {
  id: string
  name: string
  color: string
  icon: string  // nombre de icono lucide-react-native
}
```

### Campos de Item (BaseItem)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | ID único (`createId()`) |
| `title` | `string` | Requerido, se hace trim. Error si vacío |
| `description` | `string \| undefined` | Texto libre, trim |
| `type` | `'task' \| 'goal'` | Discriminante de variante |
| `status` | `'active' \| 'completed'` | Estado principal |
| `important` | `boolean \| undefined` | Prioridad alta |
| `reminderOnly` | `boolean` | Default: `false`. Si `true`: no tiene completación real |
| `repeatRule` | `RepeatRule \| undefined` | Regla de recurrencia |
| `repeatConfig` | `RepeatConfig \| undefined` | Detalle de recurrencia (must match repeatRule) |
| `parentId` | `string \| undefined` | Sub-meta / subtarea |
| `categoryId` | `string \| undefined` | ID de categoría |
| `location` | `string \| undefined` | Solo tareas |
| `startDate` | `string \| undefined` | `YYYY-MM-DD` |
| `startTime` | `string \| undefined` | `HH:mm` |
| `endDate` | `string \| undefined` | `YYYY-MM-DD` |
| `endTime` | `string \| undefined` | `HH:mm` |
| `deadline` | `string \| undefined` | `YYYY-MM-DD` |
| `reminderConfig` | `readonly ReminderConfig[] \| undefined` | Lista de recordatorios |
| `travelConfig` | `TravelConfig \| undefined` | Config de tiempo de viaje |
| `academicConfig` | `AcademicConfig \| undefined` | Config examen |
| `syncToCalendar` | `boolean \| undefined` | Si sync con Google. Auto-false si `reminderOnly=true` |
| `calendarLink` | `CalendarLink \| undefined` | Link a evento/task Google |
| `calendarSyncPending` | `boolean \| undefined` | Sync pendiente, retry automático |
| `notificationIds` | `readonly string[] \| undefined` | IDs de notifs programadas |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |
| `completedAt` | `string \| undefined` | ISO timestamp |

### Restricciones de Goal (validateGoalRestrictions)

Las metas NO pueden tener:
- `repeatRule` distinto de `none` ni `repeatConfig`
- `startDate`
- `location`
- `reminderConfig` con items

Solo categorías `personal | facultad | trabajo`.

### Restricciones de subtareas

Una subtarea (con `parentId`) no puede tener `repeatConfig`. Error: "Una subtarea no puede repetirse."

### Validaciones de fechas

- `deadline` no puede ser anterior a `startDate`
- Si hay `startDate` + `startTime` + `endDate/endTime`: el end debe ser posterior al start

### Namespace Item

```typescript
Item.create(input: NewItemInput): Item          // valida todo, lanza error en violaciones
Item.update(current, patch: ItemPatch): Item    // merge + revalidación
Item.hydrate(props: ItemProps): HydrationResult // para DB: devuelve {success,item}|{success:false,error}
Item.canComplete(item, subtasks): boolean       // todas las subtareas completadas
Item.idsToRemoveWith(items, subtasks): string[] // IDs del ítem + sus subtareas
Item.isReminderOnlyDue(item, now?): boolean     // reminderOnly + > 24h pasado
Item.complete(item, subtasks): Item             // marca completed + completedAt
Item.reopen(item): Item                         // activa completado
Item.linkCalendar(item, link|undefined): Item   // linkea/deslinkea + limpia calendarSyncPending
Item.markSyncPending(item): Item                // solo setea calendarSyncPending=true
Item.linkNotifications(item, ids): Item         // NO bumps updatedAt (es bookkeeping)
```

---

## Value objects de Item

### RepeatConfig

```typescript
interface RepeatConfigInput {
  unit: 'hour' | 'day' | 'week' | 'month' | 'year'
  interval: number                    // entero > 0
  daysOfWeek?: number[]               // 0=lun .. 6=dom. Solo para unit='week'
  end: 'never' | 'on_date' | 'after_occurrences'
  endDate?: string                    // YYYY-MM-DD. Solo si end='on_date'
  occurrences?: number                // Solo si end='after_occurrences'
  occurrencesDone?: number            // cuántas ya se completaron en esta serie
}
```

Correspondencia `RepeatRule` ↔ `RepeatConfig.unit`:
- `hourly` → `hour`
- `daily` → `day`
- `weekly` → `week`
- `monthly` → `month`
- `yearly` → `year`

Ejemplo real del JSON backup (tarea recurrente anual):
```json
{
  "repeatRule": "yearly",
  "repeatConfig": { "unit": "year", "interval": 1, "end": "never" }
}
```

Ejemplo con occurrencesDone:
```json
{
  "repeatRule": "daily",
  "repeatConfig": { "unit": "day", "interval": 1, "end": "never", "occurrencesDone": 1 }
}
```

### ReminderConfig

```typescript
interface ReminderConfigInput {
  id: string             // ID propio del reminder
  mode: 'relative' | 'departure'
  minutesBefore?: number // requerido. 0 = "al momento exacto"
  persistent?: boolean   // si el notification persiste (no desaparece al tocar)
  alarmType?: 'notification' | 'alarm'
}
```

Ejemplo real:
```json
{
  "id": "id-1786786357271-abb9c1fc2dd3f8",
  "mode": "relative",
  "minutesBefore": 0,
  "persistent": false,
  "alarmType": "notification"
}
```

`minutesBefore: 1440` = 1 día antes. `minutesBefore: 0` = exactamente en el momento.

### AcademicConfig

```typescript
interface AcademicConfigInput {
  studyTimeBefore?: 'half' | 'full'  // ½ día o 1 día laboral de estudio
  grade?: number                      // 0-10
}
```

Ejemplo real:
```json
{ "studyTimeBefore": "half" }
```

Solo aparece en tareas de categoría `facultad` cuyo título es detectado como examen.

### TravelConfig

```typescript
interface TravelConfigInput {
  transport: 'driving' | 'walking' | 'transit' | 'cycling'
  extraMinutes: number          // minutos buffer adicionales al tiempo de viaje
  departureReminderEnabled: boolean
}
```

### CalendarLink

```typescript
interface CalendarLinkInput {
  calendarId: string        // ID del calendario Google ("primary" para el principal)
  eventId: string           // ID del evento o task en Google
  lastSyncedAt: string      // ISO timestamp del último sync
  origin: 'app' | 'external' // 'app' si lo creó esta app; 'external' si vino de Calendar
  kind?: 'event' | 'task'   // 'event' para Calendar, 'task' para Google Tasks. Default: 'event'
}
```

Ejemplo de tarea importada desde Calendar (origin='external'):
```json
{
  "calendarLink": {
    "calendarId": "primary",
    "eventId": "dc9e6l8kg4dc61sq0ke8oeq070",
    "lastSyncedAt": "2026-08-15T08:57:15.091Z",
    "origin": "external",
    "kind": "event"
  },
  "syncToCalendar": false
}
```

**Regla clave:** las tareas importadas desde Google Calendar tienen `origin: 'external'` y `syncToCalendar: false` (la app no las modifica en Calendar).

---

## Dominio: Habit

```typescript
interface Habit {
  id: string
  title: string
  categoryId?: string          // solo: 'personal' | 'facultad' | 'casa' | 'salud'
  regularity: 'daily' | 'weekly' | 'monthly' | 'yearly'
  timesPerDay: number          // entero > 0. Default: 1
  reminder?: HabitReminderConfig
  notificationIds?: readonly string[]
  createdAt: string            // ISO timestamp
  updatedAt: string            // ISO timestamp
  regularityChangedAt?: string // ISO timestamp. Se setea cuando cambia regularity
}
```

**Persistencia en SQLite:** `reminder` y `notificationIds` se guardan como strings JSON.

Ejemplo real:
```json
{
  "reminder": "{\"mode\":\"random\",\"timesPerDay\":3,\"randomTimes\":[\"11:11\",\"19:04\",\"22:30\"]}",
  "notificationIds": "[\"46e80e44-71bc-4810-8e0b-6c06e45c8ab9\"]"
}
```

### HabitReminderConfig

```typescript
interface HabitReminderConfig {
  mode: 'interval' | 'random'
  intervalHours?: number       // horas entre notifs. Solo si mode='interval'. > 0
  timesPerDay?: number         // notifs por día. Solo si mode='random'. >= 1
  windowStart?: string         // 'HH:mm'. Ventana horaria inicio (opcional)
  windowEnd?: string           // 'HH:mm'. Ventana horaria fin (opcional). > windowStart
  randomTimes?: readonly string[] // tiempos 'HH:mm' sorteados. Requerido si mode='random'
}
```

### HabitOccurrence

```typescript
interface HabitOccurrence {
  id: string
  habitId: string
  occurredAt: string   // ISO timestamp del momento de ejecución
  source: 'manual' | 'notification'
  createdAt: string
  updatedAt: string
}
```

### HabitCompletion (en DB: habit_completions)

```typescript
{
  habitId: string
  date: string    // YYYY-MM-DD
  count: number   // cuántas ocurrencias hubo ese día
}
```

**Invariante crítica:** `habit_completions.count` SIEMPRE es igual al número de filas en `habit_occurrences` para ese `(habitId, date)`. El repositorio mantiene ambas tablas en sincronía transaccional en cada add/remove.

---

## Dominio: Subject

```typescript
interface Subject {
  id: string
  name: string
  totalClasses: number   // total de clases del cuatrimestre. DB column: classesPerWeek (legacy name, mapped by repository)
  absences: number
  createdAt: string
  updatedAt: string
}

interface NewSubjectInput {
  name: string
  totalClasses: number
}

interface SemesterConfig {
  startDate: string   // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
}

interface AttendanceStats {
  totalClasses: number
  classesElapsed: number      // clases transcurridas proporcionalmente (según fecha)
  maxAbsences: number         // floor(totalClasses * 0.25) — límite del 25%
  remainingAbsences: number   // maxAbsences - subject.absences
  attendancePercent: number | null   // null si el cuatrimestre no empezó
  status: 'ok' | 'warning' | 'danger' | 'exceeded'
}
```

`ATTENDANCE_REQUIRED = 0.75` (75% de asistencia mínima requerida).

`computeAttendance(subject, config: SemesterConfig): AttendanceStats` — calcula estadísticas de asistencia usando el progreso temporal del cuatrimestre.

**Status logic:**
- `exceeded` → `remainingAbsences < 0`
- `danger` → `remainingAbsences === 0`
- `warning` → `remainingAbsences === 1`
- `ok` → de lo contrario

**DB mapping:** columna `classesPerWeek` → campo entity `totalClasses` (renombramiento en el repositorio).

**SemesterConfig persistencia:** AsyncStorage, key `@agenda/semester_config_v1`. Default calculado automáticamente según mes actual (misma lógica que StudiesScreen: mar–jul = 1er cuatrimestre, ago–nov = 2do, dic–feb = 1er del año siguiente).

`createSubject(input)` usa su propio `generateId()` (no `createId()` del utils).

Ejemplo real:
```json
{ "id": "tovhc4j23kmsv71jut", "name": "Desarrollo de aplicaciones II", "totalClasses": 16, "absences": 1 }
```

---

## Dominio: Settings

```typescript
interface Settings {
  id: 'main'                          // siempre 'main'
  themePreference: 'system' | 'light' | 'dark'
  availableExamLeaveDaysPerYear: number  // default: 10
  selectedCalendarIds: readonly string[] // IDs de calendarios Google a mostrar
  locationPermissionRequested: boolean
  showCategoryIcons: boolean
}
```

Valores default:
```typescript
DEFAULT_SETTINGS = {
  id: 'main',
  themePreference: 'system',
  availableExamLeaveDaysPerYear: 10,
  selectedCalendarIds: [],
  locationPermissionRequested: false,
  showCategoryIcons: true,
}
```

Settings se persiste en AsyncStorage (NO en SQLite), key `agenda:main` (aproximado).

---

## Dominio: LicenseUsage

Licencias por examen. Usadas en StudiesScreen.

```typescript
interface LicenseUsage {
  id: string
  date: string        // YYYY-MM-DD — fecha del examen asociado
  days: number        // 0.5 (½ día) o 1 (día completo)
  note: string        // título del examen
}
```

Persistida en AsyncStorage.

---

## Categorías — fuente de verdad

```typescript
// DEFAULT_CATEGORIES (src/domain/settings/types.ts)
[
  { id: 'facultad', name: 'Facultad', color: '#A7DBD8', icon: 'GraduationCap' },
  { id: 'trabajo',  name: 'Trabajo',  color: '#E0E4CC', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#69D2E7', icon: 'Heart' },
  { id: 'casa',     name: 'Casa',     color: '#7DD4E2', icon: 'Home' },
  { id: 'salud',    name: 'Salud',    color: '#B8DDD1', icon: 'Cross' },
  { id: 'compras',  name: 'Compras',  color: '#E6E5C2', icon: 'ShoppingCart' },
]
```

| Scope | IDs permitidos |
|---|---|
| Tareas | `facultad, trabajo, personal, casa, salud, compras` |
| Metas | `facultad, trabajo, personal` |
| Hábitos | `personal, facultad, casa, salud` |

---

## Data del JSON backup (ejemplos reales de producción)

### Ejemplo: Goal con sub-metas

Meta padre con `categoryId` y `deadline`:
```json
{
  "id": "id-1786783860241-c41f3a4e5daf08",
  "type": "goal",
  "categoryId": "facultad",
  "deadline": "2026-12-31",
  "title": "Aprobar materias",
  "syncToCalendar": true,
  "calendarSyncPending": true,
  "notificationIds": ["...x4"]
}
```

Sub-meta con `parentId`, sin `categoryId` ni `deadline`:
```json
{
  "id": "id-1786783860263-6411adf2e94924",
  "type": "goal",
  "parentId": "id-1786783860241-c41f3a4e5daf08",
  "categoryId": null,
  "deadline": null,
  "title": "Api",
  "syncToCalendar": true,
  "notificationIds": []
}
```

### Ejemplo: Tarea recurrente reminderOnly

```json
{
  "type": "task",
  "title": "Tomar pastilla anticonceptiva",
  "reminderOnly": true,
  "repeatRule": "daily",
  "repeatConfig": { "unit": "day", "interval": 1, "end": "never" },
  "categoryId": "salud",
  "startDate": "2026-08-17",
  "startTime": "12:40",
  "reminderConfig": [{
    "id": "id-...",
    "mode": "relative",
    "minutesBefore": 0,
    "persistent": false,
    "alarmType": "notification"
  }],
  "syncToCalendar": false
}
```

### Ejemplo: Tarea con deadline + startDate + categoría compras

```json
{
  "type": "task",
  "title": "Devolución pastalinda",
  "categoryId": "compras",
  "startDate": "2026-08-26",
  "deadline": "2026-08-28",
  "syncToCalendar": false,
  "calendarLink": { "calendarId": "primary", "eventId": "...", "origin": "external", "kind": "event" }
}
```

### Ejemplo: Examen con academicConfig

```json
{
  "type": "task",
  "title": "Examen API",
  "categoryId": "facultad",
  "startDate": "2026-09-02",
  "startTime": "12:30",
  "academicConfig": { "studyTimeBefore": "half" },
  "syncToCalendar": true
}
```

### Ejemplo: Hábito con reminder random

```json
{
  "title": "Tomar agua",
  "categoryId": "salud",
  "regularity": "daily",
  "timesPerDay": 3,
  "reminder": { "mode": "random", "timesPerDay": 3, "randomTimes": ["11:11", "19:04", "22:30"] }
}
```

---

## Estado (State Management)

### Zustand — `src/state/googleAuthStore.ts`

Maneja solo sesión Google OAuth:
- `accessToken: string | null`
- `expiresAt: number | null` (unix ms)
- `connectedEmail: string | null`
- `authIssue: 'expired' | 'unauthorized' | null`

Persistido en AsyncStorage con key `agenda:google-auth` (partial, excluye las mutations).

Acciones: `setSession`, `markExpired`, `markUnauthorized`, `clearSession`.

`GOOGLE_TOKEN_TTL_SECONDS = 3600`. Scopes: `calendar` + `tasks`.

### TanStack React Query — capa application

- `QueryClient` instanciado en `App.tsx` via `useMemo`
- Query key principal: `['items']`
- Paginación de completadas: `loadMoreCompleted()`, `COMPLETED_PAGE_SIZE = 30`
- Todas las mutations invalidan `['items']` en éxito
- `updateMutation` hace optimistic update con `setQueryData`

### Estado local React

- Cada screen/modal maneja su propio UI state (search, activeCategory, undo toast, panel activo)
- `AppShellInner` (en `App.tsx`) controla qué modal está abierto globalmente

---

## Hooks background (montados en AppShellInner)

| Hook | Qué hace |
|---|---|
| `useGoogleSessionLifecycleMobile` | Refresh silencioso token Google al volver al foreground |
| `useCalendarDeleteQueue` | Reintenta deletes de Calendar fallidos (offline) |
| `useCalendarSyncRecovery` | Re-sincroniza ítems con `calendarSyncPending=true` |
| `useAutoPurgeCompleted` | Borra completadas > 60 días automáticamente |
| `useAutoRegenerateOverdueRecurring` | Adelanta recurrentes vencidas al próximo ciclo válido |
| `useAutoCompleteReminderOnly` | Auto-completa `reminderOnly` items pasados > 24h de su due moment |
| `useMarkOverdueGoals` | Marca goals vencidas (read-only, para display) |

---

## UI — Tab 1: Tareas (TaskScreen)

### Secciones (en orden de aparición)

| Sección | Criterio | Color header |
|---|---|---|
| **Vencidas** | Activas con `startDate` o `deadline` < hoy | Danger (rojo) |
| **HOY / Próximo / {fecha}** | Activas con fecha de hoy o futura | Primario |
| **Importante** | Activas sin fecha, `important=true` | Acento (naranja) |
| **Sin fecha** | Activas sin fecha ni importancia | Secundario |
| **Completadas** | Completadas (30 a la vez) | Apagado |

Las vencidas muestran "hace 1 hora", "hace 2 días", etc.

### Tipos de fila

| Tipo | Comportamiento |
|---|---|
| **Tarea local** | `SwipeableItemCard`: swipe + tap |
| **Evento Google Calendar** | Fila con dot de color, read-only. Tap → alerta "¿Importar como tarea?" |
| **Feriado** | Fila con dot de color, read-only |

### Filtros

- Campo de búsqueda: filtra por título, categoría y ubicación en tiempo real
- Chips de categoría (scroll horizontal): Todas · Facultad · Trabajo · Personal · Casa · Salud · Compras
- Con `showCategoryIcons=true`: chips muestran íconos

### Gestos SwipeableItemCard

| Gesto | Acción |
|---|---|
| Deslizar derecha | Completar (no disponible si ya completada o es `reminderOnly` recurrente) |
| Deslizar izquierda | Eliminar (confirmación) |
| Tap | Abre `ItemDetailModal` |

### Toast de deshacer

Tras completar por swipe → toast "Tarea completada" + "Deshacer" (4 segundos).

### Pista de gestos

Fila informativa: `← borrar · completar →` (visible cuando hay tareas).

### Paginación de completadas

Botón "Cargar más completadas" al pie de la sección. Carga de 30 en 30.

---

## UI — Tab 2: Facultad (StudiesScreen)

### Sección 1: Tarjeta resumen

Siempre visible. Contiene:
- Nombre del cuatrimestre (calculado automáticamente)
- Próxima fecha importante (examen más cercano + badge días)
- Contador de exámenes activos
- Contador de licencias libres (rojo si < 1; oculto si `availableExamLeaveDaysPerYear = 0`)

**Detección automática de cuatrimestre:**

| Meses | Cuatrimestre |
|---|---|
| Marzo – Julio | 1er cuatrimestre (año actual) |
| Agosto – Noviembre | 2do cuatrimestre (año actual) |
| Diciembre – Febrero | 1er cuatrimestre (año siguiente) |

### Sección 2: Licencias por examen

Solo visible si `availableExamLeaveDaysPerYear > 0`.

Barra horizontal segmentada:
- Rojo (danger) → días usados
- Naranja (#F38630) → días planificados
- Gris (border) → días libres

Lista "Planificadas": exámenes futuros con `studyTimeBefore`. Muestra "½ día" o "1 día".

Lista "Usadas": exámenes pasados con `studyTimeBefore`. Gris/apagado.

### Sección 3: Exámenes del cuatrimestre

Ítems activos de categoría `facultad` detectados como examen (`isExamTask`), dentro del cuatrimestre.

Colores de urgencia por días restantes:
- ≤ 3 días → rojo
- ≤ 7 días → naranja (#F38630)
- ≤ 14 días → primario
- > 14 días → gris

Tap → abre `ItemDetailModal`.

### Sección 4: Otras tareas de Facultad

Ítems activos de `categoryId='facultad'` que NO son examen. Ordenadas por fecha ascendente, sin fecha al final.

### Sección 5: Rendidos

Hasta 5 exámenes completados de `facultad`. Botón "Ver más" si hay > 5.

Badge de nota:
- `grade >= 4` → verde: "N ✓"
- `grade < 4` → rojo: "N — Recuperar"

### Sección 6: Seguimiento de asistencia

Materias (tabla `subjects`) con botones +/- para ausencias. Barra de progreso por materia. Botón para agregar/editar/eliminar materias.

`computeAttendance(subject)` calcula el % de asistencia.

---

## Detección de examen (`isExamTask`)

Keywords (substring, case-insensitive):
```
parcial, examen, final, recuperatorio, recuperacion, recuperación, recu,
integracion, integración, coloquio, quiz
```

Si el título contiene alguna **y** la categoría es `facultad` → aparecen campos académicos en `ItemDetailModal`.

---

## UI — Tab 3: Metas (GoalsScreen)

### Secciones

| Sección | Criterio |
|---|---|
| **Vencidas** | Activas con `deadline` < hoy. Muestra "Venció hoy" o "Venció hace N día(s)" |
| **Activas** | Activas con deadline futuro o sin deadline |
| **Cumplidas** | Completadas, ordenadas por `completedAt` desc |

Solo metas de nivel superior (`parentId = null`). Cada tarjeta muestra progreso de sub-metas.

### Filtros

Búsqueda por título y descripción. Chips: Todas · Facultad · Trabajo · Personal (cada chip usa color propio de la categoría, no el primario).

### Gestos

Iguales a Tareas. Deslizar derecha: si hay sub-metas incompletas → alerta "Completá todas las submetas primero".

### AddGoalSheet — modo crear

Hoja inferior (no pantalla completa).

Campos:
- Título + ★ (importante) en misma fila
- Descripción (multilínea)
- Fecha límite (calendario flotante con X para limpiar)
- Categoría: Facultad · Trabajo · Personal (chips con icono, color propio)
- Sub-metas: lista no guardada + input "Agregar submeta"

Al guardar: crea la meta → crea cada sub-meta con `parentId` apuntando a la meta nueva.

### AddGoalSheet — modo editar

Pantalla completa. Guarda automáticamente al cerrar.

Barra superior: ← (guardar + cerrar; si title vacío → alerta) | 🗑 (eliminar con confirmación).

Sub-metas en edición son objetos reales:
- Checkbox circular → completa/descompleta inmediatamente
- Título tachado si cumplida
- XCircle → elimina inmediatamente
- Input para nueva sub-meta → se guarda al instante

Barra inferior:
- "Marcar como cumplida" (habilitado si todas las sub-metas están completas o no tiene)
- "Marcar como cumplida" (deshabilitado/gris si hay sub-metas incompletas)
- "Marcar como no cumplida" (si ya está cumplida)

### Flujo de postergación (cambio de deadline)

Si la meta **ya tenía deadline** y se cambia por uno distinto (no se borra, se cambia):
1. El evento en Google Calendar se renombra `"[Pospuesto] Título"`
2. Meta original + todas sus sub-metas se eliminan localmente
3. Se crea una meta nueva con los datos actualizados
4. Se recrean las sub-metas bajo la nueva meta

---

## UI — Tab 4: Hábitos (HabitsScreen)

### Secciones

Agrupadas por regularidad del período **actual**:
- `Hoy` — hábitos `daily`
- `Esta semana` — hábitos `weekly`
- `Este mes` — hábitos `monthly`
- `Este año` — hábitos `yearly`

Header de sección: "Hoy · 2/5" (completados/total del período).

### HabitCard

- Streak (racha)
- Calendario semanal informativo (7 días Lun–Dom con dots de color)
- Conteo del día: `count / timesPerDay`

Para `timesPerDay = 1`: toggle tap (hecho/no hecho).

Para `timesPerDay > 1`: botón "+" registra una ocurrencia con timestamp. Toast de undo.

Chips expandibles de ocurrencias (timestamps del día) con modo de eliminación (×).

### AddHabitSheet

Campos:
- Título
- Categoría: Personal · Facultad · Casa · Salud
- Regularidad: Diario / Semanal / Mensual / Anual
- Veces por período (para `timesPerDay > 1`)
- Recordatorio: modo interval (cada N horas) o random (N veces al día en horarios sortados)
- Ventana horaria opcional para el recordatorio

### Filtro de categoría

Solo muestra categorías que tienen al menos un hábito.

### HabitStatsModal

Estadísticas del hábito seleccionado.

---

## QuickAddSheet (alta rápida de tareas)

Sheet con múltiples paneles (navegación interna, no stack):

1. **Panel principal**: título + chips NL detectados. Botones para abrir paneles de fecha, repetición, recordatorios y tiempo de viaje. Categoría selector. Botón guardar.
2. **Panel fecha**: calendario + hora de inicio + hora de fin + deadline
3. **Panel repetición**: `RepeatPanel` — regla, intervalo, días de semana (si weekly), fin de serie
4. **Panel recordatorios**: `ReminderPanel` — lista de recordatorios, tipo alarma/notificación
5. **Panel tiempo de viaje**: tipo de transporte, minutos extra, activar recordatorio de salida

### Parser NL (`quickInputParser.ts`)

Detecta en texto libre (español):
- **Fechas:** "hoy", "mañana", días de semana, `d/m[/yyyy]`, `d de {mes}`, nombres de meses, "mes que viene", "fin de año"
- **Horas:** `HH:mm` o `HH.mm`
- **Deadline:** "antes de {fecha}" / "hasta {fecha}"
- **Ubicación:** "en {lugar}" o "@{lugar}"

Los campos detectados aparecen como chips descartables (NlChip) debajo del input de título.

---

## ItemDetailModal (editor completo de tarea)

Editor full-screen para una tarea o meta (en modo tarea).

Campos disponibles (en tareas):
- Título + ★ importante
- Descripción
- Categoría (chips con colores)
- Fecha inicio + hora inicio + hora fin
- Fecha límite (deadline)
- Ubicación + autocompletar (Google Places)
- Repetición (RepeatPanel)
- Recordatorios (ReminderPanel)
- Tiempo de viaje (TravelConfig)
- Campos académicos (solo si `categoryId='facultad'` + `isExamTask=true`):
  - Día de estudio: Ninguno / ½ día / 1 día
  - Nota: input numérico 1-10 con badge en tiempo real
- Sync con Google Calendar (toggle)

Al cerrar: guarda si hay cambios. Si hay `academicConfig.studyTimeBefore` → upserta LicenseUsage.

---

## SettingsModal

Secciones:
- **Cuenta Google**: conectar/desconectar, calendarios seleccionados
- **Tema**: Sistema / Claro / Oscuro
- **Licencias por examen**: input numérico de días disponibles por año
- **Apariencia**: toggle "Mostrar íconos en categorías" (`showCategoryIcons`)
- **Notificaciones**: tipo de alarma global
- **Datos**: exportar JSON / importar JSON
- **Permisos**: solicitar permiso de ubicación

---

## Navegación

Solo `@react-navigation/bottom-tabs`. No hay stack navigator.

Edición → siempre en modals (`Modal` nativo de React Native).

El tab activo se trackea con `navigationRef` → `AppShellInner` → FAB (+) abre el modal correcto para el tab activo:
- Tab Tareas → `QuickAddSheet`
- Tab Metas → `AddGoalSheet`
- Tab Hábitos → `AddHabitSheet`
- Tab Facultad → `QuickAddSheet` (con `categoryId='facultad'` preseleccionada)

Headers:
- Tareas: fecha de hoy en español ("Domingo 16 de agosto") + botón ⚙ Settings
- Metas: "Metas {año}"

Tab bar: altura 70px + safe-area bottom inset.

---

## Sistema de tema

Sin ThemeContext. Patrón por prop:

```typescript
// En cada componente
const styles = useMemo(() => createStyles(colors), [colors])

function createStyles(colors: ThemeTokens) {
  return StyleSheet.create({ ... })
}
```

**Tokens principales (`src/mobile/theme/tokens.ts`):**

| Token | Light | Dark | Rol |
|---|---|---|---|
| `background` | blanco | `#0E191D` | Fondo principal |
| `primary` | `#69D2E7` | `#69D2E7` | Acción principal, tabs activos |
| `accent` | `#F38630` | `#F38630` | Importante, naranja |
| `danger` | `#FA6900` | `#FA6900` | Rojo para vencidas, alertas |
| `text` | oscuro | claro | Texto principal |
| `muted` | gris | gris | Texto secundario |
| `border` | gris claro | gris oscuro | Bordes, separadores |

`useAppTheme()` lee `Settings.themePreference` + `useColorScheme()` y devuelve el set correcto.

---

## Notificaciones Android

### Canales

| Canal | Importance | Stream | Efecto |
|---|---|---|---|
| `recordatorios` | HIGH | NOTIFICATION | Sonido normal, puede silenciarse |
| `alarmas` | MAX | ALARM | Bypasa DnD, suena siempre |

### Acción "Completar"

`ITEM_COMPLETION_ACTION_ID` — aparece en todas las notificaciones de **tareas** (no metas). Tocar completa la tarea sin abrir la app.

Manejado en `App.tsx`:
- `addNotificationResponseReceivedListener` → app abierta en foreground/background
- `getLastNotificationResponseAsync` → app estaba cerrada (se verifica al montar)

### Reglas de scheduling — Tareas

| Caso | Notificaciones generadas |
|---|---|
| Tarea con `startDate` + `startTime`, sin `reminderConfig` | 1 notif en `startDate` + `startTime` |
| Tarea con `reminderConfig[]` | 1 notif por cada reminder (`startTime - minutesBefore`) |
| Tarea con `deadline` (sin startDate) | 3 auto: día anterior 9:00, mismo día 9:00, día siguiente 9:00 ("Vencida") |
| Tarea con ambos `startDate` + `deadline` | Depende de si tiene `reminderConfig` o no |

### Reglas de scheduling — Metas

4 notificaciones automáticas al crear/actualizar una meta con `deadline`:

| Momento | Mensaje |
|---|---|
| 7 días antes (9:00) | "📅 Faltan 7 días" |
| 1 día antes (9:00) | "⚠️ Vence mañana" |
| Día del deadline (9:00) | "⚠️ Vence hoy" |
| Día siguiente (9:00) | "🔴 Meta vencida" |

Las metas **NO** tienen acción "Completar" en sus notificaciones.

### Permisos Android declarados

`RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `INTERNET`

---

## Integración Google

### Auth Android

`@react-native-google-signin/google-signin` v16. Silent sign-in al reconectar, interactive como fallback.

`useGoogleSessionLifecycleMobile.ts` → refresh silencioso al volver al foreground.

### Calendar (tareas y metas)

- Lee eventos de calendarios seleccionados (`settings.selectedCalendarIds`)
- Crea/actualiza/elimina eventos para tareas (`syncToCalendar=true`, `origin='app'`)
- Tareas importadas: `origin='external'`, `syncToCalendar=false` — la app no las modifica
- `calendarSyncPending=true` → retry automático por `useCalendarSyncRecovery`
- `useCalendarDeleteQueue` → reintenta deletes fallidos

### Tasks (metas)

- Google Tasks API
- Metas con deadline → Google Task en lista `@default`
- Al posponer → renombra a `"[Pospuesto] Título"` en Google Tasks + recrea ítem local

---

## Android: config nativa

### `android/app/build.gradle`

- `namespace` / `applicationId`: `com.agenda.personal`
- `versionCode`: 1, `versionName`: "1.0.0"
- Hermes habilitado
- JS bundle: Expo CLI `export:embed`
- Minificación release: `enableMinifyInReleaseBuilds = false`
- Firma release: debug keystore (producción no configurada)

### `android/app/src/main/AndroidManifest.xml`

- Deep link: `agendaapp://`
- `screenOrientation`: portrait
- `android:enableOnBackInvokedCallback="false"` (back button legacy)
- Firebase messaging metadata
- Expo Updates: `ENABLED = false`

---

## Convenciones de código

### Tipado nominal

```typescript
// En entidades de dominio — evita mezcla accidental de tipos
protected declare readonly _brand: void  // erased en runtime, solo tipo
```

Requiere `allowDeclareFields: true` en `babel.config.js`.

### Hidratación safe

`Item.hydrate()` y `Habit.hydrate()` devuelven `{ success, item } | { success: false, error }`. Filas corruptas no crashean la lista.

**Nueva data (Item.create + Item.update):** lanza errores descriptivos en español.

### Patch pattern (update)

```typescript
// 'field' in patch distingue "no mencionado" de "explícitamente borrado"
const value = 'field' in patch ? patch.field : current.field
```

### `withProps` — campos system-managed

Solo `Item.complete`, `Item.linkCalendar`, `Item.markSyncPending`, `Item.linkNotifications` pueden tocar sus campos respectivos. No usar `Item.update` para eso.

### `linkNotifications` no bumps `updatedAt`

Los IDs de notificación son bookkeeping, no un cambio de contenido.

### Recurrencia — invariantes

`repeatRule` y `repeatConfig.unit` deben coincidir siempre.

`buildNextOccurrence` genera el próximo ítem al completar uno. Copia todos los campos salvo `id`, `status`, `completedAt`, `occurrencesDone` (que incrementa). No copia `parentId` (una subtarea recurrente generaría un ítem huérfano — validación previene esto).

`catchUpOverdueOccurrence` hace catch-up de vencidas. Cap: 20,000 pasos por seguridad.

### Locale español

`date-fns/locale/es` en toda la app. Formato de fechas: "Domingo 16 de agosto".

---

## Tests

```bash
npm test              # vitest watch
npm run test:run      # una sola pasada (CI)
```

Tests en `src/**/*.test.ts`. El dominio (recurrencia, parser, streaks) es el más cubierto.

---

## Exportar / importar datos

`useDataExport` → `exportAllData.ts` → genera JSON con:
```json
{
  "exportedAt": "ISO",
  "items": [...],
  "habits": [...],
  "habitCompletions": [...],
  "habitOccurrences": [...],
  "subjects": [...]
}
```

`useDataImport` → `importAllData.ts` → reemplaza toda la data local con el JSON importado.

---

## UI: estilos exactos por componente

### Árbol de componentes raíz (App.tsx)

```
GestureHandlerRootView { flex: 1 }
  SafeAreaProvider
    QueryClientProvider
      AppShell
        AppShellInner
          StatusBar (translucent)
          NavigationContainer (tema derivado de ThemeTokens)
            MainTabs (bottom tabs)
              TaskScreen | StudiesScreen | GoalsScreen | HabitsScreen
          FloatingAddButton (solo si !isAnyModalOpen)
          QuickAddSheet (open si quickAddOpen && activeTab !== 'Metas' && !== 'Hábitos')
          AddGoalSheet (open si (quickAddOpen && activeTab === 'Metas') || editingGoalId)
          AddHabitSheet (open si (quickAddOpen && activeTab === 'Hábitos') || editingHabitId)
          ItemDetailModal (itemId = editingItemId)
          SettingsModal (open = settingsOpen)
```

`isAnyModalOpen = quickAddOpen || settingsOpen || editingItemId || editingGoalId || editingHabitId`

**Pantalla de loading** (antes de que Settings cargue):
```
View { flex: 1, backgroundColor: '#0E191D' | '#FFFFFF' }
```

**activeTab tracking:** `useNavigationContainerRef()` + `onReady` / `onStateChange` → `setActiveTab(navigationRef.getCurrentRoute()?.name ?? 'Tareas')`.

**Notificaciones — manejo en AppShellInner:**

```typescript
// Al montar:
void requestNotificationPermissions()
void registerHabitNotificationActions()
void registerItemNotificationActions()

// Dual listener para cubrir app cerrada Y en foreground:
const processed = new Set<string>()   // evita duplicados entre los dos caminos

// 1. App cerrada → tocó notif mientras no estaba activa:
void Notifications.getLastNotificationResponseAsync().then(response => {
  if (response) void handleResponse(response)
})

// 2. App abierta / background:
const subscription = Notifications.addNotificationResponseReceivedListener(response => {
  void handleResponse(response)
})
return () => subscription.remove()
```

**handleResponse logic:**
- `actionId === DEFAULT_ACTION_IDENTIFIER` + `itemId` → `setEditingItemId(itemId)` (abre ItemDetailModal)
- `actionId === ITEM_COMPLETION_ACTION_ID` + `itemId` → si no en `processed`:
  1. `processed.add(notifId)` + `setTimeout(() => processed.delete(notifId), 30_000)`
  2. `Notifications.dismissNotificationAsync(notifId)` (descarta la notif)
  3. `itemRepository.getById(itemId)` → si existe y no completada:
     - `Item.complete(item, subtasks)` → `cancelItemNotifications(item)` → `Item.linkNotifications(completed, [])` → `itemRepository.save(linked)`
     - `queryClient.invalidateQueries({ queryKey: ['items'] })`

**navTheme** agrega `notification: colors.accentStrong` además de los tokens estándar.

---

### Tema completo — ThemeTokens exactos

#### Light

| Token | Valor |
|---|---|
| `primary` | `#69D2E7` |
| `primarySoft` | `#7DD4E2` |
| `secondary` | `#A7DBD8` |
| `secondarySoft` | `#B8DDD1` |
| `cream` | `#E0E4CC` |
| `creamSoft` | `#E6E5C2` |
| `accent` | `#F38630` |
| `accentSoft` | `#F58B27` |
| `accentStrong` | `#FA6900` |
| `accentStrongSoft` | `#FB6D00` |
| `overlayAccent` | `rgba(38, 50, 56, 0.2)` |
| `background` | `#FFFFFF` |
| `surface` | `#FFFFFF` |
| `surfaceSecondary` | `#FFFFFF` |
| `surfaceElevated` | `#FFFFFF` |
| `border` | `#E9F1F2` |
| `borderStrong` | `#D8E8EA` |
| `text` | `#263238` |
| `textSecondary` | `#4D6168` |
| `textMuted` | `#7A8C93` |
| `success` | `#A7DBD8` |
| `warning` | `#F38630` |
| `danger` | `#FA6900` |
| `fabText` | `#FFFFFF` |
| `onPrimary` | `#263238` |

#### Dark

| Token | Valor |
|---|---|
| `primary` | `#69D2E7` (igual) |
| `background` | `#0E191D` |
| `surface` | `#111F24` |
| `surfaceSecondary` | `#192B30` |
| `surfaceElevated` | `#16272C` |
| `border` | `rgba(167, 219, 216, 0.14)` |
| `borderStrong` | `rgba(167, 219, 216, 0.22)` |
| `text` | `#F5F7F4` |
| `textSecondary` | `#B2BEBB` |
| `textMuted` | `#7F9190` |
| `overlayAccent` | `rgba(14, 25, 29, 0.72)` |
| `onPrimary` | `#0E191D` |
| (accent, danger, success, cream, etc.) | igual a light |

---

### Tab bar (MainTabs.tsx)

```typescript
tabBarStyle: {
  height: 70 + insets.bottom,   // TAB_BAR_HEIGHT = 70
  paddingTop: 8,
  paddingBottom: 8 + insets.bottom,
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
  borderTopWidth: 1,
}
tabBarActiveTintColor: colors.primary      // #69D2E7
tabBarInactiveTintColor: colors.textMuted
```

#### Headers

```typescript
headerStyle: { backgroundColor: colors.background }
headerTitleStyle: { fontSize: 28, fontWeight: '800', color: colors.text }
```

- **Tab Tareas**: title = fecha hoy capitalizada (`"Domingo 16 de agosto"`). Botón Settings a la derecha.
- **Tab Metas**: title = `"Metas 2026"`.
- **Tab Facultad / Hábitos**: sin title customizado (usa el nombre del tab).

#### Botón Settings (header derecho — Tab Tareas)

```typescript
// Pressable
{ marginRight: 14, borderWidth: 1, borderRadius: 999, padding: 8,
  backgroundColor: colors.surface, borderColor: colors.border }
// Icono
<Settings color={colors.textSecondary} size={18} />
```

#### Íconos de tabs

| Tab | Icono (lucide) |
|---|---|
| Tareas | `ListTodo` |
| Facultad | `GraduationCap` |
| Metas | `Target` |
| Hábitos | `Flame` |

---

### FloatingAddButton

```typescript
// Animated.View con animación de scale 0.94 → 1 (200ms) al montar
// Pressable base:
position: 'absolute'
right: 18
bottom: insets.bottom + 70 + 28   // bottom seguro sobre tab bar
width: 58, height: 58
borderRadius: 999
borderWidth: 1
alignItems: 'center', justifyContent: 'center'
backgroundColor: colors.accent          // normal: #F38630
backgroundColor: colors.accentStrong    // pressed/hovered: #FA6900
borderColor: colors.accentSoft          // #F58B27
shadowColor: colors.accent
shadowOffset: { width: 0, height: 8 }
shadowOpacity: 0.28 (light) / 0.34 (dark)
shadowRadius: 12
elevation: 6

// Ícono
<Plus size={24} color={colors.fabText} />  // fabText = #FFFFFF

// onPressIn: scale → 0.96 (120ms)
// onPressOut: scale → 1 (160ms)
```

---

### TaskScreen

#### Container

```typescript
flex: 1
backgroundColor: colors.background
paddingHorizontal: 16
paddingTop: 10
```

#### SearchInput

```typescript
backgroundColor: colors.surface
borderWidth: 1
borderColor: colors.borderStrong
borderRadius: 14
paddingHorizontal: 14
paddingVertical: 11
marginBottom: 12
color: colors.text
fontSize: 16
placeholder: "Buscar por título, categoría o ubicación"
placeholderTextColor: colors.textMuted
```

#### FiltersWrapper (contenedor de chips de categoría)

```typescript
// ScrollView horizontal
marginBottom: 14
paddingVertical: 4
// contentContainerStyle:
flexDirection: 'row', gap: 8, alignItems: 'center', paddingRight: 12
```

#### FilterChip (chip de categoría)

```typescript
// Base:
backgroundColor: colors.surface
borderWidth: 1, borderColor: colors.border
borderRadius: 999
minHeight: 36
paddingHorizontal: 14
justifyContent: 'center'

// Activo:
backgroundColor: colors.primary    // #69D2E7
borderColor: colors.primary

// Con icono (showCategoryIcons = true):
flexDirection: 'row', alignItems: 'center', gap: 6
// Icono: size={13}

// Texto base:
fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textSecondary

// Texto activo:
color: '#FFFFFF', fontWeight: '800'
```

#### Colores de chips de categoría (light mode)

| CategoryId | Background | Border | Texto |
|---|---|---|---|
| `facultad`, `salud` | `colors.secondarySoft` | `colors.secondary` | `colors.text` |
| `trabajo`, `compras` | `colors.creamSoft` | `colors.cream` | `colors.text` |
| `casa` | `colors.primarySoft` | `colors.primary` | `colors.text` |

#### Colores de chips dark mode (backgrounds)

| CategoryId | Background |
|---|---|
| `personal` | `colors.surfaceSecondary` |
| `facultad`, `salud` | `rgba(167, 219, 216, 0.25)` |
| `trabajo`, `compras` | `rgba(224, 228, 204, 0.9)` |
| `casa` | `rgba(105, 210, 231, 0.25)` |

#### SectionTitle

```typescript
fontSize: 14
textTransform: 'uppercase'
letterSpacing: 0.8
marginBottom: 8, marginLeft: 3
fontWeight: '800'
// color según sección:
overdue   → colors.danger   (#FA6900)
important → colors.accent   (#F38630)
later     → colors.secondary (#A7DBD8)
completed → colors.textMuted
next      → colors.primary  (#69D2E7)
```

#### Fila de feriado / evento Google Calendar

```typescript
// googleInlineRow:
flexDirection: 'row', alignItems: 'flex-start', gap: 14
backgroundColor: colors.surface
borderBottomWidth: 1, borderColor: colors.border
paddingVertical: 14

// googleDot:
width: 10, height: 10, borderRadius: 999, marginTop: 5

// googleCardTitle:
fontSize: 17, fontWeight: '500', color: colors.text

// googleCardMeta:
fontSize: 14, color: colors.textSecondary, marginTop: 3

// holidayTypeLabel:
fontSize: 12, fontWeight: '700', marginTop: 3
textTransform: 'uppercase', letterSpacing: 0.4
color: entry.color  // color del feriado
```

#### Pista de swipe

```typescript
// swipeHintRow:
paddingTop: 2, paddingBottom: 10, alignItems: 'center'
// swipeHintText:
fontSize: 11, color: colors.textMuted, letterSpacing: 0.3
// Texto: "← borrar · completar →"
```

#### Toast de undo

```typescript
position: 'absolute'
bottom: 96
left: 16, right: 16
backgroundColor: colors.text
borderRadius: 12
paddingVertical: 14, paddingHorizontal: 16
flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
elevation: 8
shadowColor: '#000', shadowOffset: { width: 0, height: 4 }
shadowOpacity: 0.25, shadowRadius: 8

// Texto "Tarea completada":
fontSize: 14, color: colors.background, fontWeight: '500'

// Texto "Deshacer":
fontSize: 14, color: colors.accent, fontWeight: '700'
```

#### Estado vacío (sin tareas)

```typescript
// emptyState:
flex: 1, alignItems: 'center', justifyContent: 'center'
paddingTop: 72, paddingHorizontal: 28

// emptyIconWrap:
width: 38, height: 38, borderRadius: 999
backgroundColor: colors.primarySoft
alignItems: 'center', justifyContent: 'center', marginBottom: 12
// Ícono: <CalendarDays size={18} color={colors.primary} />

// emptyTitle: fontSize: 19, fontWeight: '800', color: colors.text
// "Todo tranquilo por ahora"

// emptySubtitle: fontSize: 15, color: colors.textSecondary, marginTop: 4, textAlign: 'center'
// "No tenes nada pendiente para hoy."
```

#### Botón "Cargar más completadas"

```typescript
// loadMoreButton:
alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 4
// loadMoreText: color: colors.primary, fontSize: 14, fontWeight: '700'
```

#### listContent (FlatList)

```typescript
paddingBottom: 104
minHeight: '78%'
```

---

### SwipeableItemCard

```typescript
// Swipeable config:
friction: 2
rightThreshold: 80    // deslizar derecha = completar
leftThreshold: 80     // deslizar izquierda = eliminar

// completeAction (derecha):
backgroundColor: colors.success    // #A7DBD8
width: 72
justifyContent: 'center', alignItems: 'center'
// Texto: "✓", fontSize: 22, fontWeight: '700', color: '#FFFFFF'

// deleteAction (izquierda):
backgroundColor: colors.danger     // #FA6900
width: 72
justifyContent: 'center', alignItems: 'center'
// Ícono: <Trash2 size={22} color="#FFFFFF" />
```

La acción de completar (right) no se renderiza si `item.status === 'completed'` o `item.reminderOnly === true`.

---

### ItemCard

#### Card container

```typescript
backgroundColor: colors.surface
borderRadius: 0            // NO redondeo — separación por línea
paddingVertical: 16, paddingHorizontal: 4
borderBottomWidth: 1, borderColor: colors.border
borderLeftWidth: 3, borderLeftColor: 'transparent'

// Si important === true:
borderLeftColor: '#F38630'
backgroundColor: '#F38630' + '0D'   // naranja muy transparente
```

#### Row principal

```typescript
flexDirection: 'row', gap: 14
```

#### Checkbox (círculo izquierdo)

```typescript
width: 28, height: 28
borderRadius: 999
borderWidth: 1.6
borderColor: item.reminderOnly ? colors.accent : indicatorColor
backgroundColor: colors.surface
alignItems: 'center', justifyContent: 'center'

// Completado:
backgroundColor: colors.success    // #A7DBD8
borderColor: colors.success

// Para metas activas: muestra CategoryGlyph (icono) en lugar de checkbox vacío
```

#### Colores del indicador (resolveIndicatorColor)

| Condición | Color |
|---|---|
| `status === 'completed'` | `colors.success` (#A7DBD8) |
| `type === 'goal'` | según urgencia (ver abajo) |
| deadline ≤ 0 días | `colors.danger` |
| deadline ≤ 3 días | `colors.warning` |
| default | `colors.primary` |

#### Urgencia de meta (resolveGoalUrgencyColor)

| Días hasta deadline | Color |
|---|---|
| sin deadline | `colors.cream` |
| ≤ 0 (vencida) | `colors.danger` |
| ≤ 3 | `colors.accentStrong` |
| ≤ 7 | `colors.accentSoft` |
| ≤ 14 | `colors.accent` |
| ≤ 30 | `colors.primary` |
| > 30 | `colors.cream` |

#### Textos del card

```typescript
// title: fontSize: 17, fontWeight: '500', color: colors.text
// done (tachado): textDecorationLine: 'line-through', color: colors.textMuted

// overdueDeadlineLabel (ej. "Venció hace 2 días"):
fontSize: 14, color: colors.danger, marginTop: 3, fontWeight: '600'

// overdueLabel (ej. "hace 3 horas"):
fontSize: 14, color: colors.danger, marginTop: 3, fontWeight: '400'

// meta (hora, deadline, descripción):
fontSize: 14, color: colors.textSecondary, marginTop: 3

// goalCountdown (ej. "Faltan 15 días"):
fontSize: 14, color: indicatorColor, fontWeight: '600', marginTop: 3

// locationMeta (📍 dirección):
fontSize: 14, color: colors.textMuted, marginTop: 3
// Es un Pressable que abre Google Maps

// dateLabel = startTime + deadline formateado ("9:00 - Fecha límite: 16 ago")
```

#### Indicadores de icono (esquina derecha)

```typescript
// indicatorStack:
flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6

// Íconos mostrados (cuando aplica):
<Star size={16} color="#F38630" fill="#F38630" />              // important
<Bell size={16} color={colors.accent} />                       // reminderOnly
<CalendarCheck size={16} color="#4285F4" />                    // calendarLink (azul Google)
<Repeat size={16} color={colors.textMuted} />                  // repeatRule activo
<AlarmClock size={17} color={colors.accent} />                 // alarmType === 'alarm'
<Bell size={17} color={colors.primary} />                      // alarmType === 'notification'
// AlarmClock tiene prioridad sobre Bell si hay ambos tipos
```

#### Barra de progreso de subtareas

```typescript
// progressRow:
flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8

// progressBarTrack:
flex: 1, height: 4, borderRadius: 999
backgroundColor: colors.border, overflow: 'hidden'

// progressBarFill:
height: 4, borderRadius: 999, backgroundColor: colors.primary
width: `${(subtaskDone / subtasks.length) * 100}%`

// progressLabel:
fontSize: 12, color: colors.textMuted, fontWeight: '600'
// Texto: "N de M"

// Chevron: ChevronDown/ChevronUp size={16} color={colors.textMuted}
```

#### Subtareas expandidas

```typescript
// subtaskRow:
flexDirection: 'row', alignItems: 'center', gap: 10
paddingVertical: 6, paddingLeft: 4, marginTop: 2

// subtaskCheck:
width: 18, height: 18, borderRadius: 999, borderWidth: 1.6
borderColor: colors.borderStrong
// completada: backgroundColor: colors.primary, borderColor: colors.primary
// Ícono: <Check size={12} color="#FFFFFF" /> si completada

// subtaskTitle:
fontSize: 14, color: colors.text, flex: 1
// completada: textDecorationLine: 'line-through', color: colors.textMuted
```

---

### GoalsScreen

#### Layout base

```typescript
flex: 1
// container:
backgroundColor: colors.background
paddingHorizontal: 16, paddingTop: 10
```

#### SearchInput (igual a TaskScreen)

placeholder: `"Buscar metas o categorías"`

#### Filter chips de metas

Chips: Todas · Facultad · Trabajo · Personal. Siempre con ícono (no condicional).

```typescript
// Chip activo: usa el COLOR PROPIO de la categoría, NO el primary
isCategoryActive && { backgroundColor: category.color, borderColor: category.color }
// Ícono color: isCategoryActive ? '#FFFFFF' : colors.textMuted
```

#### SectionHeader

```typescript
// sectionHeader base:
fontSize: 14, fontWeight: '800', textTransform: 'uppercase'
letterSpacing: 0.8, marginBottom: 8, marginLeft: 3
color: colors.textSecondary  // "Activas"

// color: colors.danger para "Vencidas"
```

**Nota:** "Activas" solo muestra el header si también existe sección "Vencidas". Si solo hay activas, van directas sin header.

#### Toast de undo (metas)

Igual al de TaskScreen pero dura 4 segundos. Texto: "Meta completada" + "Deshacer".

#### Estado vacío (sin ninguna meta)

```typescript
// emptyState: flex: 1, alignItems: 'center', justifyContent: 'center'
// emptyIconWrap: igual a TaskScreen
// Ícono: <Target size={18} color={colors.primary} />
// emptyTitle: "Sin metas todavía"
// emptySubtitle: "Agregá una con el botón +"
```

---

### HabitsScreen

#### Estructura de secciones

Las secciones siguen el orden fijo: `['daily', 'weekly', 'monthly', 'yearly']`. Solo se renderizan las que tienen hábitos.

Header de sección: `"Hoy · 2/5"` — regularity label + conteo completados/total del período.

#### Chips de categoría (HabitsScreen)

Solo muestra categorías que tienen al menos 1 hábito (`usedCategoryIds`).

#### Toast de hábitos

Dura **3200ms** (no 4000ms como tareas/metas).

```typescript
// Texto: "✓ {titulo} · HH:mm" (hora de la ocurrencia registrada)
// Botón: "Deshacer" → llama removeOccurrence
```

#### Filter chips en HabitsScreen

```typescript
// Igual a TaskScreen pero solo muestra categorías usadas
// FilterChip activo: backgroundColor: colors.primary, borderColor: colors.primary
```

---

### HabitCard

#### Card container

```typescript
backgroundColor: colors.surface
paddingVertical: 14, paddingHorizontal: 4
borderBottomWidth: 1, borderColor: colors.border
```

#### Row principal

```typescript
flexDirection: 'row', alignItems: 'center', gap: 12
```

#### Leading (izquierda, tap = registrar/toggle)

```typescript
width: 44, height: 44, alignItems: 'center', justifyContent: 'center'
```

**Si `weekStatus` existe y no está expandido y no es `isMultiDay`:** muestra `ProgressRing`:
```typescript
<ProgressRing size={44} progress={doneThisWeek / 7} color={accentColor}
  label={isTodayDone ? '✓' : `${doneThisWeek}/7`} />
```

**En otro caso:** muestra iconCircle:
```typescript
// iconCircle:
width: 44, height: 44, borderRadius: 999
alignItems: 'center', justifyContent: 'center'
backgroundColor: isMultiDay ? accentColor + '18' : accentColor + '22'

// Contenido:
// isMultiDay → <Text "＋" fontSize: 22, fontWeight: '800', color: accentColor>
// isTodayDone → <Check size={20} color={accentColor} strokeWidth={3} />
// default → <CategoryGlyph iconName size={20} color={accentColor} />
```

El `accentColor` = `category.color` del hábito, o `colors.primary` si no tiene categoría.

#### Content (centro, tap = abrir editor)

```typescript
flex: 1

// titleRow:
flexDirection: 'row', alignItems: 'center'

// title: fontSize: 16, fontWeight: '600', color: colors.text, flex: 1, numberOfLines: 1

// todayValue (N/M a la derecha del título):
fontSize: 13, color: colors.primary, fontWeight: '700'
// Si count > timesPerDay: color: colors.accent (naranja — sobre la meta)

// categoryRow (nombre de categoría con ícono):
flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2
// Ícono: CategoryGlyph size={12} color={colors.textMuted}
// Texto: fontSize: 12, color: colors.textMuted
```

#### Barra de progreso (dentro del card)

```typescript
// progressBarTrack: height: 4, borderRadius: 999
backgroundColor: colors.border, overflow: 'hidden', marginTop: 8

// progressBarFill: height: 4, borderRadius: 999, backgroundColor: accentColor
// width: `${Math.min((displayCount / timesPerDay) * 100, 100)}%`

// progressMetaRow: flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8
// progressCaption: fontSize: 12, color: colors.textMuted
// metaCaption ("Meta cumplida"): fontSize: 12, color: colors.primary, fontWeight: '700'
```

#### Trailing (derecha)

```typescript
trailing: { alignItems: 'flex-end', gap: 6 }

// streakBadge (si streak > 0):
flexDirection: 'row', alignItems: 'center', gap: 4
backgroundColor: colors.surfaceSecondary
borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3
// <Flame size={13} color={colors.accent} />
// streakText: fontSize: 13, fontWeight: '700', color: colors.text

// ChevronDown/ChevronUp: size={18}, color={colors.textMuted}
```

#### Accordion expandido

```typescript
accordion: { marginTop: 14 }
expandedSection: { marginBottom: 14 }

// sectionTitle (dentro del accordion):
fontSize: 11, color: colors.textMuted, fontWeight: '700'
textTransform: 'uppercase', letterSpacing: 0.8
```

##### Sección "Hoy" (chips de ocurrencias — solo isMultiDay)

```typescript
// occurrencesRow: flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center'

// occurrenceChip (normal):
backgroundColor: colors.surfaceSecondary
borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong
paddingHorizontal: 8, paddingVertical: 5
// texto: fontSize: 11, fontWeight: '700', color: colors.textSecondary — hora "HH:mm"

// occurrenceChipEdit (modo edición — muestra X):
+ flexDirection: 'row', alignItems: 'center', gap: 6
paddingLeft: 8, paddingRight: 6
// "×": fontSize: 15, fontWeight: '700', color: colors.textMuted

// occurrenceChipMore ("+N"):
// mismos estilos que occurrenceChip
```

Muestra hasta 4 chips, luego "+N más". "Editar" arriba a la derecha cuando hay ocurrencias.

##### Sección "Esta semana" (weekStatus — hábitos daily)

```typescript
// weekRow: flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2

// weekDay: alignItems: 'center', gap: 6
// isFuture: opacity: 0.35

// weekDayLabel: fontSize: 12, color: colors.textMuted, fontWeight: '600'
// Labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// weekDot: width: 24, height: 24, borderRadius: 999, borderWidth: 1.6, borderColor: colors.borderStrong
// done: backgroundColor: accentColor, borderColor: accentColor
// partial: backgroundColor: accentColor + '33', borderColor: accentColor
```

##### Barra de período (weekly/monthly/yearly)

```typescript
// periodProgressTrack: height: 8, borderRadius: 999  (MÁS GRUESA que la barra diaria)
// backgroundColor: colors.border, overflow: 'hidden', marginTop: 8

// periodProgressFill: height: 8, borderRadius: 999, backgroundColor: accentColor
```

##### Fila de resumen + botón rápido

```typescript
// daySummaryRow: flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2
// daySummaryText: fontSize: 13, color: colors.textSecondary, fontWeight: '700', flexShrink: 1

// quickAddButton:
width: 42, height: 42, borderRadius: 21
backgroundColor: colors.primary

// Si hasTodayEntry && isTodayDone:
backgroundColor: accentColor
// Contenido: <Check size={20} color="#FFFFFF" strokeWidth={3} />

// Si isTodayDone (sin entry):
backgroundColor: 'transparent', borderWidth: 1.5, borderColor: accentColor
// Contenido: "＋" en accentColor

// Default:
backgroundColor: colors.primary
// Contenido: "＋" en #FFFFFF, fontSize: 24, fontWeight: '700', lineHeight: 24
```

##### Links de acción (dentro del accordion)

```typescript
// accordionActions: flexDirection: 'row', gap: 20, paddingTop: 4
// statsLinkRow: flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 12
// Ícono: <BarChart3 size={15} color={colors.primary} />  /  <Edit2 size={15} color={colors.primary} />
// statsLinkText: fontSize: 14, color: colors.primary, fontWeight: '600'
// Textos: "Ver estadísticas" | "Editar hábito"
```

---

### QuickAddSheet (`src/mobile/modals/QuickAddSheet.tsx`)

`transparent={true}`, `animationType="slide"`. Tres paneles internos (`Panel = 'main' | 'date' | 'repeat'`).

**Panel repeat** → `RepeatPanel` (full-screen, se monta fuera del Modal igual que DateTimePicker).

**Estado:** usa "adjust during render" (no `useEffect`) para resetear al abrir: `wasOpen` state comparado con prop `open` — si cambió, resetea todo antes del paint.

**BackHandler:** cierra sub-overlays primero (deadlinePicker → reminderSetupUntilPicker → reminderSetupOpen → directDeadline → panel repeat → panel date → onClose).

#### createStyles — QuickAddSheet

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }

sheet: {
  backgroundColor: colors.surface
  borderTopLeftRadius: 20, borderTopRightRadius: 20
  borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1
  borderColor: colors.border
  paddingHorizontal: 20, paddingTop: 10
}

datePanelSheet: { maxHeight: '92%' }

dragHandle: {
  width: 36, height: 4, borderRadius: 2
  backgroundColor: colors.border
  alignSelf: 'center', marginBottom: 14
}

mainInput: {
  fontSize: 18, color: colors.text
  minHeight: 48, maxHeight: 120, marginBottom: 4, padding: 0
}

inlineDescInput: {
  fontSize: 15, color: colors.textSecondary
  minHeight: 24, maxHeight: 80, marginBottom: 8, padding: 0
}

categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }
categoryChips: { flexDirection: 'row', gap: 6, alignItems: 'center' }
categoryChip: {
  borderWidth: 1, borderColor: colors.border
  borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4
  backgroundColor: colors.surface
}
categoryChipText: { fontSize: 12, color: colors.textSecondary }

chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }

// Día de estudio (solo si facultad + isExamTask):
studyTimeRow: { marginBottom: 8 }
studyTimeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 }
studyTimeChips: { flexDirection: 'row', gap: 6 }
studyTimeChip: {
  borderWidth: 1, borderColor: colors.border
  borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4
  backgroundColor: colors.surface
}
studyTimeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary

// Badge de fecha seleccionada (debajo del input):
dateBadge: {
  flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start'
  gap: 5
  backgroundColor: colors.primary + '18'    // deadline solo badge: colors.accent + '18'
  borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5
  marginBottom: 8
}
dateBadgeText: { fontSize: 13, color: colors.primary, fontWeight: '500', flexShrink: 1 }
// deadline solo badge: color: colors.accent

// Barra de acciones:
actionBar: {
  flexDirection: 'row', alignItems: 'center'
  justifyContent: 'space-between', marginTop: 10
}
actionIcons: { flexDirection: 'row', alignItems: 'center', gap: 0, marginLeft: -8 }
// ActionIcon Pressable: { padding: 8, borderRadius: 8, opacity: pressed ? 0.6 : 1 }
// Icono: size={22}, color = active ? (activeColor ?? colors.primary) : colors.textMuted

saveBtn: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingVertical: 6, paddingHorizontal: 4 }
saveBtnDisabled: { color: colors.textMuted }

// Panel fecha:
optionsSeparator: { height: 1, backgroundColor: colors.border, marginVertical: 4 }
syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 }
syncRowLabel: { fontSize: 15, color: colors.text, flex: 1, marginRight: 12 }

datePanelFooter: {
  flexDirection: 'row', justifyContent: 'flex-end', gap: 24
  paddingTop: 12, borderTopWidth: 1, borderColor: colors.border, marginTop: 4
}
footerBtn: { paddingVertical: 8 }
footerBtnText: { fontSize: 15 }
// Cancelar: color: colors.textSecondary; Listo: color: colors.primary, fontWeight: '700'

// Overlays (popup cards sobre el sheet):
deadlineOverlay: {
  ...StyleSheet.absoluteFill, justifyContent: 'center'
  alignItems: 'center', paddingHorizontal: 24
}
deadlineCard: {
  width: '100%', maxWidth: 340
  backgroundColor: colors.surfaceElevated, borderRadius: 20
  padding: 20, borderWidth: 1, borderColor: colors.border
  elevation: 12
}
deadlineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }
deadlineCardTitle: { fontSize: 16, fontWeight: '700', color: colors.text }
deadlineRemoveRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border, alignItems: 'center' }
deadlineRemoveText: { fontSize: 14, color: colors.textMuted }

// Subtareas:
subtaskSection: { marginBottom: 8 }
subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 }
subtaskCheck: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.8, borderColor: colors.borderStrong }
subtaskTitle: { fontSize: 15, color: colors.text, flex: 1 }
subtaskInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }
subtaskInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 }

// Ubicación:
locationInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, marginBottom: 4 }
locationInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 }
suggestionsContainer: {
  backgroundColor: colors.surfaceSecondary, borderRadius: 10
  marginBottom: 6, overflow: 'hidden', borderWidth: 1, borderColor: colors.border
}
suggestionItem: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 8
  paddingVertical: 10, paddingHorizontal: 12
  borderBottomWidth: 1, borderColor: colors.border
}
suggestionText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }

// Reminder setup overlay (modo reminderOnly):
reminderSetupRow: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.border
}
reminderSetupLabel: { fontSize: 15, color: colors.text }
reminderSetupValue: { fontSize: 15, fontWeight: '600', color: colors.text }
reminderStepBtn: {
  width: 28, height: 28, borderRadius: 14, borderWidth: 1
  borderColor: colors.primary + '55'
  alignItems: 'center', justifyContent: 'center'
}
reminderUnitChip: {
  borderWidth: 1, borderColor: colors.border, borderRadius: 999
  paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surface
}
reminderUnitChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.accent, borderColor: colors.accent, color: '#fff'
```

#### Overlay "Modo recordatorio" (reminderOnly setup)

Se abre cuando el usuario toca el icono `AlarmClock`. Usa `deadlineCard` / `deadlineOverlay`.

Título: "Modo recordatorio". Campos:
- **Hora de inicio** (tap → DateTimePicker fuera del Modal)
- **Repetir cada** — botones ± para `interval` (≥1) + chips `horas | días`
- **Hasta (opcional)** — tap → MonthCalendar popup con `accentColor = colors.accent`

Footer: "Cancelar" | "Listo" → setea `scheduledDate`, `scheduledTime`, `repeatRule` (`hourly` o `daily`), `repeatConfig`, `reminderOnly = true`.

#### ActionIcons en panel main

| Icono | Label | Activo cuando |
|---|---|---|
| `AlignLeft` | Detalles | `showDescInput` o `description.trim()` |
| `Clock` | Fecha y hora | `effectiveDate` existe |
| `Flag` | Fecha límite | `effectiveDeadline`; `activeColor = colors.accent` |
| `ListChecks` | Subtareas | `showSubtasksInput` o `pendingSubtasks.length > 0` |
| `MapPin` | Dirección | `showLocationInput` o `location` |
| `Star` | Importante | `important`; `activeColor = '#F38630'` |
| `AlarmClock` | Recordatorio recurrente | `reminderOnly`; `activeColor = colors.accent` |

#### Panel fecha — OptionRows

| Label | Icono | Valor |
|---|---|---|
| "Establecer hora" | `Clock` | `tempTime` si habilitado |
| "Hasta" | `Clock` | `tempEndTime` (solo si timeEnabled) |
| "Repetir" | `Repeat` | `repeatLabel` |
| "Fecha límite" | `Flag` | `fmtShort(tempDeadline)` |
| "Recordatorio" | `Bell` | "N activos" |

`syncToCalendar` Switch solo aparece si hay `accessToken`. Todos los DateTimePicker se montan **fuera** del Modal.

---

### NlChip (QuickAddSheet — chips del parser NL)

```typescript
flexDirection: 'row', alignItems: 'center'
backgroundColor: colors.primarySoft + '33'    // muy transparente
borderRadius: 20
paddingHorizontal: 10, paddingVertical: 4
gap: 4
borderWidth: 1, borderColor: colors.primary + '55'

// Texto: fontSize: 13, color: colors.primary, fontWeight: '500'
// X: size={12} color={colors.primary}, hitSlop={8}
```

---

### Formateo de fechas vencidas (formatOverdueDuration)

| Condición | Texto |
|---|---|
| < 24h, == 1h | "hace 1 hora" |
| < 24h, > 1h | "hace N horas" |
| 1 día | "hace 1 día" |
| 2-6 días | "hace N días" |
| 7-13 días | "hace 1 semana" |
| 14-20 días | "hace 2 semanas" |
| 21-27 días | "hace 3 semanas" |
| 28-59 días | "hace 1 mes" |
| ≥ 60 días | "hace N meses" |

---

### Formateo de urgencia de metas (GoalsScreen)

```typescript
// días = differenceInCalendarDays(hoy, deadline)
days <= 0  → "Venció hoy"
days === 1 → "Venció hace 1 día"
days > 1   → "Venció hace N días"

// En ItemCard (goalCountdown):
days <= 0  → "Vence hoy"
days === 1 → "Vence mañana"
days > 1   → "Faltan N días"
```

---

### StudiesScreen (`src/mobile/screens/StudiesScreen.tsx`)

```typescript
container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 14, paddingTop: 10 }
content: { paddingBottom: 32 }

// Tarjeta resumen del cuatrimestre:
summaryCard: {
  backgroundColor: colors.surface, borderRadius: 16
  borderWidth: 1, borderColor: colors.border
  padding: 14, marginBottom: 16, gap: 10
}
summaryTitle: {
  fontSize: 11, fontWeight: '700', color: colors.textMuted
  textTransform: 'uppercase', letterSpacing: 0.8
}
summaryNextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }
summaryNextDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.primary }
summaryNextLabel: { fontSize: 11, color: colors.primary, fontWeight: '600', marginBottom: 1 }
summaryNextExam: { fontSize: 15, fontWeight: '600', color: colors.text }
summaryDaysBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center' }
summaryDaysNumber: { fontSize: 18, fontWeight: '700', color: colors.onPrimary, lineHeight: 22 }
summaryDaysLabel: { fontSize: 10, color: colors.onPrimary, fontWeight: '500' }
summaryEmpty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }
summaryFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }
summaryFooterText: { fontSize: 12, color: colors.textMuted }
summaryFooterValue: { fontWeight: '700', color: colors.textSecondary }
summaryFooterDot: { fontSize: 12, color: colors.border }

// Headers de sección:
sectionHeader: {
  fontSize: 12, fontWeight: '700', color: colors.textMuted
  textTransform: 'uppercase', letterSpacing: 0.7
  marginBottom: 8, marginLeft: 2
}
card: {
  backgroundColor: colors.surface, borderRadius: 14
  borderWidth: 1, borderColor: colors.border
  marginBottom: 16, overflow: 'hidden'
}

// Fila de examen:
examRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }
examRowBorder: { borderTopWidth: 1, borderColor: colors.border }
examUrgencyBar: { width: 3, height: 36, borderRadius: 2 }   // color = urgencyColor(days)
examContent: { flex: 1 }
examTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 }
examMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 }
examMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 }
examMetaText: { fontSize: 11, color: colors.textMuted }

// Badge de días (derecha de cada examen):
daysBadge: {
  borderWidth: 1.5, borderRadius: 10   // borderColor = urgencyColor(days)
  paddingHorizontal: 8, paddingVertical: 4
  alignItems: 'center', minWidth: 44
}
daysNumber: { fontSize: 16, fontWeight: '700', lineHeight: 20 }   // color = urgencyColor(days)
daysLabel: { fontSize: 9, fontWeight: '500' }

// urgencyColor: days≤3 → danger; days≤7 → '#F38630'; days≤14 → primary; >14 → textMuted

// Otras tareas de facultad:
taskRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }
taskRowBorder: { borderTopWidth: 1, borderColor: colors.border }
taskDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.border }
taskTitle: { fontSize: 14, fontWeight: '500', color: colors.text }   // overdue: colors.danger
taskDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 }
overdueBadge: { backgroundColor: colors.danger + '20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }
overdueBadgeText: { fontSize: 11, fontWeight: '600', color: colors.danger }

// Rendidos (completados):
completedTitle: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through', flex: 1, marginLeft: 6 }
gradeBadge: {
  borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2
  // passed: bg success+'20', border success+'55'; failed: bg danger+'20', border danger+'55'
}
gradeBadgeText: { fontSize: 11, fontWeight: '600' }

// Licencias por examen:
licenseBarSection: { padding: 14, gap: 10 }
licenseBarTrack: {
  height: 10, borderRadius: 999, flexDirection: 'row'
  overflow: 'hidden', backgroundColor: colors.border
}
licenseBarFill: { height: 10 }   // flex = days/totalDays; color = danger/orange/'#F38630'/border
licenseBarLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' }
legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }
legendDot: { width: 8, height: 8, borderRadius: 999 }
legendText: { fontSize: 12, color: colors.textSecondary }
licenseListSection: {
  borderTopWidth: 1, borderColor: colors.border
  paddingHorizontal: 14, paddingVertical: 10
}
licenseListTitle: {
  fontSize: 11, fontWeight: '700', color: colors.textMuted
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8
}
licenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }
licenseRowBorder: { borderTopWidth: 1, borderColor: colors.border }
licenseDot: { width: 8, height: 8, borderRadius: 999 }
licenseNote: { fontSize: 14, fontWeight: '500', color: colors.text }   // pasadas: color: textMuted
licenseDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 }
licenseDays: { fontSize: 13, fontWeight: '600', color: colors.text }
licenseEmpty: { padding: 14, gap: 2 }

// Asistencia (Seguimiento de materias):
attendanceDateRow: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  paddingHorizontal: 14, paddingVertical: 10
  borderBottomWidth: 1, borderColor: colors.border
}
attendanceDateText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' }
dateEditRow: {
  flexDirection: 'row', alignItems: 'center', gap: 6
  paddingHorizontal: 14, paddingVertical: 10
  borderBottomWidth: 1, borderColor: colors.border
}
dateInput: {
  flex: 1, height: 34, borderWidth: 1, borderColor: colors.border
  borderRadius: 8, paddingHorizontal: 8, fontSize: 13, color: colors.text
  backgroundColor: colors.surfaceSecondary
}
dateArrow: { fontSize: 14, color: colors.textMuted }
dateSaveBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }
dateSaveBtnText: { fontSize: 13, fontWeight: '600', color: colors.onPrimary }
attendanceEmpty: { padding: 14 }
subjectRow: {
  flexDirection: 'row', alignItems: 'center'
  paddingHorizontal: 14, paddingVertical: 12, gap: 10
}
subjectRowBorder: { borderTopWidth: 1, borderColor: colors.border }
subjectName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }
absenceBarTrack: {
  height: 6, borderRadius: 999, flexDirection: 'row'
  overflow: 'hidden', backgroundColor: colors.border, marginBottom: 4
}
absenceBarFill: { height: 6 }
// barColor: ok → success; warning → accent; danger/exceeded → danger
absenceLabel: { fontSize: 11, color: colors.textMuted }   // exceeded: color: colors.danger
absenceBtns: { flexDirection: 'row', gap: 6 }
absenceBtn: {
  width: 32, height: 32, borderRadius: 16
  borderWidth: 1.5, borderColor: colors.border
  alignItems: 'center', justifyContent: 'center'
}
absenceBtnText: { fontSize: 18, fontWeight: '400', color: colors.textSecondary, lineHeight: 22 }

// Agregar materia:
addSubjectRow: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.border }
addSubjectText: { fontSize: 14, color: colors.primary, fontWeight: '600' }
addSubjectForm: { borderTopWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }
addSubjectInput: {
  height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10
  paddingHorizontal: 10, fontSize: 14, color: colors.text
  backgroundColor: colors.surfaceSecondary
}
classesPerWeekRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }
classesLabel: { flex: 1, fontSize: 13, color: colors.textSecondary }
classesValue: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 20, textAlign: 'center' }
addFormActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 2 }
cancelText: { fontSize: 14, color: colors.textMuted }
saveBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 }
saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.onPrimary }
```

**Edición de materia:** tap en la materia abre inline edit con TextInput para nombre + botones ±1 para `totalClasses`. Long-press → Alert de confirmación para eliminar.

**SemesterConfig edit:** botón lápiz junto a la barra de fechas → TextInput inline para startDate/endDate (formato YYYY-MM-DD) + botón "OK".

---

### NavigationContainer — tema

El `NavigationContainer` recibe un tema derivado de `DefaultTheme` de React Navigation con:
```typescript
{
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  }
}
```

---

### Patrones de accesibilidad

Todos los `Pressable` interactivos tienen:
- `accessibilityRole="button"`
- `accessibilityLabel` descriptivo en español

Ejemplos:
- HabitCard leading: `"Registrar una vez {habit.title}"` / `"Marcar {habit.title} como completado"`
- weekDot: `"Marcar Lunes"` / `"Desmarcar Martes"` / `"Miércoles (fecha futura)"`
- occurrenceChipEdit: `"Eliminar registro de las HH:mm"`

---

## Documentación interna de features

Los archivos en `docs/` tienen toda la lógica de UX detallada:

- `docs/tareas.md` — TaskScreen completo, QuickAddSheet (todos los paneles), ItemDetailModal, reglas de notificación
- `docs/metas.md` — GoalsScreen, AddGoalSheet (crear vs editar), flujo de postergación, notificaciones
- `docs/habits-flow.md` — arquitectura `habit_completions` vs `habit_occurrences`, invariantes, checklist de tests
- `docs/facultad.md` — StudiesScreen, detección de exámenes, campos académicos, licencias

---

## Utility: id.ts

```typescript
// src/utils/id.ts
export const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
```

Todos los IDs de dominio se generan con `createId()`. No usar `uuid` ni nanoid — esta función funciona tanto en Hermes como en entornos de test.

---

## DI Container (`src/app/container.ts`)

Único lugar que instancia repositorios. Singletons exportados directamente:

```typescript
export const itemRepository: ItemRepository = new SQLiteItemRepository()
export const habitRepository: HabitRepository = new SQLiteHabitRepository()
export const subjectRepository: SubjectRepository = new SQLiteSubjectRepository()
export const settingsRepository: SettingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository: CalendarRepository = new GoogleCalendarRepository()
export const taskRepository: TaskRepository = new GoogleTasksRepository()
```

Los hooks de `application/` importan directamente desde este archivo. No hay provider de DI — es simple module-level singleton.

---

## Modales: estilos pixel-exact

### ItemDetailModal (`src/mobile/modals/ItemDetailModal.tsx`)

Modal full-screen (`animationType="slide"`, `transparent={false}`, `statusBarTranslucent`). El componente exportado es un thin wrapper con `key={itemId}` que fuerza remount al cambiar de item.

#### Fondo / header

```typescript
container: { flex: 1, backgroundColor: colors.background }

header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 }
headerBtn: { padding: 8 }
```

**Header buttons:** `ChevronLeft` (back/save) · `Star` (importante, fill: `#F38630` cuando activo) · `AlarmClock` (reminderOnly) · `Trash2` (eliminar, hitSlop 12)

#### ScrollView

```typescript
scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }

titleInput: { fontSize: 26, fontWeight: '600', color: colors.text, marginBottom: 24, padding: 0 }
titleCompleted: { textDecorationLine: 'line-through', color: colors.textMuted }
```

#### Filas de detalle

```typescript
detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8 }
syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingVertical: 8 }
syncRowLabel: { fontSize: 15, color: colors.text, flex: 1, marginRight: 12 }
rowIcon: { marginRight: 16 }
detailRowInput: { flex: 1, fontSize: 16, color: colors.textMuted, padding: 0 }
detailRowPlaceholder: { fontSize: 16, color: colors.textMuted }
rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 36 }
```

#### Chips genéricos (fecha, hora, repetir, deadline)

```typescript
chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
        borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12,
        paddingVertical: 5, backgroundColor: colors.surface }
chipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' }
```

#### Categorías (detailModal)

```typescript
categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }
categoryChips: { flexDirection: 'row', gap: 8, paddingRight: 8 }
categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
                paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.surface }
categoryChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activa: backgroundColor: colors.primary, borderColor: colors.primary
// Texto activa: color: '#FFFFFF', fontWeight: '700'
```

#### Sugerencia de categoría (AI-detected)

```typescript
categorySuggestionRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 36,
                          marginTop: -4, marginBottom: 6, gap: 6 }
categorySuggestionLabel: { fontSize: 13, color: colors.textMuted, flex: 1 }
categorySuggestionName: { color: colors.primary, fontWeight: '600' }
categorySuggestionAccept: { backgroundColor: colors.primary, borderRadius: 999,
                             paddingHorizontal: 10, paddingVertical: 3 }
categorySuggestionAcceptText: { fontSize: 12, color: colors.onPrimary, fontWeight: '600' }
```

#### Campos académicos

```typescript
studyTimeRow: { paddingHorizontal: 4, paddingVertical: 10 }
studyTimeLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 8, marginLeft: 2 }
studyTimeChips: { flexDirection: 'row', gap: 8 }
studyTimeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
                 paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.surface }
studyTimeChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary
// Texto activo: color: '#FFFFFF', fontWeight: '700'

gradeRow: { paddingHorizontal: 4, paddingVertical: 10 }
gradeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }
gradeInput: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary,
              color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              fontSize: 16, fontWeight: '600', width: 72, textAlign: 'center' }
gradeResultBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }
gradeResultText: { fontSize: 13, fontWeight: '600' }
// Aprobado (≥ 4): borderColor colors.success, color colors.success
// Recuperar (< 4): borderColor colors.warning, color colors.warning
```

#### Sugerencias de ubicación (Google Places)

```typescript
suggestionsContainer: { marginLeft: 36, marginBottom: 4, backgroundColor: colors.surfaceSecondary,
                          borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }
suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10,
                  paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.border }
suggestionText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }
```

#### Subtareas

```typescript
subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 36, gap: 12 }
subtaskCheck: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.8,
                borderColor: colors.borderStrong, backgroundColor: 'transparent' }
// Completada: backgroundColor: colors.success, borderColor: colors.success
subtaskTitle: { fontSize: 15, color: colors.text, flex: 1 }
done: { textDecorationLine: 'line-through', color: colors.textMuted }
```

#### Bottom bar (Marcar como completada)

```typescript
bottomBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border }
// paddingBottom: Math.max(insets.bottom + 8, 20)

completeBtn: { backgroundColor: colors.primary + '22', borderRadius: 999, paddingVertical: 14, alignItems: 'center' }
completeBtnDisabled: { backgroundColor: colors.border }
completeBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary }
// Deshabilitado: color: colors.textMuted
```

#### Card de configuración de reminderOnly / Modo repetición

```typescript
reminderSetupCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surfaceElevated,
                     borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border,
                     shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                     shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 }

reminderSetupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }
reminderSetupTitle: { fontSize: 16, fontWeight: '700', color: colors.text }
reminderSetupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.border }
reminderSetupLabel: { fontSize: 15, color: colors.text }
reminderSetupValue: { fontSize: 15, fontWeight: '600', color: colors.text }

reminderStepBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1,
                   borderColor: colors.primary + '55', alignItems: 'center', justifyContent: 'center' }

reminderUnitChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
                    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surface }
reminderUnitChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.accent, borderColor: colors.accent, color: '#fff'

reminderSetupFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24,
                        paddingTop: 12, borderTopWidth: 1, borderColor: colors.border, marginTop: 4 }
```

#### Tipo de recordatorio (reminderOnly mode)

```typescript
reminderTypeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4,
                   paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                   borderWidth: 1, borderColor: colors.border }
reminderTypeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
reminderTypeBtnAlarm: { borderColor: colors.accent, backgroundColor: colors.accent + '15' }
reminderTypeBtnText: { fontSize: 12, color: colors.textSecondary }
```

#### Panel de recordatorios (remindersPanel inline)

```typescript
remindersPanel: { backgroundColor: colors.surfaceSecondary, borderRadius: 10,
                  marginLeft: 36, marginBottom: 4, overflow: 'hidden' }
```

#### Lógica de navegación / cierre

1. `BackHandler` en Android intercepta el botón físico: si `reminderOnlyUntilPickerOpen` → cierra el picker; si `reminderSetupOpen` → cierra el panel; de lo contrario → `handleClose()`.
2. `handleClose()` guarda el item automáticamente (`updateItem` o `createItem` + LicenseUsage si `studyTimeBefore`).
3. Los pickers `DateTimePicker` se renderizan **fuera** del `<Modal>` para evitar el problema de diálogos anidados en Android.

---

### AddGoalSheet (`src/mobile/modals/AddGoalSheet.tsx`)

Dual mode: **compact sheet** (crear) vs **full-screen** (editar, `fullScreen = isEditing`).

**Compact sheet** presenta como bottom sheet (`transparent={true}`, overlay oscuro).  
**Full-screen edit** es `transparent={false}`, idéntico a ItemDetailModal.

#### Sheet (modo crear)

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }
sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
         borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
         paddingHorizontal: 20, paddingTop: 10 }
dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 14 }
```

#### Full screen (modo editar)

```typescript
fullScreen: { flex: 1 }
fullScreenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }
headerBtn: { padding: 8 }
fullScreenContent: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }
fullScreenFooter: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }
```

#### Inputs

```typescript
titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 }
mainInput: { flex: 1, fontSize: 18, color: colors.text, minHeight: 40, maxHeight: 100, padding: 0 }
descriptionInput: { fontSize: 15, color: colors.textSecondary, minHeight: 24, maxHeight: 80, marginTop: 4, padding: 0 }
optionsSeparator: { height: 1, backgroundColor: colors.border, marginTop: 4 }
```

#### Categorías (GOAL_CATEGORIES — 3 opciones)

```typescript
categoryRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 }
categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
                borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12,
                paddingVertical: 6, backgroundColor: colors.surface }
categoryChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: cat.color, borderColor: cat.color
// Texto activo: color: '#FFFFFF', fontWeight: '700'
```

#### Submetas

```typescript
subgoalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }
subgoalCheck: { width: 20, height: 20, borderRadius: 999, borderWidth: 1.8,
                borderColor: colors.borderStrong, backgroundColor: 'transparent' }
// Completada: backgroundColor: colors.success, borderColor: colors.success
subgoalTitle: { fontSize: 15, color: colors.text, flex: 1 }
subgoalTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted }
subgoalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }
subgoalInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 }
```

#### OptionRow (fechas)

```typescript
// Inline, no en createStyles. paddingVertical: 14, gap 14 entre ícono y label.
// Valor: fontSize: 14, color: colors.primary, fontWeight: '500'
// Sin valor: "—" en colors.textMuted
```

#### ActionBar / botones

```typescript
actionBar: { flexDirection: 'row', alignItems: 'center', marginTop: 14 }
completeBtn: { flex: 1, backgroundColor: colors.primary + '22', borderRadius: 999,
               paddingVertical: 14, alignItems: 'center' }
completeBtnDisabled: { backgroundColor: colors.border }
completeBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary }
saveBtn: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingVertical: 6, paddingHorizontal: 4 }
saveBtnDisabled: { color: colors.textMuted }
```

#### Deadline picker (popup card — igual en ambos modos)

```typescript
deadlineOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }
deadlineCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surfaceElevated,
                borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border,
                elevation: 12 }
deadlineCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }
deadlineCardTitle: { fontSize: 16, fontWeight: '700', color: colors.text }
```

#### Lógica de cierre

- Compact sheet (crear): "Guardar" llama `createItem` + submetas pendientes → `onClose()`.
- Full-screen (editar): back = `handleClose()` que llama `updateItem` automáticamente.
- "Marcar como cumplida": `Item.canComplete(item, subgoals)` + `toggleCompleted`. Si se completa por primera vez, llama `onClose()`.

---

### AddHabitSheet (`src/mobile/modals/AddHabitSheet.tsx`)

Dual mode idéntico a AddGoalSheet: compact sheet (crear) / full-screen (editar).

#### Sheet

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }
sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
         borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
         paddingHorizontal: 20, paddingTop: 10, maxHeight: '86%' }
sheetScroll: { flexGrow: 1 }
sheetContent: { paddingBottom: 8 }
dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 14 }
```

#### Full-screen

```typescript
fullScreenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }
headerBtn: { padding: 8 }
fullScreenTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginLeft: 4 }
fullScreenContent: { paddingHorizontal: 20, paddingTop: 6 }
```

#### Input principal

```typescript
mainInput: { fontSize: 18, color: colors.text, minHeight: 40, maxHeight: 100, padding: 0 }
optionsSeparator: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 4 }
```

#### Labels de sección

```typescript
fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted,
              textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 }
```

#### Chips (regularity, categoría, modo recordatorio)

```typescript
chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
        paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface }
chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary
// Texto activo: color: '#FFFFFF', fontWeight: '700'
// Categoría activa: backgroundColor: cat.color, borderColor: cat.color
```

#### Counter card (timesPerDay)

```typescript
counterCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 16, borderWidth: 1,
               borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, marginTop: 2 }
counterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }
counterHeaderText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }
counterMetaText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' }
counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }
counterButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary + '18',
                 alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                 borderColor: colors.primary + '44' }
counterButtonDisabled: { opacity: 0.45 }
counterButtonText: { fontSize: 28, lineHeight: 28, color: colors.primary, fontWeight: '600' }
counterValue: { flex: 1, textAlign: 'center', fontSize: 36, fontWeight: '800', color: colors.text, lineHeight: 42 }
counterBarTrack: { height: 6, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden', marginTop: 12 }
counterBarFill: { height: 6, borderRadius: 999, backgroundColor: colors.primary }
// width: Math.min(100, (timesPerDay / 20) * 100) + '%'
metaNote: { fontSize: 12, color: colors.textMuted, marginTop: 8, lineHeight: 18 }
```

#### Recordatorios de hábito

```typescript
reminderToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }
fieldLabelInline: { fontSize: 15, color: colors.text, fontWeight: '500' }
reminderPanel: { gap: 12, paddingTop: 4, paddingBottom: 10 }
reminderFieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
reminderFieldLabel: { fontSize: 14, color: colors.textSecondary }
numberInput: { width: 64, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border,
               borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center' }

// Botón "Sortear horarios":
rerollBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
             paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
             backgroundColor: colors.primary + '18' }
rerollBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' }

// Chips de hora aleatoria:
randomTimesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }
timeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceSecondary }
timeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' }

// Ventana horaria (desde/hasta):
windowRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }
windowField: { flex: 1 }
windowValue: { fontSize: 15, color: colors.primary, fontWeight: '600', marginTop: 2 }
```

#### ActionBar (solo compact)

```typescript
actionBar: { flexDirection: 'row', alignItems: 'center', marginTop: 14 }
saveBtn: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingVertical: 6, paddingHorizontal: 4 }
saveBtnDisabled: { color: colors.textMuted }
fieldError: { fontSize: 12, color: '#E53E3E', marginTop: 4 }
saveHint: { fontSize: 12, color: colors.textMuted, flex: 1, paddingRight: 8 }
```

#### Lógica de cierre

- Compact: "Guardar" llama `createHabit` → `onClose()`.
- Full-screen: back = `handleClose()` → `updateHabit` si `hasChanges`. Si cambió la regularidad y hay historial, muestra Alert de confirmación antes de guardar.
- `buildReminderPayload()`: si modo `interval`, requiere intervalHours > 0; si modo `random`, genera `randomTimes` automáticamente al guardar si están vacíos.

---

### SettingsModal (`src/mobile/modals/SettingsModal.tsx`)

Full-screen, `transparent={false}`, `animationType="slide"`.

```typescript
fullScreen: { flex: 1 }
header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }
headerBtn: { padding: 8 }
content: { paddingHorizontal: 16 }
title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 10 }
section: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
           borderRadius: 14, padding: 10, marginBottom: 10 }
sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }
metaText: { color: colors.textSecondary, fontSize: 12 }
warnText: { color: colors.danger, fontSize: 12, marginTop: 4 }
actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 }
switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }
inputWithUnit: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }
input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
         color: colors.text, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 }
```

#### Tema (3 chips)

```typescript
themeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }
themeOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 999,
               paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceSecondary }
themeOptionSystem: { backgroundColor: colors.primarySoft, borderColor: colors.primary }
themeOptionLight: { backgroundColor: colors.secondarySoft, borderColor: colors.secondary }
themeOptionDark: { backgroundColor: colors.creamSoft, borderColor: colors.cream }
themeOptionText: { color: colors.textSecondary, fontWeight: '600', fontSize: 12 }
themeOptionTextActive: { color: colors.onPrimary }
```

#### Botones

```typescript
primaryButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }
primaryButtonText: { color: colors.fabText, fontWeight: '700' }
secondaryButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
                   borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }
secondaryButtonText: { color: colors.textSecondary, fontWeight: '700' }
disabled: { opacity: 0.4 }
dangerButton: { backgroundColor: colors.danger + '18', borderWidth: 1, borderColor: colors.danger + '55',
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                marginTop: 6, alignItems: 'center' }
dangerButtonText: { color: colors.danger, fontWeight: '600', fontSize: 14 }
```

#### Secciones del modal

1. **Tema** — chips Sistema / Claro / Oscuro, `saveSettings({ themePreference: mode })`
2. **Google Calendar** — estado conexión, email, botón Conectar/Reconectar/Desconectar, lista de calendarios seleccionables
3. **Recordatorios** (Android only) — links a `openExactAlarmSettings()` y `openNotificationSoundSettings()`
4. **Licencias por examen** — input numérico de `availableExamLeaveDaysPerYear`
5. **Categorías** — toggle `showCategoryIcons`
6. **Datos** — Exportar JSON, Cargar backup, Borrar completadas

Google Auth: Native usa `@react-native-google-signin/google-signin` v16 (no browser redirect). Web usa `expo-auth-session`. La distinción es `Platform.OS === 'web'`.

---

### HabitStatsModal (`src/mobile/modals/HabitStatsModal.tsx`)

Bottom sheet, `transparent={true}`, `animationType="slide"`.

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }
sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
         borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
         paddingHorizontal: 20, paddingTop: 10 }
dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
              alignSelf: 'center', marginBottom: 14 }
header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }
headerText: { flex: 1, marginRight: 12 }
title: { fontSize: 18, fontWeight: '800', color: colors.text }
subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 }

fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted,
              textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 18, marginBottom: 10 }
statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 }
statBox: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 14,
           paddingVertical: 12, paddingHorizontal: 14 }
statLabel: { fontSize: 12, color: colors.textMuted }
statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 }
emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center',
             marginTop: 28, marginBottom: 12, lineHeight: 20 }
```

Estadísticas mostradas: Racha actual · Mejor racha · Períodos completados · Promedio (semanal/mensual/anual según regularidad). Si el hábito tiene historial anterior (de cuando cambió regularidad), muestra sección "Historial anterior".

---

### MonthCalendar (`src/mobile/components/MonthCalendar.tsx`)

Componente reutilizable embebido en modales (no en screen). Siempre 6 filas (42 celdas) para que el calendario no salte de altura entre meses.

```typescript
monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 4, marginBottom: 12 }
monthLabel: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }
weekdayRow: { flexDirection: 'row', marginBottom: 4 }
weekdayLabel: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontWeight: '600',
                color: colors.textMuted, paddingVertical: 4 }
// Labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D']

calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }
calCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }
calDayMarker: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }
// Seleccionado: backgroundColor: accentColor
// Hoy (no seleccionado): borderWidth: 1, borderColor: accentColor
calDayText: { fontSize: 14, color: colors.text }
calDayTextSelected: { color: colors.onPrimary, fontWeight: '700' }
// Hoy (no seleccionado): color: accentColor, fontWeight: '700'
```

Props: `selectedDate?: string` (YYYY-MM-DD) · `onSelectDate: (dateStr) => void` · `colors: ThemeTokens` · `accentColor?: string` (default: `colors.primary`)

---

### ProgressRing (`src/mobile/components/ProgressRing.tsx`)

SVG ring usando `react-native-svg`. Dos círculos concéntricos: track (colors.border) + fill (color prop).

```typescript
// radius = (size - strokeWidth) / 2
// circumference = 2 * Math.PI * radius
// dashOffset = circumference * (1 - clamp(progress, 0, 1))
// Rotación: -90° desde el origen para empezar en el tope

// Label central:
fontSize: size * 0.26, fontWeight: '800', color: color
position: 'absolute'
```

Props: `size: number` · `strokeWidth?: number` (default 4) · `progress: 0..1` · `color: string` · `label: string`

---

### ReminderPanel (`src/mobile/components/ReminderPanel.tsx`)

Panel compartido entre ItemDetailModal y QuickAddSheet. Aceptar props `indent` y `rowDividers` para adaptarse a cada contexto.

```typescript
container: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, marginBottom: 4, overflow: 'hidden' }
containerIndented: { marginLeft: 36 }  // solo en ItemDetailModal

// Recordatorio ya agregado:
addedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
            paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }
addedText: { flex: 1, fontSize: 14, color: colors.text }

// Pill de tipo (Notif./Alarma):
typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8,
            paddingVertical: 3, borderRadius: 999, borderWidth: 1,
            borderColor: colors.primary + '60' }
typePillAlarm: { borderColor: colors.accent + '60', backgroundColor: colors.accent + '15' }
typePillText: { fontSize: 11, color: colors.primary, fontWeight: '600' }

// Fila de tipo (scroll horizontal):
typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
           paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }
typeLabel: { fontSize: 13, color: colors.textMuted, marginRight: 2 }
typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10,
           paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border }
typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
typeBtnAlarmActive: { borderColor: colors.accent, backgroundColor: colors.accent + '15' }
typeBtnText: { fontSize: 12, color: colors.textSecondary }

// Presets:
presetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             paddingVertical: 12, paddingHorizontal: 14 }
// + borderBottomWidth: 1, borderColor: colors.border si rowDividers
presetText: { fontSize: 14, color: colors.text }
// Activo: color: colors.primary, fontWeight: '600' + <Check size={16} />

// Campo personalizado:
customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }
customInput: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8,
               paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: colors.text,
               width: 72, textAlign: 'center' }
customUnitRow: { flexDirection: 'row', gap: 4 }
customUnitBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
                 borderWidth: 1, borderColor: colors.border }
customUnitBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' }
customUnitText: { fontSize: 12, color: colors.textSecondary }
customAdd: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary }
customAddText: { fontSize: 13, color: colors.onPrimary, fontWeight: '600' }
```

**Presets fijos:** "A la hora" (0) · "10 min antes" · "30 min antes" · "1 hora antes" · "1 día antes"  
**Sección de viaje** (solo si `showTravelButton`): modos transporte (Car/Footprints/Bus/Bike), minutos extra, toggle "Recordarme cuándo salir", botón "Calcular tiempo de viaje".

---

### RepeatPanel (`src/mobile/components/RepeatPanel.tsx`)

Modal full-screen independiente (`animationType="slide"`, `transparent={false}`). Se abre desde ItemDetailModal y QuickAddSheet.

```typescript
container: { flex: 1, backgroundColor: colors.background }
header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 8, marginBottom: 8 }
title: { fontSize: 16, fontWeight: '700', color: colors.text }
doneText: { color: colors.primary, fontWeight: '700', fontSize: 15 }
scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }

sectionLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }

// Fila intervalo + unidad:
intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }
intervalInput: { width: 60, height: 44, borderWidth: 1, borderColor: colors.border,
                 borderRadius: 8, textAlign: 'center', fontSize: 16, color: colors.text,
                 backgroundColor: colors.surfaceSecondary }
unitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
           height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
           paddingHorizontal: 14, backgroundColor: colors.surfaceSecondary }
unitText: { fontSize: 15, color: colors.text }

// Dropdown de unidades:
dropdownList: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, marginBottom: 4, overflow: 'hidden' }
dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 12, paddingHorizontal: 14 }
dropdownItemText: { fontSize: 14, color: colors.text }

// Días de la semana (solo mode 'week'):
weekdayCircleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }
weekdayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center',
                 justifyContent: 'center', borderWidth: 1, borderColor: colors.border }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary
weekdayCircleText: { fontSize: 13, fontWeight: '600', color: colors.text }
// Labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Campo de inicio (read-only):
fieldBox: { height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            paddingHorizontal: 14, justifyContent: 'center', marginBottom: 14,
            backgroundColor: colors.surfaceSecondary }

// Radio buttons de fin:
radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }
radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border,
              alignItems: 'center', justifyContent: 'center' }
// Activo: borderColor: colors.primary
radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }
radioLabel: { fontSize: 15, color: colors.text }
endField: { flex: 1, height: 36, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.surfaceSecondary }
```

**Opciones de finalización:** "Nunca" · "El [fecha]" · "Después de [N] repeticiones"  
**Unidades:** hora · día · semana · mes · año  
**UNIT_TO_RULE**: `{ hour: 'hourly', day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }`  
El `DateTimePicker` se renderiza fuera del Modal (igual patrón que ItemDetailModal).

---

## Instrucciones de regeneración en Android

Esta sección es una guía paso a paso para que Claude pueda recrear la app completa desde cero en Android.

### Prerrequisitos del entorno

1. Node.js 20+ y npm 10+
2. Android Studio con SDK Android 34 (compileSdkVersion) y NDK
3. Java 17 (JDK)
4. Variables de entorno: `ANDROID_HOME`, `JAVA_HOME`
5. Un emulador Android API 34 corriendo (o dispositivo físico conectado)
6. Expo CLI: `npm install -g expo-cli` (opcional, el `npx` funciona)

### Paso 1: Scaffold del proyecto

```bash
npx create-expo-app@latest Agenda --template blank-typescript
cd Agenda
```

### Paso 2: Eject a bare workflow (para acceso nativo Android)

```bash
npx expo prebuild --platform android
```

Esto genera la carpeta `android/` con el proyecto Gradle.

### Paso 3: Instalar dependencias exactas

```bash
npm install \
  @react-navigation/native@^7 \
  @react-navigation/bottom-tabs@^7 \
  @tanstack/react-query@^5 \
  zustand@^5 \
  expo-sqlite \
  @react-native-async-storage/async-storage@^2 \
  expo-notifications \
  expo-location \
  @react-native-google-signin/google-signin@^16 \
  expo-auth-session \
  expo-web-browser \
  date-fns@^4 \
  lucide-react-native \
  react-native-gesture-handler@^2 \
  react-native-reanimated@^3 \
  react-native-safe-area-context \
  react-native-screens \
  react-native-svg \
  @react-native-community/datetimepicker \
  expo-sharing \
  expo-document-picker

npm install --save-dev vitest @vitest/coverage-v8
```

### Paso 4: Configuración de Babel

`babel.config.js` DEBE tener `allowDeclareFields: true` para el patrón de tipado nominal de las entidades:

```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-transform-class-properties', { loose: false, allowDeclareFields: true }],
      'react-native-reanimated/plugin',
    ],
  }
}
```

### Paso 5: TypeScript estricto

`tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowDeclareFields": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Paso 6: Variables de entorno

Crear `.env` en la raíz:
```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<tu-clave>
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=<expo-client-id>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-client-id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
```

### Paso 7: `app.json` — configuración Expo

```json
{
  "expo": {
    "name": "Tasks",
    "slug": "agenda-personal",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.agenda.personal",
      "googleServicesFile": "./google-services.json",
      "permissions": [
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.SCHEDULE_EXACT_ALARM",
        "android.permission.USE_EXACT_ALARM",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.INTERNET"
      ]
    },
    "plugins": [
      "expo-sqlite",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#69D2E7",
          "sounds": []
        }
      ],
      "expo-location",
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

### Paso 8: Google Sign-In (Android nativo)

1. Crear proyecto en Google Cloud Console
2. Habilitar Google Calendar API y Google Tasks API
3. Configurar OAuth consent screen con los scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/tasks`
4. Crear credencial OAuth para Android con el SHA-1 del keystore de debug
5. Crear credencial OAuth Web para token intercambio
6. Descargar `google-services.json` y colocar en raíz del proyecto
7. En `android/app/build.gradle` aplicar el plugin:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
8. En `android/build.gradle` agregar:
   ```groovy
   classpath 'com.google.gms:google-services:4.4.0'
   ```

### Paso 9: Canales de notificación Android

```typescript
// src/infrastructure/notifications/itemNotifications.ts
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

### Paso 10: Orden de implementación de archivos

Implementar en este orden para evitar dependencias circulares:

```
1. src/utils/id.ts
2. src/domain/items/Item.types.ts
3. src/domain/items/valueObjects/RepeatConfig.ts
4. src/domain/items/valueObjects/ReminderConfig.ts
5. src/domain/items/valueObjects/AcademicConfig.ts
6. src/domain/items/valueObjects/TravelConfig.ts
7. src/domain/items/valueObjects/CalendarLink.ts
8. src/domain/items/Item.ts
9. src/domain/items/Item.inputs.ts
10. src/domain/items/ItemRepository.ts
11. src/domain/items/index.ts
12. src/domain/habits/Habit.ts
13. src/domain/habits/HabitReminder.ts
14. src/domain/habits/HabitOccurrence.ts
15. src/domain/habits/HabitRepository.ts
16. src/domain/habits/index.ts
17. src/domain/subjects/Subject.ts
18. src/domain/settings/types.ts        ← DEFAULT_CATEGORIES, GOAL_CATEGORIES, HABIT_CATEGORIES
19. src/domain/settings/Settings.ts
20. src/domain/settings/LicenseUsage.ts
21. src/domain/settings/repositories.ts
22. src/domain/calendar/repositories.ts
23. src/infrastructure/persistence/sqlite/db.ts
24. src/infrastructure/persistence/sqlite/itemRow.ts
25. src/infrastructure/persistence/sqlite/itemRepository.ts
26. src/infrastructure/persistence/sqlite/habitRepository.ts
27. src/infrastructure/persistence/sqlite/subjectRepository.ts
28. src/infrastructure/persistence/asyncstorage/settingsRepository.ts
29. src/infrastructure/calendar/googleCalendarRepository.ts
30. src/infrastructure/tasks/googleTasksRepository.ts
31. src/infrastructure/notifications/itemNotifications.ts
32. src/infrastructure/notifications/habitNotifications.ts
33. src/app/container.ts
34. src/state/googleAuthStore.ts
35. src/application/items/useItems.ts
36. src/application/habits/useHabits.ts
37. src/application/settings/useSettings.ts
38. src/mobile/theme/tokens.ts
39. src/mobile/theme/useAppTheme.ts
40. src/mobile/theme/categoryIcons.ts
41. src/mobile/theme/CategoryGlyph.tsx
42. src/mobile/components/MonthCalendar.tsx
43. src/mobile/components/ProgressRing.tsx
44. src/mobile/components/ReminderPanel.tsx
45. src/mobile/components/RepeatPanel.tsx
46. src/mobile/components/FloatingAddButton.tsx
47. src/mobile/components/ItemCard.tsx
48. src/mobile/components/SwipeableItemCard.tsx
49. src/mobile/components/HabitCard.tsx
50. src/mobile/modals/QuickAddSheet.tsx
51. src/mobile/modals/AddGoalSheet.tsx
52. src/mobile/modals/AddHabitSheet.tsx
53. src/mobile/modals/ItemDetailModal.tsx
54. src/mobile/modals/SettingsModal.tsx
55. src/mobile/modals/HabitStatsModal.tsx
56. src/mobile/screens/TaskScreen.tsx
57. src/mobile/screens/GoalsScreen.tsx
58. src/mobile/screens/HabitsScreen.tsx
59. src/mobile/screens/StudiesScreen.tsx
60. src/mobile/navigation/MainTabs.tsx
61. App.tsx
62. index.js
```

### Paso 11: Verificar el build

```bash
npm run android
# Si hay errores de Metro:
npx expo start --clear

# Build release para APK:
cd android && ./gradlew assembleRelease
# APK en: android/app/build/outputs/apk/release/app-release.apk
```

### Checklist de features por tab

#### Tab 1 — Tareas (TaskScreen)
- [ ] FlatList con secciones: overdue, today, important, noDate, later, completed
- [ ] Búsqueda con debounce
- [ ] Filtros por categoría (chips scrollables horizontalmente)
- [ ] SwipeableItemCard con swipe izquierda=borrar y derecha=completar
- [ ] Toast de undo con temporizador 4s
- [ ] "Mostrar más completadas" (paginación de 5)
- [ ] Feriados e eventos Google Calendar inline
- [ ] ItemDetailModal al tocar card
- [ ] QuickAddSheet al presionar FAB

#### Tab 2 — Facultad (StudiesScreen)
- [ ] Lista de materias (CRUD vía modal)
- [ ] Porcentaje de asistencia (classesPerWeek, absences)
- [ ] Exámenes pendientes con isExamTask detection
- [ ] Campos académicos: studyTimeBefore (medio día / día completo) + grade
- [ ] LicenseUsage: días de licencia disponibles/usados
- [ ] Alertas si tasa de asistencia < 75%

#### Tab 3 — Metas (GoalsScreen)
- [ ] Secciones: activas / vencidas (overdue header solo si hay vencidas)
- [ ] Filter chips con color de categoría (no primary)
- [ ] AddGoalSheet (crear compact / editar full-screen)
- [ ] Submetas con toggle de completado
- [ ] Sync a Google Tasks (cuando hay accessToken)
- [ ] Toast undo 4s al completar

#### Tab 4 — Hábitos (HabitsScreen)
- [ ] Secciones: daily → weekly → monthly → yearly
- [ ] HabitCard con accordion expandible
- [ ] ProgressRing para daily con weekStatus
- [ ] Ocurrencias individuales (chips con hora)
- [ ] Streak badge (Flame icon)
- [ ] HabitStatsModal
- [ ] AddHabitSheet
- [ ] Toast undo 3200ms

### Patrones de código críticos

#### Nominal typing (entidades de dominio)

```typescript
// CORRECTO — requiere allowDeclareFields: true en babel
class TaskItem extends BaseItem {
  protected declare readonly _brand: void
  readonly type = ITEM_TYPE.TASK as const
}

// INCORRECTO — no funciona en Hermes
class TaskItem extends BaseItem {
  private _brand!: never
}
```

#### createStyles memoizado

```typescript
// CORRECTO — recrea styles solo cuando cambian los colors
const { colors } = useAppTheme()
const styles = useMemo(() => createStyles(colors), [colors])

// INCORRECTO — recrea en cada render
const styles = createStyles(colors)
```

#### Patch pattern (actualización parcial de item)

```typescript
// En Item.update(), la presencia del campo en el patch (no el valor) determina si se aplica:
if ('title' in patch) { title = patch.title }
if ('categoryId' in patch) { categoryId = patch.categoryId }
// Esto permite patch.categoryId = undefined para borrar la categoría
```

#### Invalidación de React Query

```typescript
// Siempre invalidar ['items'] después de cualquier mutación:
queryClient.invalidateQueries({ queryKey: ['items'] })
```

#### Doble tabla de hábitos

```typescript
// habit_completions: resumen diario (habitId, date, count)
// habit_occurrences: eventos individuales (id, habitId, occurredAt, source)
// Siempre actualizar AMBAS tablas en una transacción al registrar un hábito
// Siempre actualizar AMBAS tablas al borrar una ocurrencia
```

#### ThemeTokens — no usar colores hardcodeados

```typescript
// CORRECTO:
color: colors.primary
backgroundColor: colors.surface

// INCORRECTO (rompe dark mode):
color: '#69D2E7'
backgroundColor: 'white'

// Excepción permitida: colores de categoría (vienen del dominio, son constantes)
backgroundColor: cat.color  // OK
```

#### Android DateTimePicker fuera del Modal

```typescript
// CORRECTO — evita el crash de diálogos anidados en Android:
return (
  <>
    <Modal visible={open}>...</Modal>
    {open && showTimePicker && <DateTimePicker ... />}
  </>
)

// INCORRECTO — crashea en Android:
<Modal visible={open}>
  {showTimePicker && <DateTimePicker ... />}
</Modal>
```

### Google OAuth flow (Android nativo)

```typescript
// 1. Configurar al montar:
GoogleSignin.configure({ scopes: GOOGLE_OAUTH_SCOPES })

// 2. Conectar (interactivo):
await GoogleSignin.hasPlayServices()
const result = await GoogleSignin.signIn()
const tokens = await GoogleSignin.getTokens()
setSession({ accessToken: tokens.accessToken, ... })

// 3. Silent refresh (en background):
const silent = await GoogleSignin.signInSilently()
if (silent.type === 'success') {
  const tokens = await GoogleSignin.getTokens()
  // renovar sesión
}

// 4. Desconectar:
await GoogleSignin.signOut()
clearSession()
```

Scopes requeridos:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/tasks`

### Troubleshooting frecuente

| Síntoma | Causa | Fix |
|---|---|---|
| `allowDeclareFields` error en build | Babel config incorrecto | Agregar `allowDeclareFields: true` en babel.config.js |
| App crashes al abrir DateTimePicker | Modal anidado en Android | Mover DateTimePicker fuera del Modal |
| Notificaciones no llegan a la hora exacta | Falta permiso `USE_EXACT_ALARM` | Abrir Settings > Recordatorios > Permitir alarmas exactas |
| Google Sign-In falla con `SIGN_IN_CANCELLED` | SHA-1 no registrado | Agregar SHA-1 del keystore de debug en Google Cloud Console |
| Items no aparecen tras crear | React Query no invalida | Llamar `queryClient.invalidateQueries({ queryKey: ['items'] })` |
| DB locked error | `WAL` mode no activo | Verificar `PRAGMA journal_mode = WAL` al init |
| Dark mode no aplica | ThemeTokens hardcodeados | Reemplazar colores literales por `colors.*` |
