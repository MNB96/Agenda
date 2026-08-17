# Agenda Personal — Documentación

App mobile-first de productividad personal. Nombre de display: **Tasks**. Package: `com.agenda.personal`.  
React Native 0.86 + Expo 57 + TypeScript strict. Solo Android (bare workflow, Hermes runtime).

---

## Índice de documentos

| Archivo | Qué cubre |
|---|---|
| [dominio.md](./dominio.md) | Entidades Item, Habit, Subject, Settings, LicenseUsage, categorías, servicios de dominio |
| [estado.md](./estado.md) | Zustand (Google OAuth), React Query (hooks y query keys), hooks background |
| [infraestructura.md](./infraestructura.md) | SQLite (schema DDL), AsyncStorage (claves), notificaciones Android, Google Calendar/Tasks |
| [componentes.md](./componentes.md) | Tema (ThemeTokens light/dark), componentes UI compartidos (ItemCard, HabitCard, ReminderPanel, etc.) |
| [tareas.md](./tareas.md) | Tab Tareas: TaskScreen, QuickAddSheet (todos los paneles), ItemDetailModal, notificaciones de items |
| [metas.md](./metas.md) | Tab Metas: GoalsScreen, AddGoalSheet (crear y editar), flujo de postergación, notificaciones |
| [habitos.md](./habitos.md) | Tab Hábitos: HabitsScreen, HabitCard, AddHabitSheet, HabitStatsModal |
| [habits-flow.md](./habits-flow.md) | Arquitectura interna de hábitos: habit_completions vs habit_occurrences, invariantes |
| [facultad.md](./facultad.md) | Tab Facultad: StudiesScreen, detección de examen, campos académicos, licencias |
| [ajustes.md](./ajustes.md) | SettingsModal: tema, Google Calendar, recordatorios, licencias, datos |
| [arquitectura.md](./arquitectura.md) | Capas, DI container, patrones de código, flujos clave, guía de regeneración Android |
| [migracion-kotlin.md](./migracion-kotlin.md) | Migración a Android nativo: Kotlin + Jetpack Compose + Room + Hilt |

---

## Estructura de carpetas

```
Agenda/
├── App.tsx                    ← Root: QueryClient, AppShellInner, notif handling
├── index.js                   ← Expo entry
├── app.json                   ← Config Expo (plugins, permisos, icono)
├── CLAUDE.md                  ← Guía técnica completa (pixel-exact styles, DDL, convenciones)
├── src/
│   ├── app/container.ts       ← DI: singletons de repositorios
│   ├── domain/                ← Entidades + interfaces + servicios puros
│   │   ├── items/             ← Item, valueObjects, services, ItemRepository
│   │   ├── habits/            ← Habit, HabitOccurrence, HabitReminder, HabitRepository
│   │   ├── subjects/          ← Subject, computeAttendance
│   │   ├── settings/          ← Settings, LicenseUsage, DEFAULT_CATEGORIES
│   │   ├── calendar/          ← types, repositories interfaces
│   │   └── holidays/          ← types
│   ├── infrastructure/        ← Implementaciones concretas
│   │   ├── persistence/sqlite/ ← db.ts, itemRepository, habitRepository, subjectRepository
│   │   ├── persistence/asyncstorage/ ← settingsRepository
│   │   ├── calendar/          ← googleCalendarRepository
│   │   ├── tasks/             ← googleTasksRepository
│   │   ├── notifications/     ← itemNotifications, habitNotifications
│   │   ├── maps/              ← googlePlaces, travelTime
│   │   └── holidays/          ← holidaysService
│   ├── application/           ← Hooks React Query (casos de uso)
│   │   ├── items/             ← useItems, useTaskEntries, useItem, useSubtasks, hooks background
│   │   ├── habits/            ← useHabits
│   │   ├── calendar/          ← useGoogleCalendar, useCalendarDeleteQueue, useCalendarSyncRecovery
│   │   ├── settings/          ← useSettings, useDataExport, useDataImport
│   │   ├── subjects/          ← useSubjects
│   │   └── holidays/          ← useHolidays
│   ├── state/
│   │   └── googleAuthStore.ts ← Zustand: sesión Google OAuth
│   ├── mobile/
│   │   ├── navigation/MainTabs.tsx
│   │   ├── screens/           ← TaskScreen, StudiesScreen, GoalsScreen, HabitsScreen
│   │   ├── modals/            ← QuickAddSheet, AddGoalSheet, AddHabitSheet, ItemDetailModal, SettingsModal, HabitStatsModal
│   │   ├── components/        ← SwipeableItemCard, ItemCard, HabitCard, FloatingAddButton, MonthCalendar, ProgressRing, ReminderPanel, RepeatPanel
│   │   ├── theme/             ← tokens.ts, useAppTheme.ts, CategoryGlyph.tsx, categoryIcons.ts
│   │   └── useGoogleSessionLifecycleMobile.ts
│   └── utils/                 ← id.ts, calendarDate.ts, assertNever.ts
├── android/                   ← Proyecto nativo Android (bare workflow)
└── docs/                      ← Esta carpeta
```

---

## Flujos principales

### 1. Crear una tarea

```
Usuario toca FAB (+)
  → AppShellInner detecta tab activo
  → QuickAddSheet se abre
    → Usuario escribe título (parser NL detecta fecha/hora/deadline/ubicación)
    → Chips NL descartables debajo del input
    → Paneles opcionales: fecha, repetición, recordatorios, tiempo de viaje
    → "Guardar"
      → useItems.createItem()
        → Item.create(input) — valida, lanza error en violaciones
        → itemRepository.save(item) — SQLite
        → scheduleItemNotifications(item) — expo-notifications
        → queryClient.invalidateQueries(['items'])
        → (si syncToCalendar) googleCalendarRepository.createEvent(item)
```

### 2. Completar una tarea por swipe

```
SwipeableItemCard deslizar derecha
  → onComplete callback
  → useItems.completeItem(item)
    → Item.complete(item, subtasks) — marca status='completed', completedAt
    → cancelItemNotifications(item)
    → Item.linkNotifications(completed, [])
    → itemRepository.save(linked)
    → queryClient.invalidateQueries(['items'])
  → Toast "Tarea completada" + "Deshacer" (4 segundos)
  → Si se toca "Deshacer": useItems.updateItem(item, { status: 'active', completedAt: undefined })
```

### 3. Completar tarea desde notificación (sin abrir la app)

```
Usuario toca acción "Completar" en la notificación Android
  → App cerrada: Notifications.getLastNotificationResponseAsync()
  → App abierta: addNotificationResponseReceivedListener
  → handleResponse detecta ITEM_COMPLETION_ACTION_ID
    → processed.has(notifId) → skip si ya procesado
    → processed.add(notifId) — dedup por 30 segundos
    → Notifications.dismissNotificationAsync(notifId)
    → itemRepository.getById(itemId)
    → Item.complete(item, subtasks)
    → cancelItemNotifications + linkNotifications([])
    → itemRepository.save(linked)
    → queryClient.invalidateQueries(['items'])
```

### 4. Registrar un hábito

```
HabitCard: usuario toca ícono principal (1 vez/día) o botón "+" (multi-vez)
  → useHabits.addOccurrence(habitId, occurredAt)
    → habitRepository.addOccurrence({ habitId, occurredAt, source: 'manual' })
      → INSERT en habit_occurrences
      → UPDATE habit_completions (count + 1) o INSERT si no existe — en una transacción
    → queryClient.invalidateQueries(['habits'])
  → Toast "✓ Título · HH:mm" + "Deshacer" (3200ms)
  → Si se toca "Deshacer": removeOccurrence(id)
```

### 5. Sincronización con Google Calendar

```
Al crear/editar un item con syncToCalendar=true:
  → googleCalendarRepository.createEvent() o updateEvent()
  → Si falla: Item.markSyncPending(item) → calendarSyncPending=true
  → useCalendarSyncRecovery (hook background): reintenta items con calendarSyncPending=true
  → useCalendarDeleteQueue (hook background): reintenta deletes fallidos offline
```

---

## Stack técnico resumido

| Tecnología | Versión | Rol |
|---|---|---|
| React Native | ~0.86.2 | Motor UI |
| Expo | ~57 | Toolchain, plugins nativos |
| TypeScript | 6.0 strict | Todo el proyecto |
| @react-navigation/bottom-tabs | 7 | 4 tabs, sin stack navigator |
| @tanstack/react-query | 5 | Estado async, cache, invalidación |
| zustand | 5 | Solo sesión Google OAuth |
| expo-sqlite | ~57 | Base de datos local (WAL mode) |
| @react-native-async-storage/async-storage | 2 | Settings, SemesterConfig, LicenseUsage |
| expo-notifications | ~57 | Notificaciones locales con acciones |
| @react-native-google-signin/google-signin | 16 | Google OAuth Android |
| date-fns | 4 (locale es) | Fechas en español |
| lucide-react-native | 1 | Iconos |
| react-native-gesture-handler | 2 | Swipe en tarjetas |
| vitest | 4 | Tests unitarios |
