# Hábitos — HabitsScreen, AddHabitSheet, HabitStatsModal

Tab 4 de la app. Rastreador de hábitos con streaks, multi-repetición diaria y estadísticas.

Para la arquitectura interna (habit_completions vs habit_occurrences, invariantes), ver [habits-flow.md](./habits-flow.md).

---

## 1. HabitsScreen

Archivo: `src/mobile/screens/HabitsScreen.tsx`

### Layout

```typescript
container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 10 }
```

### Secciones

Orden fijo: `['daily', 'weekly', 'monthly', 'yearly']`. Solo se renderizan las que tienen al menos un hábito.

| Sección | Regularidad | Período mostrado |
|---|---|---|
| Hoy | `daily` | Hoy |
| Esta semana | `weekly` | Semana actual |
| Este mes | `monthly` | Mes actual |
| Este año | `yearly` | Año actual |

Header de sección:
```
"Hoy · 2/5"    ← regularityLabel + completados/total del período
```

### Filtros de categoría

Chips scrollables horizontalmente. Solo muestra categorías que tienen al menos 1 hábito (`usedCategoryIds`).

Chip activo: `backgroundColor: colors.primary, borderColor: colors.primary`.

### Toast

Duración: **3200ms** (no 4000ms como tareas/metas).

```typescript
// Texto: "✓ {titulo} · HH:mm"
// Botón: "Deshacer" → llama removeOccurrence(id)
```

El sistema usa "último wins": si se crean varias operaciones en rápida sucesión, el toast de Deshacer siempre cancela solo la última ocurrencia registrada.

---

## 2. HabitCard

Archivo: `src/mobile/components/HabitCard.tsx`

### Container

```typescript
backgroundColor: colors.surface
paddingVertical: 14, paddingHorizontal: 4
borderBottomWidth: 1, borderColor: colors.border
```

### Row principal (leading | content | trailing)

#### Leading (izquierda) — tap = registrar

Si `weekStatus` existe y no está expandido y no es `isMultiDay`:
```typescript
<ProgressRing size={44} progress={doneThisWeek / 7} color={accentColor}
  label={isTodayDone ? '✓' : `${doneThisWeek}/7`} />
```

En otro caso:
```typescript
// iconCircle:
width: 44, height: 44, borderRadius: 999
backgroundColor: isMultiDay ? accentColor + '18' : accentColor + '22'

// Contenido:
// isMultiDay → "＋" fontSize: 22, fontWeight: '800', color: accentColor
// isTodayDone → <Check size={20} color={accentColor} strokeWidth={3} />
// default → <CategoryGlyph iconName size={20} color={accentColor} />
```

`accentColor` = `category.color` del hábito, o `colors.primary` si no tiene categoría.

#### Content (centro) — tap = abrir editor

```typescript
title: { fontSize: 16, fontWeight: '600', color: colors.text, numberOfLines: 1 }

// Conteo del día (N/M a la derecha del título):
todayValue: { fontSize: 13, color: colors.primary, fontWeight: '700' }
// Si count > timesPerDay: color: colors.accent (sobre la meta)

// Nombre de categoría con ícono:
categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }
// Ícono: CategoryGlyph size={12} color={colors.textMuted}
// Texto: fontSize: 12, color: colors.textMuted
```

#### Barra de progreso

```typescript
progressBarTrack: { height: 4, borderRadius: 999, backgroundColor: colors.border }
progressBarFill: { height: 4, borderRadius: 999, backgroundColor: accentColor }
// width: `${Math.min((displayCount / timesPerDay) * 100, 100)}%`
```

#### Trailing (derecha)

```typescript
trailing: { alignItems: 'flex-end', gap: 6 }

// Streak badge (si streak > 0):
backgroundColor: colors.surfaceSecondary
borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3
// <Flame size={13} color={colors.accent} />
// streakText: fontSize: 13, fontWeight: '700', color: colors.text

// ChevronDown/ChevronUp: size={18}, color={colors.textMuted}
```

### Accordion expandido

#### Sección "Hoy" — chips de ocurrencias (solo isMultiDay)

```typescript
occurrencesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }

// Chip normal:
backgroundColor: colors.surfaceSecondary
borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong
paddingHorizontal: 8, paddingVertical: 5
// Texto: fontSize: 11, fontWeight: '700', color: colors.textSecondary — hora "HH:mm"

// Chip modo edición (muestra ×):
flexDirection: 'row', alignItems: 'center', gap: 6
// "×": fontSize: 15, fontWeight: '700', color: colors.textMuted
```

Muestra hasta 4 chips, luego "+N más". Botón "Editar" arriba a la derecha cuando hay ocurrencias.

#### Sección "Esta semana" (hábitos daily)

```typescript
weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }

weekDayLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' }
// Labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D']
// isFuture: opacity: 0.35

weekDot: { width: 24, height: 24, borderRadius: 999, borderWidth: 1.6, borderColor: colors.borderStrong }
// done: backgroundColor: accentColor, borderColor: accentColor
// partial: backgroundColor: accentColor + '33', borderColor: accentColor
```

#### Barra de período (weekly/monthly/yearly)

```typescript
periodProgressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border }  // MÁS GRUESA
periodProgressFill: { height: 8, borderRadius: 999, backgroundColor: accentColor }
```

#### Botón rápido de registro

```typescript
quickAddButton: { width: 42, height: 42, borderRadius: 21 }

// Si hasTodayEntry && isTodayDone:
backgroundColor: accentColor
// Contenido: <Check size={20} color="#FFFFFF" strokeWidth={3} />

// Si isTodayDone (sin entry):
backgroundColor: 'transparent', borderWidth: 1.5, borderColor: accentColor
// Contenido: "＋" en accentColor

// Default:
backgroundColor: colors.primary
// Contenido: "＋" en #FFFFFF, fontSize: 24, fontWeight: '700'
```

#### Links de acción

```typescript
// <BarChart3 size={15} color={colors.primary} /> → "Ver estadísticas"
// <Edit2 size={15} color={colors.primary} /> → "Editar hábito"
// statsLinkText: fontSize: 14, color: colors.primary, fontWeight: '600'
```

---

## 3. AddHabitSheet

Archivo: `src/mobile/modals/AddHabitSheet.tsx`

Dual mode: compact sheet (crear) / full-screen (editar).

### Compact sheet (crear)

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }
sheet: {
  backgroundColor: colors.surface
  borderTopLeftRadius: 20, borderTopRightRadius: 20
  borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1
  borderColor: colors.border
  paddingHorizontal: 20, paddingTop: 10
  maxHeight: '86%'
}
dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }
```

### Full-screen (editar)

```typescript
fullScreenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }
fullScreenTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginLeft: 4 }
fullScreenContent: { paddingHorizontal: 20, paddingTop: 6 }
```

### Campos del formulario

```typescript
mainInput: { fontSize: 18, color: colors.text, minHeight: 40, maxHeight: 100, padding: 0 }
fieldLabel: {
  fontSize: 12, fontWeight: '700', color: colors.textMuted
  textTransform: 'uppercase', letterSpacing: 0.6
  marginTop: 14, marginBottom: 8
}
```

#### Chips genéricos (regularity, categoría, modo recordatorio)

```typescript
chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }
chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' }
// Activo: backgroundColor: colors.primary, borderColor: colors.primary
// Texto activo: color: '#FFFFFF', fontWeight: '700'
// Categoría activa: backgroundColor: cat.color, borderColor: cat.color
```

Regularidades: Diario · Semanal · Mensual · Anual

Categorías: Personal · Facultad · Casa · Salud

#### Counter card (timesPerDay)

```typescript
counterCard: {
  backgroundColor: colors.surfaceSecondary, borderRadius: 16
  borderWidth: 1, borderColor: colors.border
  paddingHorizontal: 16, paddingVertical: 12
}

counterButton: {
  width: 42, height: 42, borderRadius: 21
  backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '44'
}
counterButtonText: { fontSize: 28, lineHeight: 28, color: colors.primary, fontWeight: '600' }
counterValue: { flex: 1, textAlign: 'center', fontSize: 36, fontWeight: '800', color: colors.text, lineHeight: 42 }

// Barra de progreso del counter:
counterBarTrack: { height: 6, borderRadius: 999, backgroundColor: colors.border }
counterBarFill: { height: 6, borderRadius: 999, backgroundColor: colors.primary }
// width: Math.min(100, (timesPerDay / 20) * 100) + '%'
```

#### Recordatorios de hábito

```typescript
// Toggle activar recordatorio:
reminderToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }

// Chips de modo:
// "Cada N horas" (interval) | "N veces al día en horarios random" (random)

// Campo intervalHours:
numberInput: { width: 64, fontSize: 16, textAlign: 'center', borderWidth: 1, borderRadius: 10 }

// Botón "Sortear horarios":
rerollBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primary + '18' }

// Chips de hora aleatoria:
timeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }
timeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' }

// Ventana horaria (desde/hasta):
windowValue: { fontSize: 15, color: colors.primary, fontWeight: '600', marginTop: 2 }
```

### Lógica de cierre

- **Compact:** "Guardar" → `createHabit` → `onClose()`
- **Full-screen:** back → `handleClose()` → `updateHabit` si `hasChanges`
  - Si cambió la regularidad y hay historial → Alert de confirmación antes de guardar (la regularityChangedAt se actualiza y se cancelan/regeneran notificaciones)

### buildReminderPayload()

- `mode: 'interval'`: requiere `intervalHours > 0`
- `mode: 'random'`: si `randomTimes` está vacío, genera los tiempos automáticamente al guardar

---

## 4. HabitStatsModal

Archivo: `src/mobile/modals/HabitStatsModal.tsx`

Bottom sheet, `transparent={true}`, `animationType="slide"`.

```typescript
sheetAnchor: { flex: 1, justifyContent: 'flex-end' }
sheet: {
  backgroundColor: colors.surface
  borderTopLeftRadius: 20, borderTopRightRadius: 20
  borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1
  borderColor: colors.border, paddingHorizontal: 20, paddingTop: 10
}
dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 }

header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }
title: { fontSize: 18, fontWeight: '800', color: colors.text }
subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 1 }
```

### Estadísticas mostradas

```typescript
statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 }
statBox: {
  flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 14
  paddingVertical: 12, paddingHorizontal: 14
}
statLabel: { fontSize: 12, color: colors.textMuted }
statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 }
```

Estadísticas por hábito:

| Stat | Descripción |
|---|---|
| Racha actual | días/semanas/meses consecutivos completados |
| Mejor racha | máxima racha histórica |
| Períodos completados | total de días/semanas/meses con completitud |
| Promedio | según regularidad: por semana / por mes / por año |

Si el hábito tiene historial anterior a un cambio de regularidad (`regularityChangedAt`), muestra sección "Historial anterior" separada.

```typescript
fieldLabel: {
  fontSize: 12, fontWeight: '700', color: colors.textMuted
  textTransform: 'uppercase', letterSpacing: 0.6
  marginTop: 18, marginBottom: 10
}
emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 28, lineHeight: 20 }
```

---

## 5. Flujo completo de uso

### timesPerDay = 1 (hábito clásico)

1. Usuario ve `HabitCard` colapsada
2. Toca el leading (ícono o ProgressRing)
3. `useHabits.addOccurrence(habitId, now)` → INSERT en `habit_occurrences` + UPDATE en `habit_completions`
4. Leading cambia a `<Check>`, barra de progreso = 100%
5. Toast "✓ Título · HH:mm" + "Deshacer" por 3200ms
6. Si toca "Deshacer": `removeOccurrence(id)` → DELETE en `habit_occurrences` + count - 1

### timesPerDay > 1 (multi-repetición)

1. Usuario expande la card (chevron) para ver chips de hoy
2. Toca "＋" (botón rápido o leading)
3. Nueva ocurrencia registrada con timestamp actual
4. Aparece nuevo chip "HH:mm" en el accordion
5. Si `count >= timesPerDay`: leading cambia a `<Check>` con `accentColor`
6. Al tocar "Editar": modo edición de chips (× por chip)
7. Tocar × en un chip: `removeOccurrence(id)` → chip desaparece, count -1
