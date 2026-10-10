# MGL Systems 0.12.0 — Tareas 10, 11 y 12

Base: **0.9.4 — Hotfix Realtime compartido**.

## Tarea 10 — Peticiones de materiales

Rutas:
- `/app/peticiones`
- `/app/peticiones/[id]`
- `/field/peticion/nueva`
- `/field/mis-peticiones`
- `/field/peticion/[id]`

Incluye wizard de 3 pasos, aprobador, prioridad, fecha, etapa, partida opcional, cantidades y precios estimados, detalle gerencial, aprobación/rechazo con motivo, entrega/cancelación, optimistic UI, Dexie + Outbox y sincronización con RPC idempotente.

Backend remoto validado con transacciones `BEGIN/ROLLBACK`: creación, envío, notificación al aprobador, aprobación, ejecución y cancelación.

## Tarea 11 — Interfaz operativa

Rutas:
- `/field/hoy`
- `/field/tarea/[id]`
- `/field/peticion/nueva`
- `/field/mis-peticiones`
- `/field/sst`
- `/field/perfil`
- `/field/notificaciones`

Incluye BottomNav fijo de 5 tabs, tareas del día, actualización local-first de tareas, SST offline, perfil editable y bandeja de notificaciones.

## Tarea 12 — Interfaz gerencial

Rutas:
- `/app/dashboard`
- `/app/proyectos`
- `/app/proyectos/[id]/dashboard`
- `/app/proyectos/[id]/partidas`
- `/app/proyectos/[id]/kanban`
- `/app/proyectos/[id]/documentos`
- `/app/equipos`
- `/app/compras`
- `/app/finanzas`
- `/app/reportes`
- `/app/notificaciones`
- `/app/configuracion`

Equipo incluye directorio gerencial seguro, invitación existente y importación `.xlsx` (columna A email, columna B rol) asignando un proyecto seleccionado.

## Seguridad

- RLS existente se conserva.
- `list_workspace_members()` limita email/teléfono/DNI a `admin`, `pm` y `supervisor`.
- Las acciones de petición validan aprobador/proyecto en servidor.
- Los RPC privilegiados permanecen en `mgl_private`; wrappers públicos son `SECURITY INVOKER`.

## Validación

Validación realizada en este entorno:
- Parseo sintáctico de todos los `.ts/.tsx`: OK.
- Resolución de imports internos: OK.
- Supabase rollback de flujo Tarea 10: OK.
- Supabase rollback de compromiso ejecutado/cancelado: OK.
- Supabase Advisors: sin nuevas alertas de seguridad de estas tareas; permanece el warning global de Auth sobre leaked password protection.

`npm run verify` no pudo completarse aquí porque el entorno no resolvió `registry.npmjs.org` (`EAI_AGAIN`) y no pudo reconstruir `node_modules`. Ejecutar localmente:

```powershell
npm install
npm run verify
npm run dev
```

## Siguiente análisis

Tareas 13, 14 y 15 + cierre final del proyecto.

## Migraciones remotas aplicadas para este corte

- `20260929213534_task10_15_material_commitments` — dependencia backend ya aplicada antes de este corte.
- `20260929214127_task10_material_request_sync`
- `20260929214334_task10_material_request_transitions`
- `20260929214930_task12_team_directory`
- `20260929230844_task10_material_sync_public_wrappers`
- `20260929231005_task10_sync_receipt_material_entities`
- `20260930014148_task12_team_directory_manager_guard`

Las Tareas 13–15 no se declaran cerradas en esta versión. El backend remoto conserva artefactos preliminares creados durante el WIP anterior, pero quedan fuera del alcance y del ZIP 0.12.0 salvo la dependencia presupuestal que Tarea 10 necesita para calcular compromisos.
