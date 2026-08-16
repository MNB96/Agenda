# Facultad — Documentación de flujos y opciones

---

## 1. Pantalla principal (StudiesScreen)

Segunda pestaña del navegador inferior (ícono GraduationCap).

Muestra únicamente ítems con `categoryId === 'facultad'`, combinando datos de:
- Todos los ítems activos de la base local
- Los últimos 20 ítems completados de la categoría Facultad
- Las licencias por examen (AsyncStorage)
- La configuración de días disponibles (Settings)

---

### Sección 1: Tarjeta resumen (siempre visible)

| Elemento | Descripción |
|---|---|
| **Cuatrimestre** | Calculado automáticamente según el mes actual (ver tabla abajo) |
| **Próxima fecha importante** | Título del examen más cercano + badge con días restantes. Solo aparece si hay exámenes cargados |
| **Sin exámenes próximos** | Texto en itálica si no hay exámenes activos en el cuatrimestre |
| **Contador de exámenes** | "N examen(es)" activos en el cuatrimestre |
| **Licencias libres** | "N licencias libres" — se pone rojo si queda < 1. Solo aparece si `availableDays > 0` |

**Detección automática de cuatrimestre:**

| Meses | Cuatrimestre |
|---|---|
| Marzo – Julio | 1er cuatrimestre del año actual |
| Agosto – Noviembre | 2do cuatrimestre del año actual |
| Diciembre – Febrero | 1er cuatrimestre del año siguiente |

---

### Sección 2: Licencias por examen

Solo visible si `availableDays > 0` (configurable en Ajustes).

#### Barra de progreso segmentada

Barra horizontal dividida en tres segmentos proporcionales:

| Segmento | Color | Qué representa |
|---|---|---|
| Rojo | danger | Días ya usados (`usedDays`) |
| Naranja | #F38630 | Días planificados (`plannedDays`) |
| Gris | border | Días libres restantes |

#### Leyenda

- Punto rojo + "N usadas" (solo si `usedDays > 0`)
- Punto naranja + "N planificadas" (solo si `plannedDays > 0`)
- Punto gris + "N libres" (rojo si `remaining < 1`)

#### Lista "Planificadas"

Exámenes futuros con día de estudio asignado. Cada fila muestra:
- Punto naranja
- Nota del ítem (título del examen)
- Fecha: "d de MMMM"
- Días: "½ día" / "1 día" / "N días"

#### Lista "Usadas"

Exámenes pasados con día de estudio. Misma estructura en gris/apagado.

#### Estado vacío

Si no hay licencias registradas: "Ninguna licencia registrada aún. / Seteá el 'Día de estudio' en un examen para planificar."

---

### Sección 3: Exámenes del cuatrimestre

Solo visible si hay exámenes activos en el cuatrimestre actual.

Cada fila es tappable → abre el editor de la tarea (ItemDetailModal).

**Contenido de cada fila:**
- Barra vertical de urgencia (3px, 36px alto) coloreada según proximidad
- Título del examen
- Meta row con íconos:
  - `Clock` + fecha (si tiene `startDate` o `deadline`)
  - `BookOpen` + "½ día" o "1 día" (si tiene día de estudio asignado)
  - `Bell` + N (si tiene recordatorios configurados)
- Badge de días con número grande + "días"

**Colores de urgencia:**

| Días restantes | Color |
|---|---|
| ≤ 3 | Rojo (danger) |
| ≤ 7 | Naranja (#F38630) |
| ≤ 14 | Primario |
| > 14 | Gris (muted) |

---

### Sección 4: Otras tareas de Facultad

Ítems activos con categoría Facultad cuyo título NO es detectado como examen. Ordenados por fecha ascendente (sin fecha al final).

Cada fila es tappable → abre el editor.

**Contenido:**
- Dot rojo si está vencida, gris si no
- Título (rojo si vencida)
- Fecha de vencimiento (o "Venció {fecha}" en rojo)
- Badge "Vencida" si aplica

---

### Sección 5: Rendidos

Últimos 5 exámenes completados de la categoría Facultad (no aparece si no hay ninguno).

Cada fila es tappable → abre el editor.

**Contenido:**
- Ícono CheckCircle
- Título tachado y en gris
- Badge de nota (solo si se registró):
  - Nota ≥ 4 → badge verde: "N ✓"
  - Nota < 4 → badge rojo: "N — Recuperar"

---

## 2. Detección automática de examen (`isExamTask`)

La app detecta si un ítem es un examen por coincidencia de substrings en el título (sin distinción de mayúsculas):

`parcial`, `examen`, `final`, `recuperatorio`, `recuperacion`, `recuperación`, `recu`, `integracion`, `integración`, `coloquio`, `quiz`

Si el título contiene alguna de estas palabras **y** la categoría es Facultad (o está siendo sugerida), aparecen los campos académicos en el editor.

---

## 3. Campos académicos en el editor (ItemDetailModal)

Aparecen solo cuando se cumplen ambas condiciones:
- Categoría = Facultad (seleccionada o sugerida automáticamente)
- El título es detectado como examen por `isExamTask`

### Día de estudio

Tres chips exclusivos:

| Chip | Valor | Efecto |
|---|---|---|
| **Ninguno** | `undefined` | Elimina la licencia registrada para este examen |
| **½ día laboral** | `'half'` | Registra/actualiza LicenseUsage con `days = 0.5` |
| **1 día laboral** | `'full'` | Registra/actualiza LicenseUsage con `days = 1` |

El registro de licencia se crea o actualiza automáticamente al cerrar el editor. La fecha de la licencia se toma de `startDate` → `deadline` → hoy.

### Nota del examen

- Input numérico 1-10
- El badge de resultado aparece en tiempo real mientras se escribe:
  - Nota ≥ 4 → "Aprobado" (verde)
  - Nota < 4 → "Recuperar" (rojo)
- Si se borra el número, se elimina la nota guardada

---

## 4. Licencias por examen — flujo completo

```
Crear/editar examen
  └─ Seleccionar "½ día" o "1 día" como día de estudio
  └─ Al cerrar el editor → se upserta LicenseUsage
       ├─ date: startDate del examen (o deadline, o hoy)
       ├─ days: 0.5 o 1
       └─ note: título del examen

Seleccionar "Ninguno"
  └─ Al cerrar el editor → se elimina LicenseUsage existente

StudiesScreen calcula:
  ├─ past (date < hoy) → "Usadas"
  ├─ planned (date >= hoy) → "Planificadas"
  ├─ usedDays = suma de past.days
  ├─ plannedDays = suma de planned.days
  └─ remaining = availableDays - usedDays - plannedDays
```

---

## 5. Configuración de licencias (SettingsModal)

En la sección "Licencias por examen" de Ajustes:
- **Días disponibles por año**: input numérico. Default: 10.
- Si se configura en 0: la barra de licencias y el contador de libres desaparecen de StudiesScreen.

---

## 6. Resumen de acciones del usuario

| Acción | Resultado |
|---|---|
| Tocar fila de examen | Abre el editor de la tarea |
| Tocar fila de "Otras tareas" | Abre el editor de la tarea |
| Tocar fila de "Rendidos" | Abre el editor del examen completado |
| Seleccionar "½ día" / "1 día" en el editor | Planifica una licencia para ese examen |
| Seleccionar "Ninguno" en el editor | Elimina la licencia de ese examen |
| Escribir nota en el editor | Guarda la nota y muestra el resultado en tiempo real |
| Cambiar días disponibles en Ajustes | Actualiza el contador de libres y la visibilidad de la barra |
