# Tareas — Documentación de flujos y opciones

---

## 1. Pantalla principal (TaskScreen)

### Búsqueda y filtros
- **Campo de búsqueda**: filtra por título, categoría y ubicación en tiempo real.
- **Chips de categoría** (scroll horizontal): Todas · Facultad · Trabajo · Personal · Casa · Salud · Compras. Solo una activa a la vez. Los chips pueden mostrar íconos (configurable en ajustes).

### Secciones

| Sección | Criterio | Color |
|---|---|---|
| **Vencidas** | Activas con fecha pasada | Rojo/peligro |
| **HOY / Próximo / {fecha}** | Activas con fecha futura o de hoy | Primario |
| **Importante** | Sin fecha pero marcadas como importantes | Acento |
| **Sin fecha** | Sin fecha, sin importancia | Secundario |
| **Completadas** | Completadas (paginadas de a 30) | Apagado |

Las vencidas muestran hace cuánto vencieron ("hace 1 hora", "hace 2 días", etc.).  
El botón "Cargar más completadas" aparece al pie de esa sección.

### Tipos de fila

| Tipo | Descripción |
|---|---|
| **Tarea local** | SwipeableItemCard: interactiva, con swipe y tap |
| **Evento de Google Calendar** | Fila con dot de color, solo lectura. Tappable: pide confirmación para importar como tarea |
| **Feriado** | Fila con dot de color, solo lectura |

### Pista de gestos
Cuando hay tareas, aparece una fila: `← borrar · completar →`

### Gestos sobre cada tarjeta de tarea

| Gesto | Acción |
|---|---|
| **Deslizar a la derecha** | Marcar como completada (no disponible si ya está completada o es recordatorio recurrente) |
| **Deslizar a la izquierda** | Eliminar (pide confirmación) |
| **Tocar** | Abre el editor de la tarea (ItemDetailModal) |

### Toast de deshacer
Después de completar una tarea por deslizamiento, aparece un toast durante 4 segundos: **"Tarea completada" + "Deshacer"**. Tocar "Deshacer" revierte la acción.

### Importar evento de Google Calendar
Al tocar un evento de Google Calendar (fila de dot), aparece un alert:  
**"{título del evento}" · "¿Importar como tarea?"** → Cancelar / Importar.  
Al importar, el evento se convierte en una tarea local interactiva y el dot desaparece.

---

## 2. Creación rápida (QuickAddSheet)

Hoja inferior que se abre con el botón flotante `+`. Se resetea al abrirse. Tiene tres paneles internos.

### Panel principal

**Campo de título**: texto libre, múltiples líneas, autoenfocado.

**Detección automática (NL)**: mientras escribís, el parser detecta:
- Fecha → chip con la fecha + X para descartar
- Hora → chip con la hora + X para descartar
- Categoría → chip "🏷 Nombre" + X para descartar

Si se descarta un chip, ese campo no vuelve a detectarse automáticamente.

**Secciones opcionales** (se activan con íconos en la barra de acciones):

| Ícono | Sección | Comportamiento al activar |
|---|---|---|
| AlignLeft | Descripción + categorías | Muestra input de detalles y chips de categoría |
| Clock | Fecha y hora | Abre el panel de fecha |
| Flag (acento) | Fecha límite directa | Abre selector de fecha límite flotante |
| ListChecks | Subtareas | Muestra lista de subtareas pendientes + input |
| MapPin | Dirección | Muestra input de dirección con autocompletado |
| Star (naranja) | Importante | Toggle |
| BellRing (acento) | Recordatorio recurrente | Si inactivo: abre panel de configuración. Si activo: desactiva |

**Chips de día de estudio** (solo si categoría = Facultad y el título parece un examen): Ninguno · ½ día · 1 día

**Badges de fecha**:
- Si hay fecha inicio → badge primario: "Miér 15 de ago · 14:00 · límite 20 ago" → tocar abre panel de fecha. X limpia fecha, hora, fecha límite y repetición.
- Si hay fecha límite pero no fecha inicio → badge acento: "límite 20 ago" → tocar abre selector directo de fecha límite. X limpia solo la fecha límite.

**Guardar**: habilitado cuando el título no está vacío. Crea la tarea, luego las subtareas pendientes, y cierra.

### Panel de modo recordatorio recurrente

Se abre al tocar el ícono BellRing. Tarjeta flotante centrada con:

| Campo | Descripción |
|---|---|
| **Hora de inicio** | Tappable → selector nativo de hora. Por defecto: próxima hora entera |
| **Repetir cada** | Botones − / + para el intervalo + chips "horas" / "días" |
| **Hasta (opcional)** | Tappable → calendario flotante. X para quitar la fecha de fin |

Al tocar **Listo**:
- Configura fecha de inicio (hoy si la hora no pasó, mañana si ya pasó)
- Configura la hora y la repetición
- Activa el modo recordatorio recurrente automáticamente

### Panel de fecha

Un calendario mensual para elegir el día (tocar el mismo día lo deselecciona).

Filas de opciones debajo del calendario:

| Opción | Descripción |
|---|---|
| **Establecer hora** | Toggle + selector nativo de hora (24h). Al activar abre el picker inmediatamente |
| **Hasta** | Hora de fin (solo visible si "Establecer hora" está activo) |
| **Repetir** | Abre el panel de repetición |
| **Fecha límite** | Abre un calendario flotante para la fecha límite |
| **Recordatorio** | Expande/colapsa el panel de recordatorios |
| **Sincronizar con Google Calendar** | Switch (solo si hay sesión de Google activa) |

Footer: **Cancelar** (vuelve al panel principal) · **Listo** (confirma y vuelve).

### Selector de fecha límite directo (desde panel principal)

Tarjeta flotante centrada con:
- Calendario mensual
- "Quitar fecha límite" (si ya hay una seteada)
- Se cierra al tocar fuera, con X, o al seleccionar una fecha

### Panel de repetición (RepeatPanel)

Modal a pantalla completa con:

| Campo | Opciones |
|---|---|
| **Unidad** | Hora · Día · Semana · Mes · Año |
| **Intervalo** | Número entero (ej: "cada 2 semanas") |
| **Días de la semana** | Solo si unidad = Semana. Checkboxes Lun–Dom |
| **Fin** | Nunca · En fecha · Después de N ocurrencias |

Si no había fecha seteada cuando se configura la repetición, se calcula automáticamente la próxima ocurrencia.

### Panel de recordatorios (ReminderPanel)

Se expande dentro del panel de fecha. Permite agregar múltiples recordatorios.

| Campo | Opciones |
|---|---|
| **Tipo de alerta** | Notificación · Alarma |
| **Persistente** | Toggle (la notificación no se puede deslizar para cerrar) |
| **Recordatorio de salida** | Visible si hay dirección y fecha. Calcula el tiempo de viaje desde la ubicación actual |

Opciones del recordatorio de salida:
- Modo de transporte: auto · a pie · transporte público · bicicleta
- Minutos extra de margen (por defecto 5)
- Toggle para activar/desactivar el recordatorio de salida

---

## 3. Editor de tarea (ItemDetailModal)

Abre al tocar una tarjeta. Guarda automáticamente al cerrar.

### Barra superior

| Control | Acción |
|---|---|
| ← | Guardar y cerrar. Si el título está vacío: alerta "¿Cerrar sin guardar?" |
| ★ (estrella) | Toggle de importancia (naranja cuando activo) |
| BellRing | Toggle de recordatorio recurrente. Si inactivo: abre panel de configuración (pre-rellena con valores actuales si los tiene). Si activo: desactiva |
| ⋮ (menú) | Confirmar eliminación de la tarea |

### Panel de modo recordatorio recurrente (en el editor)

Igual al de la creación rápida. Al abrirse, pre-rellena:
- **Hora**: hora actual de la tarea (si tiene), si no la próxima hora entera
- **Intervalo y unidad**: los valores actuales si ya tenía repetición por horas/días configurada
- **Hasta**: la fecha de fin del repeat si existe

### Campos del editor

**1. Título**
Texto grande (26px), múltiples líneas. Tachado y apagado si la tarea está completada.

**2. Descripción**
Input de texto con ícono AlignLeft. El ícono se resalta si hay texto.

**3. Categoría**
Chips horizontales: Facultad · Trabajo · Personal · Casa · Salud · Compras. Tocar una activa; tocar la activa la desactiva. Si hay sugerencia automática (sin categoría elegida), aparece una fila "¿Categoría: [Nombre]?" con botón Sí y X.

**4. Config académica** (solo si categoría = Facultad y el título parece un examen)
- **Día de estudio**: Ninguno · ½ día laboral · 1 día laboral
- **Nota del examen**: campo numérico 1–10. Badge "Aprobado" (verde, ≥4) o "Recuperar" (rojo, <4)

**5. Ubicación**
Input de texto + autocompletado de Google Places. Tocar el ícono MapPin abre Google Maps si ya hay una dirección. X limpia el campo.

**6. Fecha límite**
Ícono CircleCheck → selector de fecha nativo. Una vez seteada, muestra chip con la fecha + X para limpiar.

**7. Fecha inicio / Hora / Hora fin**
Ícono Clock → expande/colapsa un calendario mensual inline.
- Al seleccionar fecha: chip con la fecha + X. También aparece chip "+ hora".
- Al agregar hora: chip con la hora + X. También aparece chip "+ hasta" para hora de fin.
- Limpiar la fecha limpia también la hora.
- Si hay fecha: aparece toggle de sincronización con Google Calendar (si hay sesión activa).

**8. Repetición**
Ícono Repeat → abre RepeatPanel (mismo que en creación rápida). Muestra etiqueta activa (ej: "Cada semana") + X para limpiar.

**9. Recordatorios (notificaciones)**
Ícono Bell → expande/colapsa ReminderPanel (igual que en creación rápida, con botón de tiempo de viaje si hay dirección y fecha).

**10. Subtareas**
Lista de subtareas guardadas, cada una con:
- Checkbox circular → completa/descompleta la subtarea inmediatamente
- Título (tachado si completada)
- XCircle → elimina la subtarea inmediatamente

Input para agregar nueva subtarea (Enter o botón +).

### Barra inferior

| Estado | Texto del botón |
|---|---|
| Tarea activa, sin subtareas pendientes | "Marcar como completada" |
| Tarea completada | "Marcar como no completada" |
| Tarea activa con subtareas sin completar | "Marcar como completada" (deshabilitado) |
| Recordatorio recurrente | Sin botón de completar |

Al completar: guarda y cierra.

---

## 4. Diferencia entre Tarea y Recordatorio recurrente

| | Tarea | Recordatorio recurrente |
|---|---|---|
| **Concepto** | Algo que hacés y tachás | Algo que sucede repetidamente (tomar pastilla, reunión fija) |
| **Completar** | Sí, tiene checkbox | No, no tiene estado de "hecho" |
| **Ícono en barra** | Sin ícono especial | BellRing activo (acento) |
| **Repetición** | Opcional | Inherente al modo |
| **Notificaciones** | Por recordatorios configurados | Por la hora y repetición del modo |

---

## 5. Notificaciones de tareas

| Caso | Cuándo se notifica |
|---|---|
| Tarea con fecha y sin recordatorios | A la hora de inicio |
| Tarea con recordatorios configurados | Según cada recordatorio (minutos antes) |
| Tarea con fecha límite | Día anterior · Mismo día (9:00) · Día siguiente (vencida) |

Todas las notificaciones de tareas incluyen el botón **"Completar"** en la bandeja. Tocar "Completar" marca la tarea como completada sin abrir la app. Tocar el cuerpo de la notificación abre la tarea directamente en el editor.

---

## 6. Campos disponibles

| Campo | Tipo | Notas |
|---|---|---|
| Título | texto (requerido) | |
| Descripción | texto opcional | |
| Categoría | Facultad · Trabajo · Personal · Casa · Salud · Compras | |
| Importante | boolean | Ícono estrella naranja |
| Recordatorio recurrente | boolean | No puede marcarse completada |
| Fecha inicio | fecha (yyyy-MM-dd) | |
| Hora inicio | HH:mm | Requiere fecha |
| Hora fin | HH:mm | Requiere hora inicio |
| Fecha límite | fecha | Puede existir sin fecha inicio |
| Repetición | hourly/daily/weekly/monthly/yearly | Con intervalo, días de semana (si weekly), y fin |
| Recordatorios | array | Cada uno: minutos antes, tipo alarma, persistente, modo salida |
| Ubicación | texto | Con autocompletado de Google Places |
| Subtareas | array de ítems | Pueden completarse independientemente |
| Día de estudio | ninguno/½ día/1 día | Solo si Facultad + examen |
| Nota del examen | número 1-10 | Solo si Facultad + examen |
| Sync Google Calendar | boolean | Default true. False si es recordatorio recurrente |
