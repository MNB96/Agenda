# Componentes UI y tema

Componentes compartidos en `src/mobile/components/` y sistema de tema en `src/mobile/theme/`.

---

## 1. Sistema de tema

### Patrón

Sin ThemeContext. Cada componente memoiza sus estilos:

```typescript
const { colors } = useAppTheme()
const styles = useMemo(() => createStyles(colors), [colors])

function createStyles(colors: ThemeTokens) {
  return StyleSheet.create({ ... })
}
```

`useAppTheme()` lee `Settings.themePreference` + `useColorScheme()` → devuelve `{ colors: ThemeTokens, isDark: boolean }`.

### ThemeTokens — Light

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#69D2E7` | Acción principal, tabs activos, checkboxes |
| `primarySoft` | `#7DD4E2` | Variante suave |
| `secondary` | `#A7DBD8` | Completados, éxito |
| `secondarySoft` | `#B8DDD1` | Variante suave |
| `cream` | `#E0E4CC` | Trabajo/compras |
| `creamSoft` | `#E6E5C2` | Variante suave |
| `accent` | `#F38630` | Importante, naranja |
| `accentSoft` | `#F58B27` | Variante suave |
| `accentStrong` | `#FA6900` | Rojo-naranja, vencidas |
| `accentStrongSoft` | `#FB6D00` | Variante suave |
| `overlayAccent` | `rgba(38,50,56,0.2)` | Overlay |
| `background` | `#FFFFFF` | Fondo principal |
| `surface` | `#FFFFFF` | Tarjetas, sheets |
| `surfaceSecondary` | `#FFFFFF` | Secciones internas |
| `surfaceElevated` | `#FFFFFF` | Popups, cards sobre sheets |
| `border` | `#E9F1F2` | Bordes, separadores |
| `borderStrong` | `#D8E8EA` | Bordes más marcados |
| `text` | `#263238` | Texto principal |
| `textSecondary` | `#4D6168` | Texto secundario |
| `textMuted` | `#7A8C93` | Texto apagado |
| `success` | `#A7DBD8` | Completado |
| `warning` | `#F38630` | Advertencia |
| `danger` | `#FA6900` | Error, vencida |
| `fabText` | `#FFFFFF` | Texto del FAB |
| `onPrimary` | `#263238` | Texto sobre colores primarios |

### ThemeTokens — Dark

| Token | Valor |
|---|---|
| `background` | `#0E191D` |
| `surface` | `#111F24` |
| `surfaceSecondary` | `#192B30` |
| `surfaceElevated` | `#16272C` |
| `border` | `rgba(167,219,216,0.14)` |
| `borderStrong` | `rgba(167,219,216,0.22)` |
| `text` | `#F5F7F4` |
| `textSecondary` | `#B2BEBB` |
| `textMuted` | `#7F9190` |
| `overlayAccent` | `rgba(14,25,29,0.72)` |
| `onPrimary` | `#0E191D` |
| `primary`, `accent`, `danger`, `success`, `cream`, etc. | Igual que light |

---

## 2. CategoryGlyph

Archivo: `src/mobile/theme/CategoryGlyph.tsx`

Renderiza el ícono lucide correcto para una categoría.

```typescript
interface CategoryGlyphProps {
  iconName: string   // nombre de ícono lucide (e.g. 'GraduationCap', 'Heart')
  size?: number
  color?: string
}
```

Mapa en `categoryIcons.ts`: `{ GraduationCap, Briefcase, Heart, Home, Cross, ShoppingCart, ... }`.

---

## 3. FloatingAddButton

Archivo: `src/mobile/components/FloatingAddButton.tsx`

FAB (+) global. Solo se renderiza cuando `!isAnyModalOpen`.

```typescript
// Posición y forma:
position: 'absolute'
right: 18
bottom: insets.bottom + 70 + 28   // sobre la tab bar
width: 58, height: 58
borderRadius: 999
borderWidth: 1

// Colores:
backgroundColor: colors.accent          // #F38630 normal
backgroundColor: colors.accentStrong    // #FA6900 pressed
borderColor: colors.accentSoft          // #F58B27

// Sombra:
shadowColor: colors.accent
shadowOffset: { width: 0, height: 8 }
shadowOpacity: 0.28 (light) / 0.34 (dark)
shadowRadius: 12, elevation: 6

// Ícono:
<Plus size={24} color={colors.fabText} />   // #FFFFFF

// Animación al montar: scale 0.94 → 1 (200ms)
// onPressIn: scale → 0.96 (120ms)
// onPressOut: scale → 1 (160ms)
```

---

## 4. ItemCard

Archivo: `src/mobile/components/ItemCard.tsx`

Tarjeta de item (tarea o meta). Usada dentro de `SwipeableItemCard` y directamente en GoalsScreen.

### Container

```typescript
backgroundColor: colors.surface
borderRadius: 0             // sin redondeo, separación por línea
paddingVertical: 16, paddingHorizontal: 4
borderBottomWidth: 1, borderColor: colors.border
borderLeftWidth: 3, borderLeftColor: 'transparent'

// Si important === true:
borderLeftColor: '#F38630'
backgroundColor: '#F38630' + '0D'   // naranja muy transparente
```

### Checkbox (círculo izquierdo)

```typescript
width: 28, height: 28, borderRadius: 999, borderWidth: 1.6
borderColor: indicatorColor
backgroundColor: colors.surface

// Completado:
backgroundColor: colors.success
borderColor: colors.success

// Meta activa: muestra CategoryGlyph en lugar de círculo vacío
```

### resolveIndicatorColor

| Condición | Color |
|---|---|
| `status === 'completed'` | `colors.success` |
| `type === 'goal'` | según urgencia de meta |
| deadline ≤ 0 días | `colors.danger` |
| deadline ≤ 3 días | `colors.warning` |
| default | `colors.primary` |

### Urgencia de meta (resolveGoalUrgencyColor)

| Días hasta deadline | Color |
|---|---|
| sin deadline | `colors.cream` |
| ≤ 0 (vencida) | `colors.danger` |
| ≤ 3 | `colors.accentStrong` |
| ≤ 7 | `colors.accentSoft` |
| ≤ 14 | `colors.accent` |
| ≤ 30 | `colors.primary` |
| > 30 | `colors.cream` |

### Íconos de indicador (esquina derecha)

```typescript
<Star size={16} color="#F38630" fill="#F38630" />           // important
<Bell size={16} color={colors.accent} />                    // reminderOnly
<CalendarCheck size={16} color="#4285F4" />                 // calendarLink (azul Google)
<Repeat size={16} color={colors.textMuted} />               // repeatRule activo
<AlarmClock size={17} color={colors.accent} />              // alarmType === 'alarm'
<Bell size={17} color={colors.primary} />                   // alarmType === 'notification'
// AlarmClock tiene prioridad sobre Bell si hay ambos tipos
```

### Barra de progreso de subtareas

```typescript
progressBarTrack: { flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.border }
progressBarFill: { height: 4, borderRadius: 999, backgroundColor: colors.primary }
// width: `${(subtaskDone / subtasks.length) * 100}%`
progressLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' }
// Texto: "N de M"
```

### Textos

```typescript
title: { fontSize: 17, fontWeight: '500', color: colors.text }
// Completada: textDecorationLine: 'line-through', color: colors.textMuted

overdueDeadlineLabel: { fontSize: 14, color: colors.danger, fontWeight: '600' }
meta: { fontSize: 14, color: colors.textSecondary, marginTop: 3 }
goalCountdown: { fontSize: 14, color: indicatorColor, fontWeight: '600', marginTop: 3 }
// "Vence hoy" / "Vence mañana" / "Faltan N días"

locationMeta: { fontSize: 14, color: colors.textMuted, marginTop: 3 }
// Pressable que abre Google Maps
```

---

## 5. SwipeableItemCard

Archivo: `src/mobile/components/SwipeableItemCard.tsx`

Envuelve `ItemCard` con soporte de swipe.

```typescript
// Swipeable config:
friction: 2
rightThreshold: 80    // deslizar derecha = completar
leftThreshold: 80     // deslizar izquierda = eliminar

// Acción derecha (completar):
backgroundColor: colors.success    // #A7DBD8
width: 72
// Texto: "✓", fontSize: 22, fontWeight: '700', color: '#FFFFFF'

// Acción izquierda (eliminar):
backgroundColor: colors.danger     // #FA6900
width: 72
// Ícono: <Trash2 size={22} color="#FFFFFF" />
```

La acción de completar (derecha) NO se renderiza si `item.status === 'completed'` o `item.reminderOnly === true`.

---

## 6. HabitCard

Archivo: `src/mobile/components/HabitCard.tsx`

Ver [habitos.md](./habitos.md) para la documentación completa del componente.

---

## 7. MonthCalendar

Archivo: `src/mobile/components/MonthCalendar.tsx`

Calendario mensual embebido en modales. Siempre 6 filas (42 celdas) para que no cambie de altura entre meses.

```typescript
interface MonthCalendarProps {
  selectedDate?: string       // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void
  colors: ThemeTokens
  accentColor?: string        // default: colors.primary
}
```

```typescript
// Estilos clave:
monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 }
monthLabel: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }

// Labels días de semana: ['L', 'M', 'M', 'J', 'V', 'S', 'D']
weekdayLabel: { width: '14.2857%', textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textMuted }

calCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }
calDayMarker: { width: 34, height: 34, borderRadius: 17 }
// Seleccionado: backgroundColor: accentColor
// Hoy (no seleccionado): borderWidth: 1, borderColor: accentColor

calDayText: { fontSize: 14, color: colors.text }
// Seleccionado: color: colors.onPrimary, fontWeight: '700'
// Hoy (no seleccionado): color: accentColor, fontWeight: '700'
```

---

## 8. ProgressRing

Archivo: `src/mobile/components/ProgressRing.tsx`

SVG ring para hábitos daily (usa `react-native-svg`).

```typescript
interface ProgressRingProps {
  size: number
  strokeWidth?: number   // default: 4
  progress: number       // 0..1
  color: string
  label: string
}
```

Implementación:
```typescript
// radius = (size - strokeWidth) / 2
// circumference = 2 * Math.PI * radius
// dashOffset = circumference * (1 - clamp(progress, 0, 1))
// Rotación SVG: -90° para empezar en el tope
// Label central: fontSize: size * 0.26, fontWeight: '800', position: 'absolute'
```

Dos círculos: track (`colors.border`) + fill (prop `color`).

---

## 9. ReminderPanel

Archivo: `src/mobile/components/ReminderPanel.tsx`

Panel compartido entre `ItemDetailModal` y `QuickAddSheet`. Recibe props `indent` y `rowDividers`.

```typescript
// Container:
backgroundColor: colors.surfaceSecondary
borderRadius: 10, overflow: 'hidden'
// Con indent (ItemDetailModal): marginLeft: 36

// Recordatorio agregado:
addedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }

// Pill de tipo (Notif./Alarma):
typePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }
typePillAlarm: { borderColor: colors.accent + '60', backgroundColor: colors.accent + '15' }

// Presets fijos:
// "A la hora" (0) · "10 min antes" · "30 min antes" · "1 hora antes" · "1 día antes"
presetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14 }
presetText: { fontSize: 14, color: colors.text }
// Activo: color: colors.primary, fontWeight: '600' + <Check size={16} />

// Campo personalizado:
customInput: { width: 72, textAlign: 'center', borderWidth: 1, borderRadius: 8 }
customUnitBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }
// Activo: borderColor: colors.primary, backgroundColor: colors.primary + '15'
customAdd: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary }
```

**Sección de viaje** (solo si `showTravelButton`): modos transporte (Car/Footprints/Bus/Bike), minutos extra, toggle "Recordarme cuándo salir", botón "Calcular tiempo de viaje".

---

## 10. RepeatPanel

Archivo: `src/mobile/components/RepeatPanel.tsx`

Modal full-screen independiente (`animationType="slide"`, `transparent={false}`).

```typescript
// Container: { flex: 1, backgroundColor: colors.background }

// Fila intervalo + unidad:
intervalInput: { width: 60, height: 44, textAlign: 'center', fontSize: 16, borderRadius: 8 }
unitBtn: { flex: 1, height: 44, paddingHorizontal: 14, borderRadius: 8 }

// Días de semana (solo si unit='week'):
weekdayCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary
// Labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Radio buttons de fin:
radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border }
// Activo: borderColor: colors.primary
radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }
```

**Opciones de finalización:** "Nunca" · "El [fecha]" · "Después de [N] repeticiones"

**Unidades:** hora · día · semana · mes · año

**UNIT_TO_RULE:** `{ hour: 'hourly', day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }`

**Crítico:** el `DateTimePicker` se renderiza **fuera** del Modal (evita crash de diálogos anidados en Android).

---

## 11. Notas de accesibilidad

Todos los `Pressable` interactivos tienen:
- `accessibilityRole="button"`
- `accessibilityLabel` descriptivo en español

Ejemplos:
- HabitCard leading: `"Registrar una vez {habit.title}"` / `"Marcar {habit.title} como completado"`
- weekDot: `"Marcar Lunes"` / `"Desmarcar Martes"` / `"Miércoles (fecha futura)"`
- occurrenceChipEdit: `"Eliminar registro de las HH:mm"`
