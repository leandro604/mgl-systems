# Fase 2 — estado de preparación

Backend remoto: proyecto Supabase **MGL Systems** (`vscwajxzjnqlcdulfqzl`).

Validado el 2026-09-23/24:
- 13/13 tablas esperadas presentes y con RLS activo.
- 35 políticas RLS públicas presentes.
- 2 vistas de totales presentes.
- RPC `public.create_project` presente.
- Security Advisor sin hallazgos.
- Se añadieron índices de cobertura para las FK compuestas de `purchase_order_items` e `invoice_items`.
- No existen todavía usuarios de Auth; el bootstrap de compañía/perfil debe hacerse después de crear el primer usuario real.

Configuración cliente:
- `.env.local` contiene únicamente URL y publishable key.
- Nunca añadir `service_role`, secret keys, contraseñas PSE u OAuth a variables `NEXT_PUBLIC_*`.

Siguiente paso (Fase 2): implementar Dexie/IndexedDB, outbox FIFO, idempotencia, reconciliación y cliente Supabase tipado. Al comenzar Fase 2, regenerar `Database` types desde el proyecto remoto y conectar el cliente web a este backend.
