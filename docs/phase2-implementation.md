# Fase 2 — implementación

Estado: implementada sobre el backend remoto `MGL Systems`.

Incluye:
- Next.js App Router con TypeScript estricto.
- Cliente Supabase navegador/servidor y proxy de refresco de sesión.
- Base IndexedDB con Dexie aislada por `companyId:userId`.
- Repositorios locales transaccionales para tareas, dependencias, documentos y SST.
- Outbox FIFO con dependencias entre mutaciones.
- Reintentos con exponential backoff + jitter y límite de intentos.
- Coordinación entre pestañas mediante Web Locks con lease alternativo.
- Reconciliación de proyectos visibles, perfiles, miembros y entidades con tombstones.
- Snapshot completo periódico + pulls incrementales con ventana de solapamiento.
- Service Worker de app shell que no cachea Auth/API/JSON privado.
- RPC `public.sync_mutation(...)` transaccional e idempotente.
- Recibos atómicos en `sync_logs` por `(company_id, actor_id, mutation_id)`.
- Allowlist de entidades/columnas; no hay SQL dinámico con identificadores del cliente.
- Conflictos LWW convertidos a respuesta canónica para reconciliación local.

Límites intencionales de esta fase:
- El alta de usuarios y UI de login se implementa en Fase 3.
- El aprovisionamiento inicial de compañía/perfil sigue siendo server-side/manual.
- Compras y facturas no usan la RPC LWW genérica; sus agregados transaccionales quedan para su fase funcional.
- Upload OAuth real a Google Drive/OneDrive no está implementado; solo existe staging local y metadatos.

Backend remoto:
- Migración aplicada: `phase2_sync_rpc_v1`.
- Proyecto: `vscwajxzjnqlcdulfqzl`.
