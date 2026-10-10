# MGL Systems · Fase 8

## Planificación avanzada y control de plazos

La Fase 8 añade planificación de obra sin duplicar las tareas existentes. `tasks` sigue siendo la entidad operativa y local-first; sobre ella se agregan metadatos EDT/WBS, cronograma y vínculo presupuestal.

### EDT / WBS

Cada tarea puede ser:

- `activity`: actividad ejecutable;
- `milestone`: hito de duración cero, con inicio = fin;
- `summary`: nodo de resumen para organizar la EDT.

Se incorporan `wbs_code`, `parent_task_id`, `planned_weight` y `budget_item_id`. PostgreSQL impide padres que no sean resúmenes y ciclos jerárquicos.

### Dependencias

`task_dependencies` soporta:

- FS: Fin → Inicio;
- SS: Inicio → Inicio;
- FF: Fin → Fin;
- SF: Inicio → Fin;
- `lag_days`: adelanto o retraso en días calendario.

La detección de ciclos existente se conserva y la sincronización local-first acepta los nuevos campos.

### CPM

El cliente calcula:

- Early Start / Early Finish;
- Late Start / Late Finish;
- holgura total;
- actividades críticas;
- duración del camino crítico.

El cálculo se realiza localmente, por lo que mover la vista o revisar holguras no genera llamadas adicionales a Supabase.

### Línea base

`create_schedule_baseline(project_id, name)` exige rol admin o PM, bloquea por proyecto, valida que actividades/hitos tengan fechas y crea una fotografía transaccional de:

- tareas;
- WBS;
- fechas;
- pesos;
- vínculo con presupuesto;
- dependencias y lag.

Solo hay una línea base activa; las anteriores pasan a `superseded` y quedan disponibles para auditoría.

### Avance y Curva S

Un trigger registra automáticamente cambios de `status` o `progress` en `task_progress_history`. La Curva S compara el plan de la línea base con ese historial real usando los pesos congelados en la línea base. La línea real no se proyecta artificialmente hacia fechas futuras.

### Integración Fase 6

Una actividad puede vincularse a una partida hoja de la línea base presupuestal. La validación se ejecuta en PostgreSQL, no solo en el navegador.

### Rendimiento

La RPC `get_project_planning_context` devuelve en una sola llamada:

- tareas;
- dependencias;
- línea base activa;
- snapshots de línea base;
- historial de avance;
- partidas presupuestales disponibles;
- miembros del proyecto.

Es `SECURITY INVOKER`; las políticas RLS de las tablas subyacentes continúan aplicándose.

### Offline / local-first

Las fechas, WBS, tipo, jerarquía, peso y dependencias siguen el Outbox de Fase 2. Una línea base, en cambio, es una operación transaccional online: la interfaz no permite crearla mientras existan mutaciones locales de tareas/dependencias sin resolver.

La migración Dexie v2 completa los nuevos campos sobre cachés de fases anteriores sin borrar datos locales.

### Alcance no incluido aún

No se implementa todavía un calendario laboral configurable (feriados, turnos, jornadas parciales), nivelación automática de recursos, importación MPP/XER ni reprogramación automática basada en recursos. El CPM de esta fase trabaja en días calendario.
