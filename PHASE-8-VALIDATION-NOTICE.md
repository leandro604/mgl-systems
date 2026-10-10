# Validación Fase 8

La Fase 8 se construyó sobre la Fase 7 estable y reutiliza `tasks` y `task_dependencies`; no crea un segundo sistema de actividades.

## Backend validado

La migración principal se ejecutó primero dentro de una transacción con `ROLLBACK`. La prueba creó temporalmente una EDT con resumen, dos actividades, relación FS, cambio de avance y una línea base. Se verificó:

- 3 tareas capturadas por la línea base;
- 1 dependencia tipada capturada;
- estado `active` de la línea base;
- historial automático de avance;
- RLS en las 30 tablas con `deleted_at`;
- RPC de planificación disponible solo para `authenticated`;
- RPC de línea base no ejecutable por `anon`.

Los datos de prueba fueron revertidos.

## Rendimiento

`get_project_planning_context(uuid)` consolida cronograma, dependencias, línea base, historial, partidas y equipo en una sola lectura RLS-safe. Los cálculos CPM y la geometría del Gantt/Curva S se realizan en el cliente y no agregan viajes de red al navegar.

## Persistencia local

IndexedDB sube internamente a versión Dexie 2 y completa automáticamente en tareas antiguas:

- `wbs_code = ''`;
- `task_type = 'activity'`;
- `parent_task_id = null`;
- `planned_weight = 1`;
- `budget_item_id = null`;
- dependencias antiguas como `FS`, lag `0`.

No se debe borrar IndexedDB manualmente.

## Advisors

No aparecieron nuevas advertencias de seguridad por Fase 8. Continúa únicamente el aviso preexistente de protección contra contraseñas filtradas desactivada. En performance quedan avisos `unused_index`, esperables mientras no exista carga operativa suficiente.

## Verificación local esperada

```powershell
npm install
npm run verify
```

Objetivo del paquete 0.8.0:

- TypeScript: sin errores.
- Unit tests: 18 pruebas.
- Schema/RLS: 104 comprobaciones.
- Build Next.js: producción sin errores.

El entorno de generación no pudo completar `npm install` por timeout del registro npm; por eso el cierre definitivo se hace con `npm run verify` en el equipo del usuario.
