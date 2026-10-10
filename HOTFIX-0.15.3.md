# MGL Systems v0.15.3 — Hotfix Server Actions Tarea 14

## Correcciones

- Corrige el Runtime Error de Next.js 16: `A "use server" file can only export async functions, found object`.
- Elimina el export runtime `initialDriveActionState` del módulo `src/features/drive/actions.ts`.
- Mantiene los tipos TypeScript del estado sin exportar valores runtime no permitidos.
- Cambia Conectar/Reconectar Google Drive y OneDrive de `next/link` a navegación HTML directa (`<a href>`), evitando que Next.js intente obtener un RSC payload para endpoints OAuth que responden con 307.
- No modifica las tablas, tokens OAuth ni la migración Supabase de Tarea 14.

## Validación

Se revisaron todos los archivos bajo `src/` con directiva `use server`: no quedan exports runtime que no sean funciones async.

En el entorno de generación no fue posible completar `npm install`, por lo que `npm run verify` debe ejecutarse en el equipo de desarrollo con dependencias instaladas.
