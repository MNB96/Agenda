# Estado — Zustand, React Query y hooks background

La app tiene tres capas de estado:
1. **Zustand** — sesión Google OAuth (persistida en AsyncStorage)
2. **React Query** — datos async (items, hábitos, materias, calendarios)
3. **Estado local React** — UI (búsqueda, modal abierto, undo toast, etc.)

---

## 1. Zustand — googleAuthStore

Archivo: `src/state/googleAuthStore.ts`

```typescript
interface GoogleAuthState {
  accessToken: string | null
  expiresAt: number | null      // unix ms
  connectedEmail: string | null
  authIssue: 'expired' | 'unauthorized' | null
  setSession(payload): void
  markExpired(): void
  markUnauthorized(): void
  clearSession(): void
}
```

**Persistencia:** AsyncStorage, key `agenda:google-auth`. Solo persiste `accessToken`, `expiresAt`, `connectedEmail` (no las funciones).

**`GOOGLE_TOKEN_TTL_SECONDS = 3600`**

**`GOOGLE_OAUTH_SCOPES`:**
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/tasks
```

**`setSession(payload)`** recibe `{ accessToken, expiresIn, connectedEmail? }` y calcula `expiresAt = Date.now() + expiresIn * 1000`.

**`markExpired()`** → `authIssue = 'expired'`. Indica que el token venció y se necesita reconexión.

**`markUnauthorized()`** → `authIssue = 'unauthorized'`. Indica error 401/403 de la API.

**Uso:** componentes y hooks leen `accessToken` para decidir si mostrar integraciones Google. `markUnauthorized` se pasa como callback a hooks de Calendar y Tasks.

---

## 2. React Query — query keys y hooks

QueryClient instanciado en `App.tsx` via `useMemo(() => new QueryClient(), [])`.

### Query keys

| Key | Datos |
|---|---|
| `['items']` | Todos los items (tareas y metas) |
| `['subjects']` | Materias |
| `['habits']` | Hábitos |
| `['habit-occurrences', habitId]` | Ocurrencias de un hábito |
| `['google-calendars']` | Calendarios Google del usuario |
| `['google-events', calendarId, dateRange]` | Eventos de Calendar |
| `['holidays', year]` | Feriados del año |

### Hook principal: useItems

Archivo: `src/application/items/useItems.ts`

Expone:
- `items: Item[]` — todos los items (activos + completados)
- `createItem(input: NewItemInput): Promise<void>`
- `updateItem(item, patch: ItemPatch): Promise<void>` — con optimistic update via `setQueryData`
- `removeItem(item): Promise<void>`
- `completeItem(item): Promise<void>`
- `reopenItem(item): Promise<void>`

Todas las mutations invalidan `['items']` en `onSuccess`.

`updateItem` hace optimistic update:
```typescript
queryClient.setQueryData(['items'], (old) => old.map(i => i.id === item.id ? optimistic : i))
```

### Hook: useTaskEntries

Archivo: `src/application/items/useTaskEntries.ts`

Calcula las secciones de TaskScreen: overdue, today/next, important, noDate, completed (paginadas).

- `loadMoreCompleted()` — carga de 30 en 30 (`COMPLETED_PAGE_SIZE = 30`)
- `searchQuery: string` — filtra por título, categoría y ubicación
- `activeCategory: string` — filtra por categoría

### Hook: useHabits

Archivo: `src/application/habits/useHabits.ts`

Expone:
- `habits: Habit[]`
- `completions: Map<string, HabitCompletion>` — completions del día actual
- `occurrences: HabitOccurrence[]` — ocurrencias de hoy para cada hábito
- `createHabit(input)`, `updateHabit(id, patch)`, `removeHabit(id)`
- `addOccurrence(habitId, occurredAt)` — registra una ejecución
- `removeOccurrence(occurrenceId)` — elimina una ejecución (y decremente count)
- `weekStatus(habitId)` — array de 7 días con estado de completitud

### Hook: useSubjects

Archivo: `src/application/subjects/useSubjects.ts`

- `subjects: Subject[]`
- `semesterConfig: SemesterConfig` — cargado de AsyncStorage al montar
- `saveSemesterConfig(config)` — guarda en AsyncStorage
- `createSubject(input)`, `updateSubject({id, patch})`, `removeSubject(id)`
- `addAbsence(id)`, `removeAbsence(id)` — incrementa/decrementa `absences`

### Hook: useSettings

Archivo: `src/application/settings/useSettings.ts`

- `data: Settings | undefined`
- `saveSettings(patch: Partial<Settings>): Promise<void>`

### Hook: useGoogleCalendar

Archivo: `src/application/calendar/useGoogleCalendar.ts`

- `useGoogleCalendars()` — lista de calendarios del usuario (requiere `accessToken`)
- `useGoogleEvents(calendarIds, dateRange)` — eventos del rango visible en TaskScreen

---

## 3. Hooks background (montados en AppShellInner)

Estos hooks se montan una sola vez en `AppShellInner` y corren en background silenciosamente:

| Hook | Qué hace |
|---|---|
| `useGoogleSessionLifecycleMobile` | Refresh silencioso del token Google al volver al foreground |
| `useCalendarDeleteQueue` | Reintenta deletes de Calendar fallidos (cuando estaba offline) |
| `useCalendarSyncRecovery` | Re-sincroniza items con `calendarSyncPending=true` |
| `useAutoPurgeCompleted` | Borra completadas > 60 días automáticamente al montar |
| `useAutoRegenerateOverdueRecurring` | Adelanta recurrentes vencidas al próximo ciclo válido |
| `useAutoCompleteReminderOnly` | Auto-completa `reminderOnly` items pasados > 24h de su due moment |
| `useMarkOverdueGoals` | Marca goals vencidas para display (read-only, no modifica status) |

```typescript
// En AppShellInner:
useGoogleSessionLifecycleMobile()
useCalendarDeleteQueue(accessToken ?? null, markUnauthorized)
useCalendarSyncRecovery(accessToken ?? null, markUnauthorized)
useAutoPurgeCompleted()
useAutoRegenerateOverdueRecurring()
useAutoCompleteReminderOnly()
useMarkOverdueGoals()
```

### useGoogleSessionLifecycleMobile

Escucha el evento `AppState` de React Native. Al pasar de `background` a `active`:
1. Llama `GoogleSignin.signInSilently()`
2. Si tiene éxito: `GoogleSignin.getTokens()` → `setSession({...})`
3. Si falla con 401/403: `markUnauthorized()`
4. Si falla con token expirado: `markExpired()`

### useCalendarDeleteQueue

Lee `calendarDeleteQueue` (AsyncStorage) al montar. Si hay IDs pendientes de eliminar, llama a `calendarRepository.deleteEvent(id)` por cada uno. Elimina del queue los que tuvieron éxito.

### useCalendarSyncRecovery

Al montar, busca todos los items con `calendarSyncPending=true`. Por cada uno, llama a `calendarRepository.createEvent()` o `updateEvent()`. Si tiene éxito: `Item.linkCalendar(item, link)` + `itemRepository.save()`.

---

## 4. Estado local de AppShellInner

`AppShell` (el padre) maneja el estado de qué modal está abierto:

```typescript
const [quickAddOpen, setQuickAddOpen] = useState(false)
const [settingsOpen, setSettingsOpen] = useState(false)
const [editingItemId, setEditingItemId] = useState<string | undefined>()
const [editingGoalId, setEditingGoalId] = useState<string | undefined>()
const [editingHabitId, setEditingHabitId] = useState<string | undefined>()
```

**Pantalla de loading** (antes de que Settings cargue):
```typescript
if (!settingsQuery.data) {
  return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0E191D' : '#FFFFFF' }} />
}
```

**`isAnyModalOpen`:**
```typescript
const isAnyModalOpen = quickAddOpen || settingsOpen || Boolean(editingItemId) || Boolean(editingGoalId) || Boolean(editingHabitId)
```
FAB solo se renderiza cuando `!isAnyModalOpen`.

**Routing del FAB:** el tab activo determina qué modal se abre:
- Tareas → `QuickAddSheet`
- Facultad → `QuickAddSheet` (con `categoryId='facultad'` preseleccionada)
- Metas → `AddGoalSheet`
- Hábitos → `AddHabitSheet`

```typescript
// QuickAddSheet solo si NO es Metas ni Hábitos:
<QuickAddSheet open={quickAddOpen && activeTab !== 'Metas' && activeTab !== 'Hábitos'} />
<AddGoalSheet open={(quickAddOpen && activeTab === 'Metas') || Boolean(editingGoalId)} />
<AddHabitSheet open={(quickAddOpen && activeTab === 'Hábitos') || Boolean(editingHabitId)} />
```

**activeTab tracking:**
```typescript
const navigationRef = useNavigationContainerRef()
// onReady y onStateChange del NavigationContainer:
setActiveTab(navigationRef.getCurrentRoute()?.name ?? 'Tareas')
```

---

## 5. Estado local de screens y modals

Cada screen y modal gestiona su propio UI state. Ejemplos:

**TaskScreen:**
- `searchQuery: string` — campo de búsqueda
- `activeCategory: string` — chip seleccionado
- `undoToast: { item, timer } | null` — toast de deshacer
- `completedPage: number` — paginación de completadas

**GoalsScreen:**
- `searchQuery: string`
- `activeCategory: string`
- `undoToast` — igual a TaskScreen

**HabitsScreen:**
- `activeCategory: string`
- `expandedId: string | null` — card expandida
- `undoToast: { occurrence, habit, timer } | null`

**QuickAddSheet:**
Estado local de todos los campos del formulario + lógica "adjust during render" (ver [tareas.md](./tareas.md)):
- `wasOpen` state comparado con prop `open` para resetear al abrir (sin useEffect)
