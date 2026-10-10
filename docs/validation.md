# Validación de Fase 1

Resultado: **38/38 pruebas aprobadas**, ejecutadas sobre PostgreSQL mediante PGlite 0.5.8. Evidencia individual en `tests/results.json`.
Se aplicó el SQL completo dentro de una base aislada y se hicieron consultas con roles `authenticated`/`anon` y distintos `auth.uid()`.

Cobertura:
- Aplicación completa del esquema y RPC de proyecto con alta automática del creador.
- Aislamiento de compañía, proyecto no asignado y empresa ajena.
- FK de membresía, responsable activo y prohibición de cambiar tenant.
- Permisos de field_worker, supervisor, admin; escalación de rol denegada.
- Dependencias cíclicas, progreso de tareas y LWW obsoleto/reloj futuro.
- CDR y estado fiscal inaccesibles para cliente; factura/lineas congeladas tras encolado.
- Totales decimales y restricción de acceso a finanzas.
- Unicidad de idempotencia, tombstones, revocación y acceso anónimo.

No comprobado aquí:
- Servicios remotos Auth, Data API/PostgREST, Realtime, Advisors ni generación real de tipos Supabase.
- Concurrencia entre sesiones; el bloqueo del grafo y cabeceras debe probarse en Postgres de staging con conexiones independientes.
- Integración SUNAT/PSE, validez del CDR y escenarios tributarios fuera del alcance descrito.
- Navegadores, IndexedDB, cuotas, background sync, expiración real de sesión y pruebas de UI: fases posteriores.

La simulación de Auth solo vive en la suite; no se entrega como reemplazo del esquema Auth real.
La CLI Supabase 2.117.0 creó el archivo de migración; no se ejecutó `db push` ni ninguna mutación remota.
El código SQL no usa try/catch de JavaScript. PL/pgSQL usa excepciones con SQLSTATE y rollback transaccional; solo la RPC añade contexto a conflictos de unicidad sin silenciarlos.


## Fase 2 — 2026-09-24

- Migración `20260924045630_phase2_sync_rpc_v1` aplicada correctamente al proyecto remoto MGL Systems.
- Supabase Security Advisor posterior a la migración: 0 hallazgos.
- Performance Advisor: solo avisos informativos de índices aún sin uso en una base sin tráfico real.
- Se verificó que `public.sync_mutation` es `SECURITY INVOKER` y solo `authenticated`/`service_role` tienen EXECUTE.
- `mgl_private.write_sync_receipt` es `SECURITY DEFINER`, está fuera del esquema expuesto y valida `auth.uid()` + acceso al proyecto antes de escribir.
- El entorno de construcción no pudo resolver `registry.npmjs.org` (EAI_AGAIN). Por ello no se ejecutó una compilación local falsa ni se generó un lockfile manual incompleto. Ver `DEPENDENCY-INSTALL-NOTICE.md`.
