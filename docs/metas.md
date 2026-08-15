# Metas — Documentación de flujos y opciones

---

## 1. Pantalla principal (GoalsScreen)

### Búsqueda y filtros
- **Campo de búsqueda**: filtra por título y descripción.
- **Chips de categoría**: Todas · Facultad · Trabajo · Personal. Cada chip activo usa el color propio de la categoría (no el color primario global).

### Secciones

| Sección | Criterio |
|---|---|
| **Vencidas** | Activas con fecha límite pasada. Muestra "Venció hoy" o "Venció hace N día(s)" |
| **Activas** | Activas con fecha límite futura o sin fecha |
| **Cumplidas** | Completadas (ordenadas por fecha de completado, más reciente primero) |

Solo se muestran metas de nivel superior (las submetas no aparecen en la lista principal). Cada tarjeta muestra el progreso de submetas.

### Gestos sobre cada tarjeta

| Gesto | Acción |
|---|---|
| **Deslizar a la derecha** | Marcar como cumplida. Si tiene submetas incompletas: alerta "Completá todas las submetas primero" |
| **Deslizar a la izquierda** | Eliminar (pide confirmación) |
| **Tocar** | Abre el editor de meta (AddGoalSheet en modo edición, pantalla completa) |

---

## 2. Creación de meta (AddGoalSheet — modo crear)

Hoja inferior (no pantalla completa). Se cierra al tocar fuera o al guardar.

### Campos

**Título** + botón ★ (importante) en la misma fila.

**Descripción**: input multilínea.

**Fecha límite**: ícono Flag + fila de opción. Tocar abre un calendario flotante centrado con X para cerrar. La fila tiene X para limpiar la fecha seleccionada.

**Categoría**: chips Facultad · Trabajo · Personal (con ícono). El chip activo usa el color propio de la categoría.

**Submetas**: lista de submetas pendientes (no guardadas aún). Cada una con checkbox inerte, título y X para quitar. Input "Agregar submeta" + Plus para agregar al listado.

**Guardar**: crea la meta y luego cada submeta pendiente como ítems con parentId. Cierra el sheet.

---

## 3. Editor de meta (AddGoalSheet — modo editar)

Pantalla completa. Guarda automáticamente al cerrar.

### Barra superior

| Control | Acción |
|---|---|
| ← | Guardar y cerrar. Si el título está vacío: alerta "¿Cerrar sin guardar?" |
| 🗑 (papelera) | Confirmar eliminación de la meta |

### Campos (iguales que en creación + diferencias en submetas)

**Submetas** (en edición son objetos reales guardados):
- Checkbox circular → completa/descompleta la submeta inmediatamente
- Título (tachado si cumplida)
- XCircle → elimina la submeta inmediatamente
- Input para agregar nueva submeta → se guarda al instante (no espera a cerrar)

### Barra inferior

| Estado | Texto del botón |
|---|---|
| Meta activa, todas las submetas completas (o sin submetas) | "Marcar como cumplida" |
| Meta activa con submetas incompletas | "Marcar como cumplida" (deshabilitado, gris) |
| Meta cumplida | "Marcar como no cumplida" |

---

## 4. Comportamiento especial al cambiar fecha límite

Si una meta **ya tenía fecha límite** y se cambia por otra (no se borra, se cambia a fecha diferente):

1. El evento en Google Calendar se renombra a **"[Pospuesto] Título"**
2. La meta original y todas sus submetas se eliminan localmente
3. Se crea una meta nueva con los datos actualizados
4. Se recrean todas las submetas bajo la nueva meta

Esto preserva el historial en Google Calendar como "pospuesto".

---

## 5. Notificaciones de metas

Las metas con fecha límite reciben notificaciones automáticas en cuatro momentos:

| Cuándo | Mensaje |
|---|---|
| 7 días antes (9:00) | "📅 Faltan 7 días" |
| 1 día antes (9:00) | "⚠️ Vence mañana" |
| El día mismo (9:00) | "⚠️ Vence hoy" |
| Al día siguiente (9:00) | "🔴 Meta vencida" |

Las notificaciones de metas **no incluyen** el botón "Completar" (a diferencia de las tareas).

---

## 6. Campos disponibles

| Campo | Tipo | Notas |
|---|---|---|
| Título | texto (requerido) | |
| Descripción | texto opcional | |
| Categoría | Facultad · Trabajo · Personal | Solo estas 3 (no Casa, Salud, Compras) |
| Importante | boolean | Ícono estrella naranja |
| Fecha límite | fecha (yyyy-MM-dd) | Campo principal de tiempo; sin hora |
| Submetas | array de metas hijo | Pueden completarse independientemente |
| Sync Google Calendar | boolean | Si hay sesión activa y fecha límite seteada |

### Campos que las metas NO tienen (a diferencia de tareas)

- Fecha inicio / hora inicio / hora fin
- Repetición
- Recordatorios configurables (solo notificaciones automáticas)
- Ubicación
- Subtareas con config académica
- Modo recordatorio recurrente
- Categorías: Casa, Salud, Compras

---

## 7. Diferencia entre Meta y Tarea

| | Meta | Tarea |
|---|---|---|
| **Concepto** | Objetivo a alcanzar en el futuro | Acción puntual a realizar |
| **Tiempo** | Solo fecha límite | Fecha inicio, hora, fecha límite |
| **Categorías** | 3 (Facultad, Trabajo, Personal) | 6 (+ Casa, Salud, Compras) |
| **Repetición** | No | Sí |
| **Recordatorios** | Automáticos (4 puntos fijos) | Configurables (minutos antes, alarma, etc.) |
| **Notificación con "Completar"** | No | Sí |
| **Sub-ítems** | Submetas (son metas) | Subtareas (son tareas) |
| **Posponer** | Renombra en Calendar + recrea | Actualiza directamente |
