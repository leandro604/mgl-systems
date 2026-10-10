# MGL Systems — Tarea 9.3 HOTFIX Realtime de notificaciones

## Problema corregido
Supabase Realtime 2.117.1 impide registrar listeners `postgres_changes` después de que un canal entra en `joining` o `joined`. El hook `useNotifications` utilizaba un topic fijo por empresa/usuario. Si el hook se montaba más de una vez (por ejemplo, campana global + página de Notificaciones) o React repetía el montaje del efecto en desarrollo, el segundo montaje podía recibir/reutilizar un canal ya suscrito y lanzar:

`cannot add postgres_changes callbacks ... after subscribe()`

## Corrección
- Cada montaje de `useNotifications` crea un topic Realtime único con `crypto.randomUUID()`.
- El filtro canónico sigue siendo `recipient_id=eq.<userId>`, por lo que solo se reciben las filas autorizadas por RLS para ese usuario.
- Todos los callbacks `postgres_changes` se registran antes de `subscribe()`.
- El cleanup continúa usando `client.removeChannel(channel)`, pero un remount rápido ya no colisiona con el canal que se está cerrando.
- No se cambia el esquema de Supabase ni se borran notificaciones/Dexie.

## Estado verificado
En Supabase, Haldran tiene 3 notificaciones `task_assigned`; 2 permanecían sin leer al momento de la revisión. El error era de lifecycle Realtime del cliente, no de creación de las notificaciones.

## Prueba
1. Ejecutar esta versión en el mismo origen `http://localhost:3000`.
2. Entrar como Haldran.
3. Abrir/cerrar la campana varias veces.
4. Entrar también a `/notificaciones` mientras la campana global sigue montada.
5. No debe aparecer el error de callbacks después de `subscribe()`.
6. Asignar una tarea nueva desde Leandro; Haldran debe verla sin recargar cuando Realtime esté conectado.
