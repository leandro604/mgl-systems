# MGL Systems — Tarea 9.4 Hotfix Realtime

## Problema

Supabase JS 2.117.1 lanza `cannot add postgres_changes callbacks ... after subscribe()` cuando dos montajes de `useNotifications` terminan reutilizando un canal ya suscrito. Esto puede ocurrir con la campana global + la página de notificaciones o con remounts rápidos de React 19 en desarrollo.

## Corrección

- Nuevo `realtime-manager.ts` con registro compartido por `companyId:userId`.
- Un solo `.on(postgres_changes)` por canal y siempre antes de `.subscribe()`.
- Múltiples consumidores reciben el mismo evento mediante un `Set` de callbacks.
- Cleanup diferido 1.5 s para absorber Strict Mode/HMR/remounts sin carreras con `removeChannel()`.
- Cada ciclo de vida real usa un topic único.
- Se reportan estados `CHANNEL_ERROR`/`TIMED_OUT` al modelo de notificaciones.

No requiere migración de base de datos.
