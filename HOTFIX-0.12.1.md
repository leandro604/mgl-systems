# MGL Systems 0.12.1 — Hotfix TypeScript

Correcciones aplicadas sobre 0.12.0:

1. `src/features/field/field-ui.tsx`
   - La precarga Dexie ahora usa callback `async` con retorno `void` consistente.

2. `src/features/inventory/actions.ts`
   - El flujo legado de creación de requerimiento ahora completa `title` y una `stage_id` activa, requeridas por el esquema actual.

3. `src/features/material-requests/server.ts`
   - La consulta de `budget_items` vuelve a usar el cliente Supabase tipado, eliminando el `implicit any`.

4. `tests/unit/task5-budget-items.test.ts`
   - Fixture actualizado con `committed_amount`, `executed_amount`, `available_amount` y `over_budget`.

Versión: 0.12.1

Validación local del entorno de generación:
- Sintaxis TypeScript/TSX de los cuatro archivos modificados: OK.
- El `npm install` completo no pudo finalizar en este entorno por acceso al registro NPM, por lo que el `npm run verify` completo debe ejecutarse en el equipo destino.
