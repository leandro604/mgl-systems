
## Fase 8 · Planificación avanzada

La versión 0.8.0 incorpora EDT/WBS, Gantt, dependencias FS/SS/FF/SF, ruta crítica CPM, línea base versionada y Curva S sobre las mismas tareas local-first.

# MGL Systems — Fase 8

MVP ConTech B2B local-first con autenticación, operación, compras, facturación, control presupuestal, inventario y planificación de obra.

## Estado

- **Fase 1:** PostgreSQL, RLS, roles y reglas de negocio.
- **Fase 2:** Dexie/IndexedDB, Outbox FIFO, idempotencia, LWW y reconciliación.
- **Fase 3:** Supabase Auth SSR, onboarding, empresa, workspace y proyectos.
- **Fase 4:** tareas local-first, documentos, SST y equipo por proyecto.
- **Fase 5:** proveedores, órdenes de compra, costos, series fiscales, borradores de comprobantes y cola SUNAT/PSE-ready.
- **Fase 6:** presupuesto versionado, línea base, centros de costo, avance físico por metrado y valorizaciones.
- **Fase 7:** materiales, almacenes, requerimientos, kardex, stock valorizado y recepción de compras.
- **Fase 8:** EDT/WBS, cronograma, Gantt, dependencias tipadas, CPM, línea base y Curva S.

## Ejecutar

```bash
npm install
npm run verify
npm run dev
```

Abre `http://localhost:3000`.

## Variables

Este paquete corregido incluye un `.env.local` con la URL y la clave **publicable** del proyecto MGL Systems verificado. Si cambias de proyecto Supabase, reemplaza esos valores. El archivo sigue ignorado por Git para evitar mezclar configuración local entre entornos.

```env
NEXT_PUBLIC_SUPABASE_URL=https://vscwajxzjnqlcdulfqzl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No se incluye ni se necesita ninguna clave `service_role` o `sb_secret_*` en el cliente.

Nunca expongas `service_role`, `sb_secret_*`, certificados, Clave SOL, credenciales PSE/OSE ni secretos OAuth en `NEXT_PUBLIC_*`.

## Fase 5

Los módulos financieros son **online-first** deliberadamente. Tareas, documentos y SST mantienen el flujo local-first de Fase 2; compras y comprobantes fiscales requieren conexión porque sus transiciones, correlativos y estados se protegen transaccionalmente en PostgreSQL.

Rutas principales:

- `/app/purchases` — proveedores y consolidado de órdenes.
- `/app/projects/[projectId]/purchases` — órdenes del proyecto.
- `/app/invoices` — series fiscales y consolidado de comprobantes.
- `/app/projects/[projectId]/invoices` — facturación del proyecto.

El MVP fiscal actual cubre Factura/Boleta con partidas gravadas bajo IGV 18 %. El envío real a SUNAT/PSE/OSE y la recepción de CDR quedan server-side para una fase de integración con proveedor y credenciales reales.

## Base remota Supabase

Proyecto: `MGL Systems` (`vscwajxzjnqlcdulfqzl`).

Migraciones remotas:

- `20260924043303_mgl_phase1_covering_indexes`
- `20260924045630_phase2_sync_rpc_v1`
- `20260924054329_phase3_company_onboarding`
- `20260924165342_phase5_financial_core`
- `20260924175437_phase5_workspace_context_performance`
- `20260924182005_phase6_project_control`
- `20260924182946_phase6_covering_indexes`
- `20260924183131_phase6_restore_private_rpc_grants`
- `20260924190959_phase7_inventory`
- `20260924191024_phase7_covering_indexes`
- `20260924192700_phase7_atomic_inventory_movement`
- `20260924193202_phase7_inventory_currency_guard`
- `20260924195722_phase8_advanced_planning`
- `20260924195747_phase8_covering_indexes`
- `20260924200035_phase8_planning_context_performance`
- `20260924201919_phase8_planning_integrity_guard`

Consulta `docs/phase5-implementation.md`, `docs/phase6-implementation.md`, `docs/phase7-implementation.md` y `docs/phase8-implementation.md` para alcance y límites.


## Fase 5.1 — rendimiento

Se consolidó el contexto del workspace en una RPC RLS-safe, se paralelizaron consultas de navegación, se eliminó una consulta redundante por proyecto y se añadió prefetch/feedback de transición. Ver `docs/performance-phase5.md`.


## Fase 8

Rutas principales:

- `/app/planning` — portafolio de plazos.
- `/app/projects/[projectId]/planning` — EDT/WBS, Gantt, CPM, línea base y Curva S del proyecto.

La edición de planificación de tareas sigue siendo local-first. La creación de una línea base es online y transaccional para garantizar una fotografía consistente del cronograma sincronizado.


## Arquitectura actualizada · Tarea 2

- IndexedDB conserva el nombre físico existente y migra de Dexie `version(2)` a `version(3)` sin borrar datos.
- Se agregan stores locales para etapas, partidas, notificaciones, entregas, push, peticiones, items de petición y preferencias.
- `src/features/budget/cost-calculator.ts` replica las fórmulas SQL de cotizado, real, desviación y semáforo.
- La allow-list de mutaciones de Fase 2 no se amplía todavía; los nuevos flujos de escritura se habilitarán en las tareas funcionales posteriores.
- La referencia SQL de Tarea 1 está versionada en `database/task1/`.

## Tarea 8 · Buscador global

La versión 0.8.10 incorpora una paleta global accesible con `Ctrl+K` / `Cmd+K` para buscar módulos, proyectos, tareas y documentos sobre la caché local Dexie. Las tareas y documentos usan enlaces profundos al registro encontrado. Consulta `TASK-8-READY.md` para el detalle.

## Hotfix 0.9.2 — recuperación de sincronización

Si una tarea queda con badge **Pendiente**, MGL procesa primero la outbox local antes del pull general, programa los reintentos según su backoff real y permite forzar el envío con **Reintentar**. Al actualizar desde 0.9.1 en el mismo `http://localhost:3000`, se conserva IndexedDB y se intentan recuperar automáticamente las mutaciones que ya estaban pendientes.

Ver `TASK-9.2-HOTFIX.md`.

## Hotfix 0.9.3 — Realtime de notificaciones

Corrige la colisión de canales Realtime cuando `useNotifications` se monta simultáneamente en la campana global y en la página de Notificaciones, o cuando React repite rápidamente el ciclo mount/cleanup en desarrollo. Cada montaje usa ahora un topic único y registra `postgres_changes` antes de llamar a `subscribe()`.

Ver `TASK-9.3-HOTFIX.md`.


## Tarea 9.4 — Hotfix Realtime robusto

`useNotifications` comparte ahora un único canal Supabase Realtime por empresa/usuario. La campana, drawer y `/notificaciones` se multiplexan sobre ese canal; `postgres_changes` se registra una sola vez antes de `subscribe()`. El canal se libera con retardo para tolerar remounts rápidos de React 19/Next.js 16.
