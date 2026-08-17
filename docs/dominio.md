# Dominio — Entidades, tipos y servicios

Toda la lógica pura de negocio. Sin dependencias de React, expo ni librerías externas. Los archivos están en `src/domain/`.

---

## 1. Categorías (fuente de verdad)

```typescript
// src/domain/settings/types.ts
const DEFAULT_CATEGORIES: ItemCategory[] = [
  { id: 'facultad', name: 'Facultad', color: '#A7DBD8', icon: 'GraduationCap' },
  { id: 'trabajo',  name: 'Trabajo',  color: '#E0E4CC', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#69D2E7', icon: 'Heart' },
  { id: 'casa',     name: 'Casa',     color: '#7DD4E2', icon: 'Home' },
  { id: 'salud',    name: 'Salud',    color: '#B8DDD1', icon: 'Cross' },
  { id: 'compras',  name: 'Compras',  color: '#E6E5C2', icon: 'ShoppingCart' },
]

// GOAL_CATEGORIES: solo personal, facultad, trabajo
// HABIT_CATEGORIES: solo personal, facultad, casa, salud
```

Scope de categorías por tipo de item:

| Tipo | IDs permitidos |
|---|---|
| Tareas | facultad, trabajo, personal, casa, salud, compras |
| Metas | facultad, trabajo, personal |
| Hábitos | personal, facultad, casa, salud |

---

## 2. Item

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

### Campos completos

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | ID único (createId()) |
| `title` | `string` | Requerido, se hace trim. Error si vacío |
| `description` | `string \| undefined` | Texto libre |
| `type` | `'task' \| 'goal'` | Discriminante |
| `status` | `'active' \| 'completed'` | Estado principal |
| `important` | `boolean \| undefined` | Prioridad alta |
| `reminderOnly` | `boolean` | Default false. Si true: no tiene completación real |
| `repeatRule` | `RepeatRule \| undefined` | Regla de recurrencia |
| `repeatConfig` | `RepeatConfig \| undefined` | Detalle de recurrencia |
| `parentId` | `string \| undefined` | Sub-meta o subtarea |
| `categoryId` | `string \| undefined` | ID de categoría |
| `location` | `string \| undefined` | Solo tareas |
| `startDate` | `string \| undefined` | YYYY-MM-DD |
| `startTime` | `string \| undefined` | HH:mm |
| `endDate` | `string \| undefined` | YYYY-MM-DD |
| `endTime` | `string \| undefined` | HH:mm |
| `deadline` | `string \| undefined` | YYYY-MM-DD |
| `reminderConfig` | `readonly ReminderConfig[] \| undefined` | Lista de recordatorios |
| `travelConfig` | `TravelConfig \| undefined` | Config tiempo de viaje |
| `academicConfig` | `AcademicConfig \| undefined` | Config examen |
| `syncToCalendar` | `boolean \| undefined` | Sync con Google. Auto-false si reminderOnly=true |
| `calendarLink` | `CalendarLink \| undefined` | Link a evento/task Google |
| `calendarSyncPending` | `boolean \| undefined` | Sync pendiente, retry automático |
| `notificationIds` | `readonly string[] \| undefined` | IDs notifs programadas |
| `createdAt` | `string` | ISO timestamp |
| `updatedAt` | `string` | ISO timestamp |
| `completedAt` | `string \| undefined` | ISO timestamp |

### Namespace Item (métodos estáticos)

```typescript
Item.create(input: NewItemInput): Item
Item.update(current, patch: ItemPatch): Item
Item.hydrate(props: ItemProps): {success: true, item} | {success: false, error}
Item.canComplete(item, subtasks): boolean      // todas las subtareas completadas
Item.idsToRemoveWith(items, subtasks): string[]
Item.isReminderOnlyDue(item, now?): boolean    // reminderOnly + > 24h pasado
Item.complete(item, subtasks): Item
Item.reopen(item): Item
Item.linkCalendar(item, link|undefined): Item
Item.markSyncPending(item): Item
Item.linkNotifications(item, ids): Item        // NO bumps updatedAt
```

### Restricciones de Goal

Las metas NO pueden tener:
- `repeatRule` distinto de `none` ni `repeatConfig`
- `startDate`
- `location`
- `reminderConfig` con items

Solo categorías: `personal | facultad | trabajo`.

### Restricciones de subtareas

Una subtarea (con `parentId`) no puede tener `repeatConfig`.

### Validaciones de fechas

- `deadline` no puede ser anterior a `startDate`
- Si hay `startDate + startTime + endDate/endTime`: el end debe ser posterior al start

### Patch pattern

```typescript
// 'field' in patch distingue "no mencionado" de "explícitamente borrado"
const value = 'field' in patch ? patch.field : current.field
// Permite patch.categoryId = undefined para borrar la categoría
```

---

## 3. Value objects de Item

### RepeatConfig

```typescript
interface RepeatConfigInput {
  unit: 'hour' | 'day' | 'week' | 'month' | 'year'
  interval: number        // entero > 0
  daysOfWeek?: number[]   // 0=lun..6=dom. Solo para unit='week'
  end: 'never' | 'on_date' | 'after_occurrences'
  endDate?: string        // YYYY-MM-DD. Solo si end='on_date'
  occurrences?: number    // Solo si end='after_occurrences'
  occurrencesDone?: number // cuántas ya se completaron
}
```

Correspondencia `RepeatRule` ↔ `RepeatConfig.unit`:
- `hourly` → `hour`, `daily` → `day`, `weekly` → `week`, `monthly` → `month`, `yearly` → `year`

### ReminderConfig

```typescript
interface ReminderConfigInput {
  id: string
  mode: 'relative' | 'departure'
  minutesBefore?: number  // 0 = exactamente en el momento, 1440 = 1 día antes
  persistent?: boolean
  alarmType?: 'notification' | 'alarm'
}
```

### AcademicConfig

```typescript
interface AcademicConfigInput {
  studyTimeBefore?: 'half' | 'full'  // ½ día o 1 día laboral
  grade?: number                      // 0-10
}
```

Solo aparece en tareas de categoría `facultad` cuyo título es detectado como examen.

### TravelConfig

```typescript
interface TravelConfigInput {
  transport: 'driving' | 'walking' | 'transit' | 'cycling'
  extraMinutes: number
  departureReminderEnabled: boolean
}
```

### CalendarLink

```typescript
interface CalendarLinkInput {
  calendarId: string   // "primary" para el principal
  eventId: string
  lastSyncedAt: string // ISO timestamp
  origin: 'app' | 'external'
  kind?: 'event' | 'task'  // default: 'event'
}
```

Regla: tareas importadas desde Google Calendar tienen `origin: 'external'` y `syncToCalendar: false`.

---

## 4. Persistencia de Item en SQLite

La tabla `items` guarda columnas clave como índices y todo el resto en `data` (JSON):

```sql
CREATE TABLE IF NOT EXISTS items (
  id                    TEXT PRIMARY KEY NOT NULL,
  status                TEXT NOT NULL,           -- 'active' | 'completed'
  type                  TEXT NOT NULL,           -- 'task' | 'goal'
  parentId              TEXT,
  categoryId            TEXT,
  startDate             TEXT,                    -- YYYY-MM-DD
  deadline              TEXT,                    -- YYYY-MM-DD
  completedAt           TEXT,                    -- ISO timestamp
  googleCalendarId      TEXT,                    -- calendarLink.calendarId (desnormalizado)
  googleCalendarEventId TEXT,                    -- calendarLink.eventId (desnormalizado)
  calendarSyncPending   INTEGER,                 -- 0/1
  createdAt             TEXT NOT NULL,
  updatedAt             TEXT NOT NULL,
  data                  TEXT NOT NULL            -- JSON con todos los demás campos
);
```

---

## 5. Servicios de dominio de Item

### quickInputParser.ts

Detecta en texto libre (español):
- **Fechas:** "hoy", "mañana", días de semana, `d/m[/yyyy]`, `d de {mes}`, nombres de meses
- **Horas:** `HH:mm` o `HH.mm`
- **Deadline:** "antes de {fecha}" / "hasta {fecha}"
- **Ubicación:** "en {lugar}" o "@{lugar}"

### recurrence.ts

- `buildNextOccurrence(item)`: genera el próximo item al completar uno recurrente. Copia todos los campos salvo `id`, `status`, `completedAt`, `occurrencesDone` (que incrementa). No copia `parentId`.
- `catchUpOverdueOccurrence(item)`: avanza recurrentes vencidas al próximo ciclo. Cap: 20.000 pasos.

### examDetector.ts — `isExamTask(item)`

Detecta examen por keywords en el título (substring, case-insensitive):
```
parcial, examen, final, recuperatorio, recuperacion, recuperación, recu,
integracion, integración, coloquio, quiz
```
Y `categoryId === 'facultad'`.

### autoPurge.ts

Lógica para eliminar completadas de más de 60 días (usado por `useAutoPurgeCompleted`).

### relevance.ts

Calcula relevancia para secciones de TaskScreen (overdue, today, important, noDate, later).

### goalDeadline.ts

Lógica de postergación de metas: renombra en Google Calendar, elimina localmente, recrea.

---

## 6. Habit

```typescript
interface Habit {
  id: string
  title: string
  categoryId?: string        // solo: 'personal' | 'facultad' | 'casa' | 'salud'
  regularity: 'daily' | 'weekly' | 'monthly' | 'yearly'
  timesPerDay: number        // entero > 0. Default: 1
  reminder?: HabitReminderConfig
  notificationIds?: readonly string[]
  createdAt: string
  updatedAt: string
  regularityChangedAt?: string  // ISO timestamp. Se setea cuando cambia regularity
}
```

### HabitReminderConfig

```typescript
interface HabitReminderConfig {
  mode: 'interval' | 'random'
  intervalHours?: number       // horas entre notifs. Solo si mode='interval'
  timesPerDay?: number         // notifs por día. Solo si mode='random'
  windowStart?: string         // 'HH:mm'. Ventana horaria inicio
  windowEnd?: string           // 'HH:mm'. Ventana horaria fin
  randomTimes?: readonly string[] // tiempos 'HH:mm' sorteados. Requerido si mode='random'
}
```

### HabitOccurrence

```typescript
interface HabitOccurrence {
  id: string
  habitId: string
  occurredAt: string   // ISO timestamp
  source: 'manual' | 'notification'
  createdAt: string
  updatedAt: string
}
```

### HabitCompletion (resumen diario)

```typescript
{
  habitId: string
  date: string    // YYYY-MM-DD
  count: number   // siempre = #rows en habit_occurrences para (habitId, date)
}
```

**Invariante crítica:** `habit_completions.count` SIEMPRE es igual al número de filas en `habit_occurrences` para ese `(habitId, date)`. Se mantiene transaccionalmente en el repositorio.

---

## 7. Subject

```typescript
interface Subject {
  id: string
  name: string
  totalClasses: number   // total de clases del cuatrimestre
                         // DB column: classesPerWeek (legacy name, mapped by repository)
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
  classesElapsed: number       // Math.round(progressRatio * totalClasses)
  maxAbsences: number          // Math.floor(totalClasses * 0.25)
  remainingAbsences: number    // maxAbsences - subject.absences
  attendancePercent: number | null  // null si el cuatrimestre no empezó
  status: 'ok' | 'warning' | 'danger' | 'exceeded'
}
```

`ATTENDANCE_REQUIRED = 0.75` (75% de asistencia mínima).

`computeAttendance(subject, config: SemesterConfig): AttendanceStats`:
- `progressRatio = elapsed ms / total ms`
- `classesElapsed = Math.round(progressRatio * totalClasses)`
- `maxAbsences = Math.floor(totalClasses * 0.25)`

Status logic:
- `exceeded` → `remainingAbsences < 0`
- `danger` → `remainingAbsences === 0`
- `warning` → `remainingAbsences === 1`
- `ok` → de lo contrario

**DB mapping:** columna `classesPerWeek` → campo entity `totalClasses` (renombramiento en el repositorio vía `fromRow()`).

`createSubject(input)` usa su propio `generateId()` (no `createId()` de utils).

**SemesterConfig — default automático:**

| Meses | Cuatrimestre |
|---|---|
| Marzo – Julio | 1er cuatrimestre (año actual): 01-03 → 31-07 |
| Agosto – Noviembre | 2do cuatrimestre (año actual): 01-08 → 30-11 |
| Diciembre – Febrero | 1er cuatrimestre (año siguiente): 01-03 → 31-07 |

**SemesterConfig — persistencia:** AsyncStorage, key `@agenda/semester_config_v1`.

---

## 8. Settings

```typescript
interface Settings {
  id: 'main'                             // siempre 'main'
  themePreference: 'system' | 'light' | 'dark'
  availableExamLeaveDaysPerYear: number  // default: 10
  selectedCalendarIds: readonly string[]
  locationPermissionRequested: boolean
  showCategoryIcons: boolean
}
```

Default: `themePreference: 'system'`, `availableExamLeaveDaysPerYear: 10`, `selectedCalendarIds: []`, `showCategoryIcons: true`.

Persistida en AsyncStorage (no SQLite). Key: `agenda:main`.

---

## 9. LicenseUsage

Licencias por examen (días de estudio usados/planificados).

```typescript
interface LicenseUsage {
  id: string
  date: string   // YYYY-MM-DD — fecha del examen
  days: number   // 0.5 (½ día) o 1 (día completo)
  note: string   // título del examen
}
```

Persistida en AsyncStorage. Se upserta al cerrar ItemDetailModal si hay `academicConfig.studyTimeBefore`.

---

## 10. ID generation

```typescript
// src/utils/id.ts
export const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
```

Funciona en Hermes y en entornos de test. No usar `uuid` ni `nanoid`.

---

## 11. Tipado nominal en entidades

```typescript
// Requiere allowDeclareFields: true en babel.config.js
class TaskItem extends BaseItem {
  protected declare readonly _brand: void
  readonly type = ITEM_TYPE.TASK as const
}
```

El campo `_brand` es erased en runtime — existe solo para que TypeScript rechace mezcla accidental de tipos de entidades.
