# MGL Systems — Actualización arquitectónica — Tarea 1

Base: MGL Systems Fase 8.

## Objetivo
Migraciones SQL incrementales para introducir control de costos cotizado vs real, 7 etapas operativas, metadatos documentales buscables, datos ampliados de trabajador, notificaciones, preferencias y peticiones con aprobador, sin duplicar ni destruir las entidades creadas en Fases 6–8.

## Archivos
1. `20250201000000_extend_profiles.sql`
2. `20250201000001_project_stages.sql`
3. `20250201000002_budget_items.sql`
4. `20250201000003_notifications.sql`
5. `20250201000004_material_requests.sql`
6. `20250201000005_user_preferences.sql`
7. `20250201000006_rls_and_triggers.sql`

## Compatibilidad deliberada con MGL Systems existente
- `budget_items` ya existía desde Fase 6: se extiende con `qty_actual`, `unit_price_actual`, desviación y estado de costo.
- `material_requests` + `material_request_items` ya existían desde Fase 7: se conserva el modelo normalizado usado por inventario.
- `tasks.budget_item_id` ya existía desde Fase 8: se conserva y se añade `stage_id` obligatorio.
- `material_requests.status` se conserva para compatibilidad con inventario (`submitted`/`fulfilled`). `workflow_status` ofrece la semántica nueva (`pending`/`delivered`).
- El LWW existente (`updated_at + mutation_id`) sigue siendo la autoridad de sincronización. `version` se incrementa adicionalmente y no reemplaza el reloj del cliente.

## Etapas iniciales
- 00 — Gestión del proyecto
- 01 — Ingeniería
- 02 — Compras
- 04 — Ejecución en Campo
- 07 — Finanzas del proyecto
- 98 — Cotización (Cerrada), bloqueada
- EV — Ejecución versionada

## Umbrales iniciales de costo
El documento fuente define los cuatro estados, pero no fija porcentajes. Se usan valores iniciales configurables por proyecto:
- dentro_presupuesto: real <= cotizado
- alerta_menor: desviación > 0% y <= 10%
- alerta_mayor: desviación > 10% y <= 25%
- critico: desviación > 25% (o costo cotizado cero con costo real positivo)

## Pruebas realizadas contra Supabase real
Todas las pruebas funcionales se ejecutaron dentro de transacciones con `ROLLBACK`:
- 7 etapas creadas y etapa 98 bloqueada.
- Caso S/100 cotizado -> S/500 real = +400%, estado `critico`.
- `project_cost_summary()` devolvió S/400 de desviación y +400%.
- alerta crítica creó notificación in-app.
- asignación de tarea creó notificación y asignó etapa 04 por compatibilidad.
- petición con aprobador pasó por alias `pending` y terminó `approved`.
- lectura in-app marcó el email programado como `skipped` antes de enviarse.
- búsqueda FTS en español encontró `memoria descriptiva` mediante `search_vector`.

## Estado de auditoría
- Security Advisor: sin nuevos hallazgos del esquema; permanece únicamente la configuración global `Leaked Password Protection Disabled` ya existente.
- Performance Advisor: sin foreign keys sin índice ni políticas `auth.uid()` con InitPlan pendiente. Solo aparecen índices aún no usados, esperable antes de carga real.

## Siguiente tarea
Tarea 2: migración Dexie + `cost-calculator.ts`, manteniendo las fórmulas SQL y TypeScript equivalentes.
