# MGL Systems 0.15.0 — Tarea 15

## Motor de compromisos presupuestales

Implementado:
- `budget_items.committed_amount`.
- `budget_items.executed_amount`.
- `budget_items.available_amount` generado.
- `budget_items.over_budget` generado.
- Tabla `budget_commitments` con RLS.
- Tabla `activity_feed` con RLS.
- Trigger al aprobar petición: crea/actualiza compromiso.
- Trigger al entregar petición: mueve compromiso a `executed`.
- Trigger al cancelar petición: mueve compromiso a `cancelled` y revierte rollup.
- Rollup automático hacia `budget_items`.
- Índice `activity_feed_actor_idx` para la FK del actor.

## Cálculo espejo TypeScript

`src/features/budget/commitment-calculator.ts`

Semántica:
- `committed`: suma de commitments `committed`.
- `executed`: suma de `executed` + `closed`.
- `available = quoted - committed - executed`.
- `overBudget = committed + executed > quoted`.

## UI

`/app/projects/[projectId]/partidas`
- Cotizado.
- Comprometido.
- Ejecutado.
- Disponible.
- Alerta visual si el disponible es negativo.
- Link de cada partida al detalle.

`/app/projects/[projectId]/partidas/[itemId]`
- Resumen de cotizado/comprometido/ejecutado/disponible.
- Trazabilidad: tipo, origen, monto, estado y fecha.

Alias compatible:
- `/app/proyectos/[id]/partidas/[itemId]`.

## Backend remoto

El esquema y triggers de Tarea 15 ya están activos en Supabase. Las pruebas se realizan con transacciones y `ROLLBACK` para preservar el proyecto real.

## SQL reproducible

`database/final/04-task15-commitments.sql`

## Validación transaccional final

Prueba realizada en Supabase con `BEGIN ... ROLLBACK`:

- Al aprobar S/ 100: `status=committed`, comprometido S/ 100, ejecutado S/ 0, disponible S/ 900.
- Al entregar: `status=executed`, comprometido S/ 0, ejecutado S/ 100, disponible S/ 900 y evento `commitment_executed`.
- Al cancelar una segunda petición aprobada: su commitment pasa a `cancelled`, el comprometido vuelve a S/ 0 y se registra `commitment_cancelled`.
- Ninguna fila temporal quedó persistida.
