# Estructura del proyecto

Las carpetas `src`, `public` y `supabase/functions` están creadas con `.gitkeep`.
Los nombres de archivos de implementación siguientes son **destinos previstos**, no implementaciones entregadas.

| Carpeta | Archivos previstos | Fase |
|---|---|---|
| src/app | layout.tsx, globals.css, providers.tsx | 3 |
| src/app/(auth)/login | page.tsx | 3 |
| src/app/(workspace) | layout.tsx | 3 |
| src/app/(workspace)/dashboard | page.tsx | 3/4 |
| src/app/(workspace)/settings/password | page.tsx | 3 |
| src/app/(workspace)/projects/[projectId] | page.tsx | 4 |
| src/app/api/oauth | Rutas callback/proveedor | Integración documental posterior |
| src/components/layout | sidebar.tsx, header.tsx, sync-indicator.tsx | 3 |
| src/components/ui | Componentes Shadcn/ui | 3 |
| src/features/auth | schemas.ts, password-form.tsx, local-access.ts | 2/3 |
| src/features/projects | repository.ts, schemas.ts, hooks.ts | 4 |
| src/features/tasks | repository.ts, kanban.tsx, gantt.tsx, task-form.tsx | 4 |
| src/features/documents | upload-manager.ts, provider-adapter.ts | Integración documental posterior |
| src/features/sst | repository.ts, schemas.ts | Desarrollo funcional posterior |
| src/features/purchases | repository.ts, schemas.ts | Desarrollo funcional posterior |
| src/features/invoices | repository.ts, provisional-pdf.ts | 5 |
| src/lib/db | dexie.ts, schema.ts, migrations.ts | 2 |
| src/lib/sync | outbox.ts, engine.ts, reconcile.ts, retry.ts | 2 |
| src/lib/supabase | client.ts, server.ts, database.types.ts generado | 2/3 |
| src/lib/cloud | google-drive.ts, onedrive.ts | Integración documental posterior |
| src/stores | ui-store.ts | 3 |
| src/workers | service-worker.ts | 2 |
| src/types | domain.ts, result.ts | 2 |
| public | manifest.webmanifest, icons, worker compilado | 2/3 |
| supabase/functions/emitir-factura | index.ts, deno.json | 5 |
| supabase/functions/_shared | auth.ts, pse-client.ts, errors.ts | 5 |

Archivos reales incluidos ahora:

- `database/schema.sql` y su migración equivalente en `supabase/migrations/`.
- `database/bootstrap.example.sql`, `database/realtime.optional.sql`.
- `tests/schema.test.mjs`, `tests/results.json`.
- `package.json`, `package-lock.json`: herramientas reproducibles de validación, sin fingir que existe la aplicación Next.js.
- `.env.example`, `.gitignore`, `README.md`, documentos de arquitectura.

En el frontend se habilitarán `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. Los tipos de tablas se generarán de Supabase después de aplicar la migración, en lugar de mantener una copia manual susceptible de divergir.
