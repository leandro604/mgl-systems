# MGL Systems — Tarea 2 lista

Base: Fase 8 + Tarea 1 SQL aplicada en Supabase.
Versión del paquete: 0.8.1.

## Alcance implementado

1. Migración incremental Dexie `version(3)` porque Fase 8 ya ocupaba `version(2)`.
2. Sin cambio del nombre físico `mgl-systems-v2:<companyId>:<userId>` para conservar IndexedDB existente.
3. Nuevos stores locales:
   - projectStages
   - budgetItems
   - notifications
   - notificationDeliveries
   - pushSubscriptions
   - materialRequests
   - materialRequestItems
   - userPreferences
4. Backfill no destructivo de proyectos, perfiles, tareas y documentos existentes.
5. Tipos locales para etapas, control de costos, notificaciones, peticiones y preferencias.
6. `src/features/budget/cost-calculator.ts` con fórmula espejo PostgreSQL.
7. Pruebas unitarias nuevas para cálculo y migración local.

## Decisión de compatibilidad

No se amplió `SyncEntity` ni la RPC `sync_mutation` de Fase 2. Los nuevos stores existen localmente, pero sus mutaciones offline se incorporarán en las tareas funcionales posteriores para evitar que el motor actual intente enviar entidades que el backend todavía no admite en su allow-list.

## Validación disponible en este entorno

- Parsing de 131 archivos TS/TSX: 0 errores de sintaxis.
- Imports internos `@/`: 0 faltantes.
- Casos ejecutables del cost calculator: PASS.
- `npm install` no completó por timeout de red, por lo que `npm run verify` completo debe ejecutarse en el equipo del usuario.
