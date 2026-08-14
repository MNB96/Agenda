# Documentación de Hábitos

## Visión general

La funcionalidad de hábitos en Agenda está pensada para distinguir claramente entre dos cosas:

- la suma resumida del progreso diario, que es un dato derivado y de cálculo
- los registros reales de ejecución, que son los eventos concretos del usuario

Esto permite soportar hábitos con varias repeticiones por día sin mezclar la lógica de recordatorios con la lógica de completitud.

En la implementación actual, el modelo de dominio y persistencia separa explícitamente:

- `habit_completions`: resumen por hábito + fecha
- `habit_occurrences`: cada registro real de ejecución

La regla central es que el resumen no se calcula a partir de la presencia o ausencia de “chips” en la UI; se calcula en la capa de persistencia y se mantiene transaccionalmente.

---

## 1. Objetivo del módulo

Los hábitos responden a dos necesidades:

1. registrar una repetición puntual en un día
2. mantener un resumen diario para poder mostrar:
   - cuántas veces se hizo hoy
   - si se cumplió la meta del día
   - la progresión semanal
   - la secuencia de streaks

El comportamiento debe ser simple y consistente, sin mezclar:

- recordatorios programados
- pasos/slots de un mismo hábito
- recuento acumulado del día
- ocurrencias reales ejecutadas por el usuario

---

## 2. Modelo de dominio

### 2.1 Habit

El dominio define un hábito con atributos como:

- `id`
- `title`
- `categoryId`
- `regularity`
- `timesPerDay`
- `reminder`
- `notificationIds`
- `createdAt`
- `updatedAt`

El valor `timesPerDay` representa la meta objetivo del hábito para un día. Es un número entero positivo y se valida en el modelo.

Ejemplo:

- `timesPerDay = 1`: hábito clásico de una vez por día
- `timesPerDay = 3`: hábito de múltiples ejecuciones por día

### 2.2 HabitOccurrence

Cada ejecución real del usuario queda guardada como una ocurrencia con:

- `id`
- `habitId`
- `occurredAt`
- `source`
- `createdAt`
- `updatedAt`

`source` indica si la ocurrencia fue creada manualmente o por una notificación. Esto permite distinguir el origen del evento sin afectar la lógica de conteo.

### 2.3 HabitCompletion

Es el resumen derivado para la fecha.

Ejemplo:

- `habitId = h1`
- `date = 2026-08-14`
- `count = 4`

Esto significa que ese hábito tuvo 4 ejecuciones ese día. El resumen es la fuente de verdad para la pantalla de estadísticas y la visualización del progreso del día.

---

## 3. Regla de negocio principal: fuente de verdad

La regla central del sistema es esta:

- las `habit_occurrences` son los hechos reales
- `habit_completions.count` es el resumen del día
- el resumen se mantiene transaccionalmente en base a los eventos
- la meta del hábito y el recordatorio están relacionados como ayuda, pero no representan lo mismo

En la práctica:

- `timesPerDay` define cuántas veces se quiere ejecutar el hábito en el día
- el recordatorio define cuándo ayuda al usuario a cumplir esa meta
- la ejecución real es la fuente de verdad y el contador del día debe reflejar esa ejecución

Esto hace que un caso como “tomar agua: 3 veces al día con recordatorio cada 4 horas” sea válido y consistente: el aviso ayuda a cumplir la meta, pero no reemplaza el conteo ni la ejecución real.

Esto evita inconsistencias como:

- contar con un valor manual que no corresponda al número real de ocurrencias
- borrar la información histórica de la ejecución al tratar el hábito como booleana
- mezclar “cuántas veces me tocaron recordatorios” con “cuántas veces realmente lo hice”

### Invariante

Para un hábito `H` y una fecha `D`, el resumen debe estar alineado con el número real de registros de ocurrencia de ese día.

Es decir:

$$
count(H, D) = \#\{occurrences\ de\ H\ para\ D\}
$$

Cuando el usuario borra una occurrence individual, el count del día debe decrementar en 1. Cuando agrega una, debe incrementar en 1.

---

## 4. Estructura de persistencia

### 4.1 Tabla `habit_occurrences`

Guarda cada ejecución concreta del hábito.

Campos relevantes:

- `id`
- `habitId`
- `occurredAt`
- `source`
- `createdAt`
- `updatedAt`

La query de lectura de hoy usa un rango semiabierto:

- `startOfToday`
- `startOfTomorrow`

Con esto se evita el problema del “off-by-one” alrededor de la medianoche.

### 4.2 Tabla `habit_completions`

Guarda el conteo resumido por fecha.

Campos relevantes:

- `habitId`
- `date`
- `count`

La clave primaria es `(habitId, date)`.

### 4.3 Reconciliación

La reconciliación ocurre en la capa de repositorio, no en la UI. Cuando se añade o elimina una ocurrencia, se rebalancea el resumen del día en la misma transacción.

Esto evita estados inconsistentes donde:

- la UI muestra 3 chips pero el count dice 2
- el valor total queda desalineado tras eliminaciones rápidas

---

## 5. Flujo de creación y edición del hábito

### 5.1 Crear hábito

Desde la pantalla de Home, el usuario puede abrir el sheet de creación.

El formulario admite:

- título
- regularidad
- categoría
- veces por día
- activar recordatorios
- elegir modo de recordatorio:
  - intervalo fijo
  - horario random

### 5.2 Recordatorios

Los recordatorios no son la completitud ni la ocurrencia. Son una sugerencia de ejecución.

Al crear un hábito con recordatorio:

- se arma el payload de `HabitReminderConfig`
- se schedulean notificaciones
- se almacenan en el hábito

La validación no debe bloquear la UI ni mezclar la lógica de recordatorio con los chips del día.

### 5.3 Edición

Cuando el usuario entra al editor de un hábito existente:

- se precargan los valores del hábito
- se muestran los recordatorios configurados
- el sheet se comporta como un editor de un solo hábito
- al guardar, se actualiza el modelo y el payload de reminder

El punto crítico es que la edición de un hábito no debe resetear el estado local de la home ni hacer desaparecer los chips del día.

---

## 6. Flujo de la home y el card

### 6.1 Card principal

El `HabitCard` muestra:

- título
- categoría
- progreso del día
- meta actual
- streak actual
- semana resumida
- chips de hoy cuando el hábito admite múltiples repeticiones

### 6.2 Estado expandido

Cuando el usuario expande el card, se muestran los chips del día. Cada chip representa una ocurrencia real en la franja horaria de hoy.

El comportamiento actual mantiene:

- expansión/collapse por la flecha
- edición solo por botón explícito “Editar”
- lista visible por defecto con `+N` si hay más registros que mostrar
- modo edición para eliminar ocurrencias individuales con `×`

### 6.3 Modo editar

Cuando se activa `isEditingOccurrences`:

- cada chip se vuelve interactivo
- el usuario puede tocar el `×` de una occurrence
- el sistema elimina exactamente esa occurrence por `id`
- luego el repositorio recalcula el resumen del día

Esto evita depender de una recomputación derivada de la UI o de una colección local incompleta.

---

## 7. Patrones de interacción y UX

### 7.1 Efecto de “último wins” en toast

Para la confirmación visual del registro rápido, se usa un banner temporal no bloqueante.

La lógica asegura:

- si se crean varias operaciones en rápida sucesión, gana la última
- no quedan toasts de instancias viejas colgando
- al hacer “Deshacer” se borra la occurrence exacta creada

Esto evita que un toast viejo elimine una occurrence equivocada.

### 7.2 No usar modal bloqueante

Se evitó `Alert.alert()` para esta operación porque rompe el flujo y no encaja con la experiencia actual.

Se prefirió un toast de tipo banner temporal para notificar que la acción fue registrada, dejando al usuario seguir usando la app sin interrupciones.

### 7.3 Semántica de la semana

Para hábitos multi-vez, los indicadores de la semana se muestran como informativos.

No son botones interactivos con tick/untick. Su función es indicar:

- si el día está completo
- si está parcial
- si quedó pendiente

Esto evita mutar el estado del resumen desde la semana, que es una vista agregada y no la fuente de verdad.

---

## 8. Flujo exacto de una ejecución

### Caso A: hábito de 1 vez al día

1. el usuario toca el card o el botón principal
2. se actualiza `habit_completions` para esa fecha
3. la UI lee ese resumen y renderiza el progreso

### Caso B: hábito de múltiples veces al día

1. el usuario toca “＋”
2. se crea una `habit_occurrence` con timestamp actual
3. el repositorio hace `INSERT` en `habit_occurrences`
4. el repositorio actualiza `habit_completions.count` con delta +1
5. la home vuelve a leer la data y renderiza los chips y el resumen

### Caso C: borrar una ocurrencia

1. el usuario entra en modo edición
2. toca el chip con `×`
3. se llama a `removeOccurrence(id)`
4. el repositorio busca la occurrence por `id`
5. la elimina de `habit_occurrences`
6. disminuye el resumen del día en 1
7. la UI re-renderiza con los chips actualizados

---

## 9. Riesgos y correcciones identificadas

### 9.1 El resumen se mezclaba con los recordatorios

Se corrigió separando claramente la lógica de recordatorio de la lógica de ejecución.

### 9.2 La UI trataba el progreso como booleano

Se corrigió para soportar contadores y metas por día.

### 9.3 Los chips se ocultaban por re-renders o estados locales

Se corrigió asegurando que el reset del modo edición solo ocurra cuando el usuario realmente colapsa la card, no al abrir el editor del hábito.

### 9.4 El teclado tapaba el campo del reminder

Se corrigió aplicando la estrategia correcta de `KeyboardAvoidingView` y dejando el `ScrollView` libre para moverse.

### 9.5 Preservación de datos legados

Se decidió no introducir compatibilidad con estructuras antiguas en una DB limpia, porque el estado actual del sistema define la fuente canónica como `habit_occurrences + habit_completions`.

---

## 10. Reglas de validación funcional

Estas son las condiciones que deben mantenerse en cada cambio del módulo:

- El modal de creación no debe bloquear la scroll view.
- El input de recordatorios debe poder escribirse sin ser tapado por el teclado.
- Un hábito multi-vez debe poder registrar varias ocasiones en el mismo día.
- Los chips visibles deben representar occurrences reales.
- El summary `count` debe coincidir con la cantidad de occurrences del día.
- La edición de chips debe eliminar solo la occurrence seleccionada.
- La semana debe ser informativa, no interactiva.
- El valor del día debe actualizarse sin necesidad de recalcular desde la UI.

---

## 11. Checklist de pruebas manuales

### Crear hábito

- [ ] Crear un hábito con 1 vez por día
- [ ] Crear un hábito con 3 veces por día
- [ ] Activar recordatorios
- [ ] Escribir el intervalo y verificar que no se tapa el teclado
- [ ] Guardar correctamente

### Home y progreso

- [ ] Ver el progreso del día
- [ ] Ver el chip de “meta cumplida” cuando corresponde
- [ ] Expandir la card y ver los chips del día
- [ ] Ver que la semana muestra estado informativo

### Editar ocurrencias

- [ ] Entrar en “Editar”
- [ ] Eliminar un chip individual
- [ ] Verificar que el resumen del día baja en 1
- [ ] Verificar que no desaparecen los chips por el simple hecho de abrir el editor

### Edge cases

- [ ] Agregar varias veces seguidas en el mismo día
- [ ] Borrar varias occurrences y confirmar el count final
- [ ] Probar con el último chip y confirmación visual
- [ ] Probar la sesión con teclado abierto y scroll activo

---

## 12. Decisiones de diseño que se mantienen

- No se rediseñó la pantalla completa.
- Se preservó el lenguaje visual actual del card.
- Se mantiene el comportamiento expandido/colapsado actual.
- Se evita `Alert.alert()` para interacciones rápidas y repetitivas.
- Se prioriza la claridad del conteo real sobre una “mejor” UI visual que ocultaría la fuente de verdad.

---

## 13. Estado actual del módulo

El módulo de hábitos ya quedó orientado a un modelo consistente basado en:

- resumen diario en `habit_completions`
- detail records en `habit_occurrences`
- `HabitCard` con edición local de chips del día
- recordatorios independientes de la ejecución
- UI sin bloqueos de teclado ni pérdida de estado local

Esto deja el sistema preparado para que el flujo de hábitos sea estable, predecible y fácil de mantener.
