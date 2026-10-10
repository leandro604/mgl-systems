# MGL Systems v0.16.1 — Hotfix de prueba de valorizaciones

Corrige el test `Valuation snapshots baseline unit price`.

El esquema de seguridad de `valuation_items` no concede a usuarios autenticados permiso para insertar `unit_price`. Esto es intencional: el trigger `mgl_private.valuation_item_guard()` toma el precio unitario desde la partida de la línea base activa. La aplicación ya respetaba este diseño; el test era el que intentaba escribir `unit_price=999` directamente y recibía PostgreSQL `42501`.

El test ahora inserta únicamente la cantidad y comprueba que PostgreSQL complete `unit_price=10` y `amount=200` desde la línea base.

No requiere migración adicional de Supabase ni cambios de datos remotos.
