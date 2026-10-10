# MGL Systems v0.15.2 — Hotfix Tarea 14

Corrige los errores detectados al ejecutar `npm run verify` en v0.15.1:

- TS2783 en `project-documents-panel.tsx`: se eliminan propiedades duplicadas antes del spread.
- TS2322 en `repository.ts`: `LocalDocument` deja de exigir `search_vector`, que es una columna derivada del servidor y no pertenece al registro local.
- TS2322 en `dexie.ts`: `stage_id` local vuelve a admitir `null` durante migraciones de IndexedDB antiguas.
- PGRST205: las pantallas de Documentos e Integraciones ya no colapsan si la migración cloud todavía no fue aplicada; muestran un aviso de configuración pendiente.

## Activación de Drive/OneDrive en Supabase

La funcionalidad cloud requiere aplicar:

`supabase/migrations/20261003143000_task14_drive_onedrive_reinforced.sql`

Con el proyecto Supabase enlazado:

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Después:

```powershell
npm run verify
npm run dev
```
