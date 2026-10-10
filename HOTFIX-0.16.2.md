# MGL Systems v0.16.2 — Inventory immutability test hotfix

Corrige únicamente la expectativa del test `Posted inventory transaction and lines are immutable`.

- El encabezado `inventory_transactions` posteado queda protegido por RLS (`status='draft'`), por lo que un UPDATE cliente sobre una fila posteada afecta 0 filas.
- Las líneas `inventory_transaction_items` siguen protegidas por el trigger `inventory_transaction_item_guard`, que rechaza modificaciones con SQLSTATE `23514`.
- No modifica el esquema, RLS, triggers ni lógica de producción.
- No requiere migración Supabase.
