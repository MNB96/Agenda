# Migración a Android nativo (Kotlin + Jetpack Compose)

Guía completa para portar Agenda desde React Native/Expo a una app Android nativa con Kotlin y Jetpack Compose. La arquitectura Clean Architecture se mantiene igual — solo cambian los lenguajes y las librerías de cada capa.

---

## 1. Equivalencias de stack

| React Native / Expo | Android Kotlin | Notas |
|---|---|---|
| React Native + Hermes | Kotlin + JVM | Lenguaje + runtime |
| Expo | Android Studio + AGP | Toolchain |
| Jetpack Compose | Jetpack Compose | UI nativo (no cambia — ya es el equivalente) |
| TypeScript | Kotlin | Tipado estático, sealed classes ≈ discriminated unions |
| `@react-navigation/bottom-tabs` | `NavigationBar` + `NavController` | Navigation component |
| `@tanstack/react-query` | `ViewModel` + `StateFlow` + `Repository` | Corrutinas + suspend functions |
| `zustand` | `ViewModel` a nivel Application | Estado global compartido |
| `expo-sqlite` | **Room** | ORM sobre SQLite; mismo schema DDL |
| `@react-native-async-storage/async-storage` | **Jetpack DataStore** (Preferences) | Reemplaza AsyncStorage |
| `expo-notifications` | `NotificationCompat` + `AlarmManager` / `WorkManager` | Notificaciones locales exactas |
| `expo-location` | `FusedLocationProviderClient` | Location API |
| `@react-native-google-signin/google-signin` | **Credential Manager** API | Google OAuth en Android |
| `expo-auth-session` | (no aplica en Android nativo) | — |
| `date-fns` (locale es) | `java.time` + `kotlinx-datetime` | Mismo locale |
| `lucide-react-native` | Material Icons + `compose-icons` o SVG custom | Iconos |
| `react-native-gesture-handler` | `Modifier.swipeable` + `anchoredDraggable` en Compose | Gestures |
| `react-native-svg` | `Canvas` API o librería `accompanist` | SVG (ProgressRing) |
| `react-native-reanimated` | `Animatable` / `animate*` en Compose | Animaciones |
| `vitest` | `JUnit 5` + `kotlin-test` + `MockK` | Tests unitarios |
| Hilt (no existe en RN) | **Hilt** (recomendado) | DI equivalente a container.ts |

---

## 2. Estructura de proyecto Android

La arquitectura Clean Architecture es idéntica — solo cambia el lenguaje:

```
app/src/main/
  java/com/agenda/personal/
    domain/
      items/
        Item.kt                 ← data class sealed (Task / Goal)
        ItemRepository.kt       ← interface
        valueObjects/
          RepeatConfig.kt
          ReminderConfig.kt
          AcademicConfig.kt
          TravelConfig.kt
          CalendarLink.kt
        services/
          RecurrenceService.kt
          QuickInputParser.kt
          ExamDetector.kt
      habits/
        Habit.kt
        HabitOccurrence.kt
        HabitRepository.kt
        services/
          StreaksService.kt
      subjects/
        Subject.kt
        SubjectRepository.kt
        AttendanceService.kt
      settings/
        Settings.kt
        LicenseUsage.kt
        SettingsRepository.kt
    data/                       ← infrastructure/
      db/
        AppDatabase.kt          ← Room database
        ItemDao.kt
        HabitDao.kt
        SubjectDao.kt
        converters/
          RepeatConfigConverter.kt   ← TypeConverter (JSON)
          ReminderConfigConverter.kt
      datastore/
        SettingsDataStore.kt    ← DataStore<Preferences>
      calendar/
        GoogleCalendarRepository.kt
      tasks/
        GoogleTasksRepository.kt
      notifications/
        ItemNotificationService.kt
        HabitNotificationService.kt
    presentation/               ← application/ + mobile/
      items/
        ItemsViewModel.kt       ← useItems.ts
        TaskEntriesViewModel.kt ← useTaskEntries.ts
      habits/
        HabitsViewModel.kt
      subjects/
        SubjectsViewModel.kt
      settings/
        SettingsViewModel.kt
      ui/
        screens/
          TaskScreen.kt
          StudiesScreen.kt
          GoalsScreen.kt
          HabitsScreen.kt
        modals/
          QuickAddSheet.kt
          ItemDetailSheet.kt
          AddGoalSheet.kt
          AddHabitSheet.kt
          SettingsModal.kt
          HabitStatsSheet.kt
        components/
          ItemCard.kt
          SwipeableItemCard.kt
          HabitCard.kt
          MonthCalendar.kt
          ProgressRing.kt
          ReminderPanel.kt
          RepeatPanel.kt
        theme/
          Color.kt              ← ThemeTokens light + dark
          Theme.kt              ← MaterialTheme custom
          Type.kt               ← Typography
    di/
      AppModule.kt              ← Hilt: singletons de repositorios
    MainActivity.kt             ← Entry point
```

---

## 3. Domain layer → Kotlin (casi 1:1)

### Item

TypeScript usa clases abstractas + namespace estático. En Kotlin se usa `sealed class`:

```kotlin
// TypeScript: type ItemType = 'task' | 'goal'
// Kotlin:
sealed class Item {
    abstract val id: String
    abstract val title: String
    abstract val status: ItemStatus
    abstract val important: Boolean
    abstract val reminderOnly: Boolean
    abstract val repeatRule: RepeatRule?
    abstract val repeatConfig: RepeatConfig?
    abstract val parentId: String?
    abstract val categoryId: String?
    abstract val startDate: LocalDate?
    abstract val startTime: LocalTime?
    abstract val endDate: LocalDate?
    abstract val endTime: LocalTime?
    abstract val deadline: LocalDate?
    abstract val reminderConfig: List<ReminderConfig>?
    abstract val travelConfig: TravelConfig?
    abstract val academicConfig: AcademicConfig?
    abstract val syncToCalendar: Boolean
    abstract val calendarLink: CalendarLink?
    abstract val calendarSyncPending: Boolean
    abstract val notificationIds: List<String>
    abstract val createdAt: Instant
    abstract val updatedAt: Instant
    abstract val completedAt: Instant?

    data class Task(/* todos los campos */) : Item()
    data class Goal(/* todos los campos */) : Item()
}

enum class ItemStatus { ACTIVE, COMPLETED }
enum class RepeatRule { NONE, HOURLY, DAILY, WEEKLY, MONTHLY, YEARLY }
```

### Namespace Item → companion object + extension functions

```kotlin
// TypeScript: Item.create(), Item.update(), Item.complete()
// Kotlin: companion object para factory, extension functions para mutaciones

companion object {
    fun create(input: NewItemInput): Item { /* valida, lanza excepciones */ }
    fun hydrate(props: Map<String, Any?>): Result<Item>  // Result<T> ≈ {success, item} | {success:false}
}

// Extension functions:
fun Item.complete(subtasks: List<Item>): Item
fun Item.reopen(): Item
fun Item.linkCalendar(link: CalendarLink?): Item
fun Item.markSyncPending(): Item
fun Item.linkNotifications(ids: List<String>): Item   // NO modifica updatedAt
fun Item.canComplete(subtasks: List<Item>): Boolean
```

### Value objects

```kotlin
// TypeScript interface → Kotlin data class (inmutable)
data class RepeatConfig(
    val unit: RepeatUnit,         // enum: HOUR, DAY, WEEK, MONTH, YEAR
    val interval: Int,
    val daysOfWeek: List<Int>?,   // 0=lun..6=dom. Solo para WEEK
    val end: RepeatEnd,           // NEVER, ON_DATE, AFTER_OCCURRENCES
    val endDate: LocalDate?,
    val occurrences: Int?,
    val occurrencesDone: Int = 0
)

data class ReminderConfig(
    val id: String,
    val mode: ReminderMode,       // RELATIVE, DEPARTURE
    val minutesBefore: Int = 0,
    val persistent: Boolean = false,
    val alarmType: AlarmType = AlarmType.NOTIFICATION
)

data class AcademicConfig(
    val studyTimeBefore: StudyTime?,  // HALF, FULL
    val grade: Float?
)
```

### Servicios de dominio

```kotlin
// recurrence.ts → RecurrenceService.kt
object RecurrenceService {
    fun buildNextOccurrence(item: Item): Item?
    fun catchUpOverdueOccurrence(item: Item, now: Instant): Item?
    private fun computeNextDate(base: LocalDateTime, config: RepeatConfig): LocalDateTime
    private const val MAX_CATCH_UP_STEPS = 20_000
}

// streaks.ts → StreaksService.kt
object StreaksService {
    data class StreakResult(val current: Int, val best: Int)
    fun computeStreaks(completionDates: List<LocalDate>, regularity: HabitRegularity, now: LocalDate): StreakResult
    fun weekCompletionStatus(completionDates: List<LocalDate>, now: LocalDate): List<WeekDayStatus>
}

// examDetector.ts → ExamDetector.kt
object ExamDetector {
    private val EXAM_KEYWORDS = listOf("parcial", "examen", "final", "recuperatorio", ...)
    fun isExamTask(item: Item): Boolean
}

// quickInputParser.ts → QuickInputParser.kt
object QuickInputParser {
    data class ParsedInput(
        val cleanTitle: String,
        val startDate: LocalDate?,
        val startTime: LocalTime?,
        val deadline: LocalDate?,
        val location: String?
    )
    fun parse(input: String, now: LocalDate = LocalDate.now()): ParsedInput
}
```

---

## 4. Data layer → Room

### AppDatabase.kt

```kotlin
@Database(
    entities = [ItemEntity::class, HabitEntity::class, HabitCompletionEntity::class,
                HabitOccurrenceEntity::class, SubjectEntity::class],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun itemDao(): ItemDao
    abstract fun habitDao(): HabitDao
    abstract fun subjectDao(): SubjectDao
}
```

### Entidades Room (mismo schema DDL)

```kotlin
@Entity(tableName = "items",
    indices = [Index("status"), Index("parentId")])
data class ItemEntity(
    @PrimaryKey val id: String,
    val status: String,           // 'active' | 'completed'
    val type: String,             // 'task' | 'goal'
    val parentId: String?,
    val categoryId: String?,
    val startDate: String?,       // YYYY-MM-DD
    val deadline: String?,
    val completedAt: String?,
    val googleCalendarId: String?,
    val googleCalendarEventId: String?,
    val calendarSyncPending: Int, // 0/1
    val createdAt: String,
    val updatedAt: String,
    val data: String              // JSON con todos los demás campos
)

@Entity(tableName = "habit_completions",
    primaryKeys = ["habitId", "date"])
data class HabitCompletionEntity(
    val habitId: String,
    val date: String,             // YYYY-MM-DD
    val count: Int
)

@Entity(tableName = "habit_occurrences",
    indices = [Index("habitId"), Index(value = ["habitId", "occurredAt"])],
    foreignKeys = [ForeignKey(entity = HabitEntity::class,
        parentColumns = ["id"], childColumns = ["habitId"],
        onDelete = ForeignKey.CASCADE)]
)
data class HabitOccurrenceEntity(
    @PrimaryKey val id: String,
    val habitId: String,
    val occurredAt: String,       // ISO timestamp
    val source: String,           // 'manual' | 'notification'
    val createdAt: String,
    val updatedAt: String
)

@Entity(tableName = "subjects")
data class SubjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val classesPerWeek: Int,      // legacy name → entity field: totalClasses
    val absences: Int,
    val createdAt: String,
    val updatedAt: String
)
```

### TypeConverters para JSON

```kotlin
// Los campos JSON del dominio (repeatConfig, reminderConfig, etc.)
// se guardan como String JSON en la columna data de items.
// En el repositorio, se deserializan con kotlinx.serialization o Gson.

class Converters {
    private val json = Json { ignoreUnknownKeys = true }

    @TypeConverter
    fun repeatConfigToString(config: RepeatConfig?): String? =
        config?.let { json.encodeToString(it) }

    @TypeConverter
    fun stringToRepeatConfig(value: String?): RepeatConfig? =
        value?.let { json.decodeFromString(it) }

    // Igual para ReminderConfig, AcademicConfig, TravelConfig, CalendarLink
}
```

### ItemDao

```kotlin
@Dao
interface ItemDao {
    @Query("SELECT * FROM items WHERE status != 'completed'")
    fun listActive(): Flow<List<ItemEntity>>

    @Query("SELECT * FROM items WHERE status = 'completed' ORDER BY completedAt DESC LIMIT :limit OFFSET :offset")
    suspend fun listCompleted(limit: Int, offset: Int): List<ItemEntity>

    @Query("SELECT * FROM items WHERE id = :id")
    suspend fun getById(id: String): ItemEntity?

    @Query("SELECT * FROM items WHERE parentId IN (:ids)")
    suspend fun getByParentIds(ids: List<String>): List<ItemEntity>

    @Query("SELECT * FROM items WHERE calendarSyncPending = 1")
    suspend fun listSyncPending(): List<ItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(item: ItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveMany(items: List<ItemEntity>)

    @Query("DELETE FROM items WHERE id = :id")
    suspend fun remove(id: String)

    @Query("DELETE FROM items WHERE id IN (:ids)")
    suspend fun removeMany(ids: List<String>)
}
```

### Invariante de hábitos (doble tabla)

```kotlin
// En HabitDao, addOccurrence y removeOccurrence deben actualizar
// AMBAS tablas en una @Transaction:

@Dao
interface HabitDao {
    @Transaction
    suspend fun addOccurrence(occurrence: HabitOccurrenceEntity, date: String) {
        insertOccurrence(occurrence)
        upsertCompletion(occurrence.habitId, date)  // count + 1
    }

    @Transaction
    suspend fun removeOccurrence(id: String, habitId: String, date: String) {
        deleteOccurrence(id)
        decrementCompletion(habitId, date)  // count - 1, delete if count = 0
    }

    @Query("UPDATE habit_completions SET count = count + 1 WHERE habitId = :habitId AND date = :date")
    suspend fun incrementCompletion(habitId: String, date: String)

    // Si no existe el row: INSERT OR IGNORE + UPDATE
    @Query("INSERT OR IGNORE INTO habit_completions (habitId, date, count) VALUES (:habitId, :date, 0)")
    suspend fun ensureCompletion(habitId: String, date: String)
}
```

---

## 5. DataStore → reemplaza AsyncStorage

```kotlin
// src/data/datastore/SettingsDataStore.kt

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("agenda_settings")

val THEME_KEY = stringPreferencesKey("themePreference")
val EXAM_LEAVE_DAYS_KEY = intPreferencesKey("availableExamLeaveDaysPerYear")
val SHOW_CATEGORY_ICONS_KEY = booleanPreferencesKey("showCategoryIcons")
val SELECTED_CALENDAR_IDS_KEY = stringPreferencesKey("selectedCalendarIds")  // JSON array

// Claves equivalentes a AsyncStorage:
// 'agenda:main'                → DataStore<Preferences>
// '@agenda/semester_config_v1' → DataStore<Preferences> (JSON)
// '@agenda/license-usages'     → DataStore<Preferences> (JSON array)
// 'agenda:google-auth'         → EncryptedSharedPreferences (tokens sensibles)
```

**Nota:** para el token de Google OAuth, usar `EncryptedSharedPreferences` en lugar de DataStore estándar, ya que contiene datos sensibles.

---

## 6. ViewModel → reemplaza hooks de React Query

### ItemsViewModel (reemplaza useItems.ts)

```kotlin
@HiltViewModel
class ItemsViewModel @Inject constructor(
    private val itemRepository: ItemRepository,
    private val calendarRepository: CalendarRepository,
    private val notificationService: ItemNotificationService,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    // StateFlow público (equivale a query.data en React Query)
    val activeItems: StateFlow<List<Item>> = itemRepository.listActive()
        .map { entities -> entities.mapNotNull { it.toDomain() } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    // Paginación de completadas (equivale a loadMoreCompleted)
    private val _completedItems = MutableStateFlow<List<Item>>(emptyList())
    val completedItems: StateFlow<List<Item>> = _completedItems.asStateFlow()
    private var completedPage = 0

    fun loadMoreCompleted() = viewModelScope.launch {
        val newPage = itemRepository.listCompleted(limit = 30, offset = completedPage * 30)
        _completedItems.update { it + newPage.mapNotNull { e -> e.toDomain() } }
        completedPage++
    }

    // Mutaciones (equivalen a createItem, updateItem, etc.)
    fun createItem(input: NewItemInput) = viewModelScope.launch {
        val item = Item.create(input)
        itemRepository.save(item)
        notificationService.schedule(item)
        if (item.syncToCalendar) syncToCalendar(item)
    }

    fun completeItem(item: Item, subtasks: List<Item>) = viewModelScope.launch {
        val completed = item.complete(subtasks)
        notificationService.cancel(item)
        val linked = completed.linkNotifications(emptyList())
        itemRepository.save(linked)
    }

    // Los ViewModels observan con collectAsState() en los Composables
}
```

### GoogleAuthViewModel (reemplaza googleAuthStore.ts)

```kotlin
// En lugar de Zustand, un ViewModel de scope Application.
// Se comparte entre todos los ViewModels que necesiten el token.

@HiltViewModel
class GoogleAuthViewModel @Inject constructor(
    private val authRepository: GoogleAuthRepository,
    private val encryptedPrefs: EncryptedSharedPreferences
) : ViewModel() {
    private val _authState = MutableStateFlow<AuthState>(AuthState.Unknown)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    sealed class AuthState {
        object Unknown : AuthState()
        data class Connected(val accessToken: String, val email: String) : AuthState()
        data class Issue(val type: String) : AuthState()  // "expired" | "unauthorized"
        object Disconnected : AuthState()
    }

    fun connect() { /* Credential Manager flow */ }
    fun disconnect() { /* signOut + limpiar prefs */ }
    fun refreshToken() { /* silent refresh */ }
}
```

---

## 7. UI → Jetpack Compose

### Patrón general

```kotlin
// React Native:
const TaskScreen = () => {
  const { colors } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  return <View style={styles.container}>...</View>
}

// Kotlin Compose:
@Composable
fun TaskScreen(
    viewModel: ItemsViewModel = hiltViewModel(),
    onOpenItemEditor: (String) -> Unit,
) {
    val colors = MaterialTheme.colorScheme   // equivalente a colors
    val activeItems by viewModel.activeItems.collectAsState()
    // No hay StyleSheet — todo inline con Modifier o variables locales
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        // ...
    }
}
```

### ThemeTokens → MaterialTheme

```kotlin
// src/presentation/ui/theme/Color.kt

// Light
val LightColors = lightColorScheme(
    primary = Color(0xFF69D2E7),
    secondary = Color(0xFFA7DBD8),
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFFFFFFF),
    error = Color(0xFFFA6900),
    onPrimary = Color(0xFF263238),
    onBackground = Color(0xFF263238),
    // ...
)

// Dark
val DarkColors = darkColorScheme(
    primary = Color(0xFF69D2E7),
    background = Color(0xFF0E191D),
    surface = Color(0xFF111F24),
    onBackground = Color(0xFFF5F7F4),
    // ...
)

// Tokens custom (los que no mapean a Material3 directamente):
data class ExtendedColors(
    val primarySoft: Color,
    val accent: Color,
    val accentSoft: Color,
    val accentStrong: Color,
    val surfaceSecondary: Color,
    val surfaceElevated: Color,
    val borderColor: Color,
    val borderStrong: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val cream: Color,
)

val LocalExtendedColors = staticCompositionLocalOf { ExtendedColors(...) }

// Acceso:
val ext = LocalExtendedColors.current
ext.accent     // = colors.accent en RN
ext.textMuted  // = colors.textMuted en RN
```

### ThemePreference (equivale a themePreference en Settings)

```kotlin
// src/presentation/ui/theme/Theme.kt
@Composable
fun AgendaTheme(
    themePreference: ThemePreference = ThemePreference.SYSTEM,
    content: @Composable () -> Unit
) {
    val darkTheme = when (themePreference) {
        ThemePreference.DARK -> true
        ThemePreference.LIGHT -> false
        ThemePreference.SYSTEM -> isSystemInDarkTheme()
    }
    val colors = if (darkTheme) DarkColors else LightColors
    val extColors = if (darkTheme) DarkExtendedColors else LightExtendedColors

    CompositionLocalProvider(LocalExtendedColors provides extColors) {
        MaterialTheme(colorScheme = colors, content = content)
    }
}
```

---

## 8. Navegación → NavController + BottomNavigationBar

```kotlin
// React Native: @react-navigation/bottom-tabs
// Kotlin: NavController + NavigationBar de Material3

sealed class Screen(val route: String) {
    object Tasks : Screen("tasks")
    object Studies : Screen("studies")
    object Goals : Screen("goals")
    object Habits : Screen("habits")
}

@Composable
fun MainScreen() {
    val navController = rememberNavController()
    val currentRoute by navController.currentBackStackEntryAsState()

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.primary
            ) {
                NavigationBarItem(
                    selected = currentRoute?.destination?.route == Screen.Tasks.route,
                    onClick = { navController.navigate(Screen.Tasks.route) },
                    icon = { Icon(Icons.Default.CheckList, "Tareas") },
                    label = { Text("Tareas") }
                )
                // ... Tasks, Studies, Goals, Habits
            }
        },
        floatingActionButton = {
            if (!isAnyModalOpen) {
                FloatingActionButton(onClick = { /* abrir FAB */ }) {
                    Icon(Icons.Default.Add, "Agregar")
                }
            }
        }
    ) { paddingValues ->
        NavHost(navController, startDestination = Screen.Tasks.route) {
            composable(Screen.Tasks.route) { TaskScreen(...) }
            composable(Screen.Studies.route) { StudiesScreen(...) }
            composable(Screen.Goals.route) { GoalsScreen(...) }
            composable(Screen.Habits.route) { HabitsScreen(...) }
        }
    }
}
```

Los modales (QuickAddSheet, ItemDetailModal, etc.) se implementan como `ModalBottomSheet` de Material3 o `Dialog`:

```kotlin
// QuickAddSheet → ModalBottomSheet
if (showQuickAdd) {
    ModalBottomSheet(onDismissRequest = { showQuickAdd = false }) {
        QuickAddSheetContent(...)
    }
}

// ItemDetailModal → fullscreen dialog
if (editingItemId != null) {
    Dialog(
        onDismissRequest = { editingItemId = null },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        ItemDetailContent(itemId = editingItemId!!, ...)
    }
}
```

---

## 9. Swipe → Compose gestures

```kotlin
// react-native-gesture-handler → Modifier.anchoredDraggable

@Composable
fun SwipeableItemCard(
    item: Item,
    onComplete: () -> Unit,
    onDelete: () -> Unit,
    content: @Composable () -> Unit
) {
    val density = LocalDensity.current
    val anchors = DraggableAnchors {
        SwipeState.Start at 0f
        SwipeState.CompleteRevealed at with(density) { 72.dp.toPx() }
        SwipeState.DeleteRevealed at with(density) { -72.dp.toPx() }
    }
    val state = remember { AnchoredDraggableState(initialValue = SwipeState.Start, anchors = anchors) }

    Box {
        // Fondo izquierda (completar): verde #A7DBD8
        // Fondo derecha (eliminar): rojo #FA6900
        Box(Modifier.matchParentSize()) {
            // Acción completar (deslizar derecha)
            Box(modifier = Modifier.align(Alignment.CenterStart).width(72.dp).background(Color(0xFFA7DBD8))) {
                Text("✓", color = Color.White, fontSize = 22.sp)
            }
            // Acción eliminar (deslizar izquierda)
            Box(modifier = Modifier.align(Alignment.CenterEnd).width(72.dp).background(Color(0xFFFA6900))) {
                Icon(Icons.Default.Delete, tint = Color.White)
            }
        }
        // Contenido del card
        Box(Modifier.offset { IntOffset(state.requireOffset().roundToInt(), 0) }
            .anchoredDraggable(state, Orientation.Horizontal)) {
            content()
        }
    }

    // Detectar cuando supera el umbral:
    LaunchedEffect(state.currentValue) {
        when (state.currentValue) {
            SwipeState.CompleteRevealed -> { onComplete(); state.animateTo(SwipeState.Start) }
            SwipeState.DeleteRevealed   -> { onDelete()  ; state.animateTo(SwipeState.Start) }
            else -> {}
        }
    }
}
```

---

## 10. Notificaciones → NotificationCompat + AlarmManager

```kotlin
// expo-notifications → NotificationCompat + AlarmManager

// Canal "recordatorios" (HIGH):
val channelRecordatorios = NotificationChannelCompat.Builder("recordatorios", NotificationManagerCompat.IMPORTANCE_HIGH)
    .setName("Recordatorios")
    .setVibrationPattern(longArrayOf(0, 250, 250, 250))
    .build()

// Canal "alarmas" (MAX):
val channelAlarmas = NotificationChannelCompat.Builder("alarmas", NotificationManagerCompat.IMPORTANCE_MAX)
    .setName("Alarmas")
    .setVibrationPattern(longArrayOf(0, 500, 200, 500))
    .build()

NotificationManagerCompat.from(context).apply {
    createNotificationChannel(channelRecordatorios)
    createNotificationChannel(channelAlarmas)
}

// Acción "Completar" en la notificación:
val completeIntent = Intent(context, CompleteItemReceiver::class.java).apply {
    putExtra("itemId", item.id)
}
val completePendingIntent = PendingIntent.getBroadcast(
    context, item.id.hashCode(), completeIntent,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
)

val notification = NotificationCompat.Builder(context, channelId)
    .setSmallIcon(R.drawable.ic_notification)
    .setContentTitle(item.title)
    .addAction(0, "Completar", completePendingIntent)  // ITEM_COMPLETION_ACTION
    .build()

// Programar con AlarmManager (para hora exacta):
val alarmManager = context.getSystemService(AlarmManager::class.java)
alarmManager.setExactAndAllowWhileIdle(
    AlarmManager.RTC_WAKEUP,
    triggerAtMillis,
    pendingIntent
)
// Requiere permiso USE_EXACT_ALARM (Android 12+)
```

### CompleteItemReceiver (BroadcastReceiver)

```kotlin
// Equivale a handleResponse con ITEM_COMPLETION_ACTION_ID en App.tsx

class CompleteItemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val itemId = intent.getStringExtra("itemId") ?: return
        GlobalScope.launch {  // o usar WorkManager
            val item = itemRepository.getById(itemId) ?: return@launch
            if (item.status == ItemStatus.COMPLETED) return@launch
            val subtasks = itemRepository.getByParentIds(listOf(item.id))
            val completed = item.complete(subtasks)
            notificationService.cancel(item)
            itemRepository.save(completed.linkNotifications(emptyList()))
        }
    }
}
```

---

## 11. Google OAuth → Credential Manager

```kotlin
// @react-native-google-signin/google-signin → Credential Manager API (Android 14+)
// o Google Identity Services para versiones anteriores

// build.gradle:
// implementation "androidx.credentials:credentials:1.3.0"
// implementation "com.google.android.libraries.identity.googleid:googleid:1.1.1"

val credentialManager = CredentialManager.create(context)

// Conectar:
val googleIdOption = GetGoogleIdOption.Builder()
    .setFilterByAuthorizedAccounts(false)
    .setServerClientId(WEB_CLIENT_ID)
    .setAutoSelectEnabled(true)
    .build()

val request = GetCredentialRequest(listOf(googleIdOption))

try {
    val result = credentialManager.getCredential(context, request)
    val credential = result.credential as GoogleIdTokenCredential
    val idToken = credential.idToken
    // Intercambiar idToken por accessToken en el backend o usar directamente
    googleAuthViewModel.setSession(accessToken = ..., email = credential.displayName)
} catch (e: GetCredentialException) {
    // Manejar error
}

// Desconectar:
credentialManager.clearCredentialState(ClearCredentialStateRequest())
googleAuthViewModel.disconnect()
```

---

## 12. DI → Hilt (reemplaza container.ts)

```kotlin
// src/di/AppModule.kt

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AppDatabase =
        Room.databaseBuilder(ctx, AppDatabase::class.java, "agenda.db")
            .build()

    @Provides @Singleton
    fun provideItemRepository(db: AppDatabase): ItemRepository =
        RoomItemRepository(db.itemDao())

    @Provides @Singleton
    fun provideHabitRepository(db: AppDatabase): HabitRepository =
        RoomHabitRepository(db.habitDao())

    @Provides @Singleton
    fun provideSubjectRepository(db: AppDatabase): SubjectRepository =
        RoomSubjectRepository(db.subjectDao())

    @Provides @Singleton
    fun provideSettingsRepository(@ApplicationContext ctx: Context): SettingsRepository =
        DataStoreSettingsRepository(ctx)

    @Provides @Singleton
    fun provideCalendarRepository(): CalendarRepository =
        GoogleCalendarRepositoryImpl()

    @Provides @Singleton
    fun provideTaskRepository(): TaskRepository =
        GoogleTasksRepositoryImpl()
}
```

---

## 13. MonthCalendar y ProgressRing en Compose

### MonthCalendar

```kotlin
@Composable
fun MonthCalendar(
    selectedDate: LocalDate?,
    onSelectDate: (LocalDate) -> Unit,
    accentColor: Color = MaterialTheme.colorScheme.primary
) {
    var displayMonth by remember { mutableStateOf(selectedDate ?: LocalDate.now()) }
    val daysInGrid = remember(displayMonth) { buildCalendarGrid(displayMonth) }  // siempre 42 celdas

    Column {
        // Header de navegación
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            IconButton(onClick = { displayMonth = displayMonth.minusMonths(1) }) {
                Icon(Icons.Default.ChevronLeft, "Mes anterior")
            }
            Text(displayMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale("es"))),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.clickable { })
            IconButton(onClick = { displayMonth = displayMonth.plusMonths(1) }) {
                Icon(Icons.Default.ChevronRight, "Mes siguiente")
            }
        }
        // Grid de días (LazyVerticalGrid o FlowRow)
        LazyVerticalGrid(columns = GridCells.Fixed(7)) {
            items(daysInGrid) { day ->
                val isSelected = day == selectedDate
                val isToday = day == LocalDate.now()
                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .clip(CircleShape)
                        .background(if (isSelected) accentColor else Color.Transparent)
                        .clickable(enabled = day != null) { day?.let(onSelectDate) }
                ) {
                    if (day != null) {
                        Text(day.dayOfMonth.toString(),
                            color = when {
                                isSelected -> Color.White
                                isToday    -> accentColor
                                else       -> MaterialTheme.colorScheme.onBackground
                            },
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }
                }
            }
        }
    }
}
```

### ProgressRing

```kotlin
@Composable
fun ProgressRing(
    size: Dp,
    progress: Float,           // 0f..1f
    color: Color,
    label: String,
    strokeWidth: Dp = 4.dp
) {
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val stroke = strokeWidth.toPx()
            val radius = (this.size.minDimension - stroke) / 2
            // Track (gris):
            drawArc(color = trackColor, startAngle = 0f, sweepAngle = 360f,
                useCenter = false, style = Stroke(width = stroke))
            // Fill (color):
            drawArc(color = color, startAngle = -90f, sweepAngle = 360f * progress.coerceIn(0f, 1f),
                useCenter = false, style = Stroke(width = stroke, cap = StrokeCap.Round))
        }
        Text(label, style = MaterialTheme.typography.labelSmall.copy(
            fontWeight = FontWeight.Bold,
            fontSize = with(LocalDensity.current) { (size.toPx() * 0.26f).toSp() }
        ))
    }
}
```

---

## 14. Estrategia de migración recomendada

### Opción A: Rewrite completo (recomendada para esta app)

Dado que la app no tiene backend propio y toda la data es local, un rewrite limpio es más eficiente que una migración incremental.

**Orden de trabajo:**

```
Semana 1: Setup + Domain
  1. Crear proyecto Android con Hilt, Room, Compose, Navigation
  2. Copiar lógica de domain/ (casi 1:1 a Kotlin data classes)
  3. Implementar Room (schema idéntico al DDL actual)
  4. Importar el JSON de backup actual para validar que Room persiste igual

Semana 2: Data + ViewModels
  5. Implementar repositorios Room (ItemRepository, HabitRepository, SubjectRepository)
  6. Implementar DataStore (Settings, SemesterConfig, LicenseUsage)
  7. Implementar ViewModels (ItemsViewModel, HabitsViewModel, SubjectsViewModel)
  8. Tests unitarios del dominio (RecurrenceService, StreaksService, ExamDetector)

Semana 3: UI base
  9. Theme (ThemeTokens → MaterialTheme + ExtendedColors)
  10. Componentes compartidos (ItemCard, MonthCalendar, ProgressRing)
  11. TaskScreen + GoalsScreen (sin modales aún)
  12. HabitsScreen + StudiesScreen

Semana 4: Modales y gestos
  13. QuickAddSheet (con parser NL)
  14. ItemDetailModal
  15. AddGoalSheet + AddHabitSheet
  16. SwipeableItemCard con gestos
  17. SettingsModal

Semana 5: Integraciones
  18. Notificaciones locales (AlarmManager + canales)
  19. Google OAuth (Credential Manager)
  20. Google Calendar API (Retrofit + mismos endpoints)
  21. Google Tasks API
  22. Feriados + Google Places (autocomplete)

Semana 6: Pulido + migración de datos
  23. Importar datos existentes (desde el JSON backup)
  24. Dark mode + animaciones
  25. Tests de integración
  26. Build release + firma
```

### Importar datos existentes

El JSON de exportación actual es directo de SQLite. Para migrar datos al nuevo Room:

```kotlin
// importFromBackupJson(jsonString: String)
// 1. Parsear el JSON con kotlinx.serialization
// 2. Insertar en Room con las mismas entidades
// Los IDs son strings UUID, Room los acepta directamente
// Los campos JSON (repeatConfig, etc.) se guardan en columna data como String

// El schema Room es idéntico al SQLite actual, la migración es directa.
```

---

## 15. Dependencias Gradle (build.gradle.kts)

```kotlin
// Compose
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.material3:material3")
implementation("androidx.navigation:navigation-compose:2.8.0")
implementation("androidx.activity:activity-compose:1.9.0")

// DI
implementation("com.google.dagger:hilt-android:2.51")
implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
kapt("com.google.dagger:hilt-compiler:2.51")

// Room
implementation("androidx.room:room-runtime:2.6.1")
implementation("androidx.room:room-ktx:2.6.1")
kapt("androidx.room:room-compiler:2.6.1")

// DataStore
implementation("androidx.datastore:datastore-preferences:1.1.1")

// Credential Manager (Google Sign-In)
implementation("androidx.credentials:credentials:1.3.0")
implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

// Serialización
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.0")

// HTTP (Google APIs)
implementation("com.squareup.retrofit2:retrofit:2.11.0")
implementation("com.squareup.retrofit2:converter-kotlinx-serialization:2.11.0")
implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

// Corrutinas
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

// Tests
testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
testImplementation("io.mockk:mockk:1.13.11")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
androidTestImplementation("androidx.room:room-testing:2.6.1")
```

---

## 16. Lo que NO cambia

- **Toda la lógica de negocio del dominio** — se traduce casi literalmente a Kotlin
- **El schema de base de datos** — Room usa el mismo DDL
- **El formato del JSON de exportación** — importable directamente
- **Las reglas de recurrencia** — `RecurrenceService` es puro Kotlin sin deps Android
- **La detección de examen** (`isExamTask`) — lista de keywords idéntica
- **Las categorías y sus colores** — constantes
- **Las reglas de validación** (Goal restrictions, date validations) — misma lógica
- **El flujo de licencias por examen** — misma lógica con DataStore en lugar de AsyncStorage
- **Los invariantes de hábitos** (doble tabla) — misma transacción en Room

## 17. Diferencias clave a tener en cuenta

| Aspecto | React Native | Kotlin / Compose |
|---|---|---|
| Re-render | Automático cuando cambia el state | `collectAsState()` desde `StateFlow` |
| Ciclo de vida | `useEffect` | `LaunchedEffect`, `DisposableEffect` |
| BackHandler | `BackHandler` de RN | `BackHandler` de Compose o `onBackPressed` |
| DateTimePicker | Fuera del Modal (workaround Android) | `DatePickerDialog` nativo, no hay problema de anidamiento |
| Hidratación safe | `Item.hydrate()` con `{success, item}` | `Result<Item>` de Kotlin + `mapNotNull` |
| Optimistic update | `setQueryData` de React Query | `optimisticItems` en StateFlow con merge |
| Background hooks | `useEffect` en AppShellInner | `WorkManager` + corrutinas del ViewModel |
| Toast de undo | Estado local del screen + `setTimeout` | `SnackbarHostState` + `Job` cancelable |
