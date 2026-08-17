# Arquitectura — Capas, patrones, DI y guía de regeneración Android

---

## 1. Capas (Clean Architecture)

```
domain/          ← Entidades + interfaces + servicios puros (cero React, cero infra)
infrastructure/  ← SQLite, AsyncStorage, Google APIs, Notifications
application/     ← Hooks React Query (casos de uso)
mobile/          ← UI React Native
state/           ← Zustand (solo sesión Google)
app/             ← container.ts: único punto de DI
utils/           ← Helpers sin dependencias
```

**Regla de dependencia:** el dominio no importa nada de React, infra ni librerías externas.

Las interfaces (`ItemRepository`, `HabitRepository`) viven en `domain/`. Las implementaciones SQLite en `infrastructure/`. El único lugar que los conecta es `src/app/container.ts`.

### DI Container

Archivo: `src/app/container.ts`

Singletons exportados directamente (no hay provider de DI):

```typescript
export const itemRepository: ItemRepository = new SQLiteItemRepository()
export const habitRepository: HabitRepository = new SQLiteHabitRepository()
export const subjectRepository: SubjectRepository = new SQLiteSubjectRepository()
export const settingsRepository: SettingsRepository = new AsyncStorageSettingsRepository()
export const calendarRepository: CalendarRepository = new GoogleCalendarRepository()
export const taskRepository: TaskRepository = new GoogleTasksRepository()
```

Los hooks de `application/` importan directamente desde este archivo.

---

## 2. Árbol de componentes raíz (App.tsx)

```
GestureHandlerRootView { flex: 1 }
  SafeAreaProvider
    QueryClientProvider
      AppShell
        AppShellInner
          StatusBar (translucent)
          NavigationContainer (navTheme derivado de ThemeTokens)
            MainTabs (bottom tabs)
              TaskScreen | StudiesScreen | GoalsScreen | HabitsScreen
          FloatingAddButton (solo si !isAnyModalOpen)
          QuickAddSheet (open si quickAddOpen && activeTab !== 'Metas' && !== 'Hábitos')
          AddGoalSheet (open si (quickAddOpen && activeTab === 'Metas') || editingGoalId)
          AddHabitSheet (open si (quickAddOpen && activeTab === 'Hábitos') || editingHabitId)
          ItemDetailModal (itemId = editingItemId)
          SettingsModal (open = settingsOpen)
```

**Pantalla de loading** (antes de que Settings cargue — todo el árbol de AppShellInner espera):
```typescript
if (!settingsQuery.data) {
  return <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#0E191D' : '#FFFFFF' }} />
}
```

---

## 3. Navegación

Solo `@react-navigation/bottom-tabs`. No hay stack navigator. **No existe** navegación por pantalla completa entre screens — toda edición ocurre en modals.

### Tab bar

```typescript
tabBarStyle: {
  height: 70 + insets.bottom,   // TAB_BAR_HEIGHT = 70
  paddingTop: 8, paddingBottom: 8 + insets.bottom,
  backgroundColor: colors.surface,
  borderTopColor: colors.border, borderTopWidth: 1,
}
tabBarActiveTintColor: colors.primary      // #69D2E7
tabBarInactiveTintColor: colors.textMuted
```

### Íconos de tabs

| Tab | Ícono (lucide) |
|---|---|
| Tareas | `ListTodo` |
| Facultad | `GraduationCap` |
| Metas | `Target` |
| Hábitos | `Flame` |

### Headers

```typescript
headerStyle: { backgroundColor: colors.background }
headerTitleStyle: { fontSize: 28, fontWeight: '800', color: colors.text }
```

- **Tareas**: título = fecha hoy en español (`"Domingo 16 de agosto"`) + botón ⚙ Settings a la derecha
- **Metas**: título = `"Metas 2026"`
- **Facultad / Hábitos**: sin título customizado

### Botón Settings (header derecho — Tab Tareas)

```typescript
{ marginRight: 14, borderWidth: 1, borderRadius: 999, padding: 8, backgroundColor: colors.surface, borderColor: colors.border }
// Ícono: <Settings color={colors.textSecondary} size={18} />
```

---

## 4. Patrones de código

### Tipado nominal (entidades de dominio)

```typescript
// Requiere allowDeclareFields: true en babel.config.js
class TaskItem extends BaseItem {
  protected declare readonly _brand: void  // erased en runtime, solo tipo
  readonly type = ITEM_TYPE.TASK as const
}
```

### createStyles memoizado

```typescript
// CORRECTO — recrea styles solo cuando cambian los colors:
const { colors } = useAppTheme()
const styles = useMemo(() => createStyles(colors), [colors])

// INCORRECTO — recrea en cada render:
const styles = createStyles(colors)
```

### Patch pattern (actualización parcial)

```typescript
// 'field' in patch distingue "no mencionado" de "explícitamente borrado":
if ('title' in patch) { title = patch.title }
if ('categoryId' in patch) { categoryId = patch.categoryId }
// patch.categoryId = undefined borra la categoría
```

### Invalidación de React Query

```typescript
// Siempre invalidar ['items'] tras cualquier mutación:
queryClient.invalidateQueries({ queryKey: ['items'] })
```

### Doble tabla de hábitos (invariante)

```typescript
// habit_completions: resumen diario (habitId, date, count)
// habit_occurrences: eventos individuales (id, habitId, occurredAt, source)
// Siempre actualizar AMBAS tablas en una transacción al registrar/borrar una ocurrencia
```

### ThemeTokens — no usar colores hardcodeados

```typescript
// CORRECTO:
color: colors.primary
backgroundColor: colors.surface

// INCORRECTO (rompe dark mode):
color: '#69D2E7'
backgroundColor: 'white'

// Excepción permitida: colores de categoría (son constantes del dominio)
backgroundColor: cat.color  // OK
```

### Android DateTimePicker fuera del Modal

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

### `linkNotifications` no bumps `updatedAt`

Los IDs de notificación son bookkeeping, no un cambio de contenido del item. `Item.linkNotifications(item, ids)` no modifica `updatedAt`.

### Recurrencia — invariantes

`repeatRule` y `repeatConfig.unit` deben coincidir siempre. `buildNextOccurrence` NO copia `parentId` (una subtarea recurrente generaría un ítem huérfano — validación previene esto).

### Hidratación safe

`Item.hydrate()` y `Habit.hydrate()` devuelven `{ success, item } | { success: false, error }`. Filas corruptas no crashean la lista; se loguean y se omiten.

---

## 5. Tests

```bash
npm test              # vitest watch
npm run test:run      # una sola pasada (CI)
```

Tests en `src/**/*.test.ts`. El dominio (recurrencia, parser, streaks) es el más cubierto.

---

## 6. Guía de regeneración en Android

### Prerrequisitos

1. Node.js 20+ y npm 10+
2. Android Studio con SDK Android 34 y NDK
3. Java 17 (JDK)
4. Variables de entorno: `ANDROID_HOME`, `JAVA_HOME`
5. Emulador Android API 34 corriendo (o dispositivo físico)

### Paso 1: Scaffold

```bash
npx create-expo-app@latest Agenda --template blank-typescript
cd Agenda
npx expo prebuild --platform android
```

### Paso 2: Instalar dependencias

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
  expo-auth-session expo-web-browser \
  date-fns@^4 \
  lucide-react-native \
  react-native-gesture-handler@^2 \
  react-native-reanimated@^3 \
  react-native-safe-area-context react-native-screens \
  react-native-svg \
  @react-native-community/datetimepicker \
  expo-sharing expo-document-picker

npm install --save-dev vitest @vitest/coverage-v8
```

### Paso 3: babel.config.js

`allowDeclareFields: true` es **obligatorio** para el tipado nominal de entidades:

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

### Paso 4: tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowDeclareFields": true,
    "target": "ES2022",
    "lib": ["ES2022"]
  }
}
```

### Paso 5: app.json

```json
{
  "expo": {
    "name": "Tasks",
    "slug": "agenda-personal",
    "version": "1.0.0",
    "orientation": "portrait",
    "android": {
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
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#69D2E7" }],
      "expo-location",
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

### Paso 6: Variables de entorno (.env)

```
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

### Paso 7: Google Sign-In (Android)

1. Proyecto en Google Cloud Console → habilitar Calendar API y Tasks API
2. OAuth consent screen con scopes `calendar` + `tasks`
3. Credencial OAuth para Android con SHA-1 del keystore de debug
4. Descargar `google-services.json` → raíz del proyecto
5. En `android/app/build.gradle`: `apply plugin: 'com.google.gms.google-services'`
6. En `android/build.gradle`: `classpath 'com.google.gms:google-services:4.4.0'`

### Paso 8: Orden de implementación

Implementar en este orden para evitar dependencias circulares:

```
1.  src/utils/id.ts
2.  src/domain/items/Item.types.ts
3.  src/domain/items/valueObjects/ (RepeatConfig, ReminderConfig, AcademicConfig, TravelConfig, CalendarLink)
4.  src/domain/items/Item.ts + Item.inputs.ts + ItemRepository.ts + index.ts
5.  src/domain/habits/ (Habit, HabitReminder, HabitOccurrence, HabitRepository, index)
6.  src/domain/subjects/Subject.ts + index.ts
7.  src/domain/settings/ (types, Settings, LicenseUsage, repositories)
8.  src/domain/calendar/ + holidays/
9.  src/infrastructure/persistence/sqlite/db.ts
10. src/infrastructure/persistence/sqlite/ (itemRow, itemRepository, habitRepository, subjectRepository)
11. src/infrastructure/persistence/asyncstorage/settingsRepository.ts
12. src/infrastructure/calendar/googleCalendarRepository.ts
13. src/infrastructure/tasks/googleTasksRepository.ts
14. src/infrastructure/notifications/ (itemNotifications, habitNotifications)
15. src/infrastructure/maps/ (googlePlaces, travelTime)
16. src/app/container.ts
17. src/state/googleAuthStore.ts
18. src/application/items/useItems.ts + useTaskEntries.ts + hooks background
19. src/application/habits/useHabits.ts
20. src/application/subjects/useSubjects.ts
21. src/application/settings/ (useSettings, useDataExport, useDataImport)
22. src/application/calendar/ (useGoogleCalendar, useCalendarDeleteQueue, useCalendarSyncRecovery)
23. src/mobile/theme/ (tokens, useAppTheme, CategoryGlyph, categoryIcons)
24. src/mobile/components/ (MonthCalendar, ProgressRing, ReminderPanel, RepeatPanel, FloatingAddButton, ItemCard, SwipeableItemCard, HabitCard)
25. src/mobile/modals/ (QuickAddSheet, AddGoalSheet, AddHabitSheet, ItemDetailModal, SettingsModal, HabitStatsModal)
26. src/mobile/screens/ (TaskScreen, GoalsScreen, HabitsScreen, StudiesScreen)
27. src/mobile/navigation/MainTabs.tsx
28. App.tsx + index.js
```

### Paso 9: Verificar el build

```bash
npm run android          # debug en emulador
# Si hay errores de Metro:
npx expo start --clear

# Build release APK:
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

El skill `/install-app` hace build release e instala en dispositivo conectado.

---

## 7. Troubleshooting frecuente

| Síntoma | Causa | Fix |
|---|---|---|
| `allowDeclareFields` error en build | Babel config incorrecto | Agregar `allowDeclareFields: true` en babel.config.js |
| App crashea al abrir DateTimePicker | Modal anidado en Android | Mover DateTimePicker fuera del Modal |
| Notificaciones no llegan a la hora exacta | Falta permiso `USE_EXACT_ALARM` | Ajustes → Recordatorios → Permitir alarmas exactas |
| Google Sign-In falla con `SIGN_IN_CANCELLED` | SHA-1 no registrado | Agregar SHA-1 del keystore de debug en Google Cloud Console |
| Items no aparecen tras crear | React Query no invalida | Llamar `queryClient.invalidateQueries({ queryKey: ['items'] })` |
| DB locked error | `WAL` mode no activo | Verificar `PRAGMA journal_mode = WAL` al init de DB |
| Dark mode no aplica | Colores hardcodeados | Reemplazar colores literales por `colors.*` tokens |
| Hábito muestra count incorrecto | `habit_completions` desincronizado | Verificar que add/remove de ocurrencias actualice ambas tablas en transacción |
