# MGL Systems — Tarea 5

Versión 0.8.6.

Incluye:
- ruta `/app/projects/[projectId]/partidas`;
- tabla cotizado vs real con búsqueda, filtros y semáforo;
- edición inline local-first de `qty_actual` y `unit_price_actual`;
- sincronización FIFO/idempotente de `budget_items` mediante `sync_budget_item_actual`;
- importación `.xlsx` a un presupuesto en borrador con ExcelJS;
- protección de línea base/cotización cerrada: la importación nunca modifica una línea base;
- pruebas unitarias para parser, filtros y normalización local.

## Validación

- 34 pruebas unitarias definidas en total (5 nuevas de Tarea 5).
- Validación remota transaccional de sync_budget_item_actual completada con ROLLBACK.
- npm run verify debe ejecutarse en el equipo del usuario porque este entorno no puede resolver registry.npmjs.org.
