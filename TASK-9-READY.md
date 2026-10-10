# MGL Systems — Tarea 9 lista

Versión: **0.9.0**

## Alcance implementado

- Campana de notificaciones conectada a datos reales.
- Contador reactivo de no leídas.
- Drawer lateral con últimas notificaciones.
- Ruta gerencial `/notificaciones`.
- Ruta operativa `/field/notificaciones`.
- Marcar una notificación como leída/no leída.
- Marcar todas como leídas.
- Navegación segura al `action_url` interno.
- Cache local Dexie y cambios optimistas de lectura/preferencias.
- Reintento de lecturas/preferencias pendientes al recuperar conexión.
- Supabase Realtime para `notifications`.
- Preferencias de email, Web Push y quiet hours.
- Email programado a +5 minutos.
- Trigger que cancela email/push pendiente si el aviso se leyó in-app.
- Quiet hours incluso cuando la ventana cruza medianoche (ej. 22:00–07:00).
- Web Push por dispositivo con `push_subscriptions`.
- Service Worker con eventos `push` y `notificationclick`.
- Edge Function `process-notification-deliveries` para Resend y Web Push.
- Worker con claim atómico, `SKIP LOCKED`, lease, reintentos y límite de intentos.
- Token privado adicional para proteger la invocación del worker.

## Migraciones de Tarea 9

Aplicadas al proyecto Supabase MGL Systems y presentes localmente:

```text
20260927022528_task9_notifications_runtime.sql
20260927022658_task9_preferences_delivery_trigger.sql
```

La segunda migración mantiene al navegador sin permiso `UPDATE` sobre
`notification_deliveries`: los ajustes de la cola se realizan mediante un
trigger privado `SECURITY DEFINER`.

## Edge Function

Desplegada en Supabase:

```text
process-notification-deliveries
version 2
verify_jwt = true
```

La función NO envía nada hasta configurar sus secretos. Esto es deliberado:
ningún secreto de Resend, VAPID privado o del worker debe quedar en el cliente.

### Secretos requeridos en Supabase Edge Functions

```text
MGL_NOTIFICATION_WORKER_TOKEN=<token largo aleatorio>
RESEND_API_KEY=<api key de Resend>
RESEND_FROM_EMAIL=MGL Systems <avisos@tu-dominio.com>
MGL_APP_URL=https://tu-dominio.com

# Solo si se habilitará Web Push:
VAPID_PUBLIC_KEY=<clave pública>
VAPID_PRIVATE_KEY=<clave privada>
VAPID_SUBJECT=mailto:admin@tu-dominio.com
```

En el frontend, solo la clave pública VAPID:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<misma clave pública>
```

## Cron del worker

Después de cargar los secretos, usar:

```text
supabase/task9-worker-cron.example.sql
```

El ejemplo sigue el patrón oficial `pg_cron + pg_net + Vault` y ejecuta el
worker cada minuto. No contiene secretos reales.

## Validación de backend realizada

Se probó usando una transacción con `ROLLBACK`; no se conservaron datos de
prueba ni se modificó el proyecto real.

Resultado:

```text
marked_read=true
email_cancelled_when_read=true
overnight_quiet_hours_ok=true
realtime_enabled=true
pending_delivery_rescheduled=true
```

También se ejecutaron los asesores de Supabase después de las migraciones.
No apareció una vulnerabilidad nueva asociada a Tarea 9.

## Validación local

Los 19 archivos TypeScript/TSX relevantes para Tarea 9 pasan parse/transpilación
TypeScript. En el entorno de generación no fue posible completar `npm install`
por timeout de red, por lo que la validación final del paquete debe ejecutarse
en la máquina de desarrollo:

```powershell
npm install
npm run verify
npm run dev
```

El proyecto conserva `.env.local` de la Tarea 8 corregida con las variables
públicas de Supabase. No se incluye `service_role` ni secretos privados.

## Prueba manual recomendada

1. Iniciar sesión.
2. Abrir la campana del topbar.
3. Confirmar contador y drawer.
4. Entrar a `/notificaciones`.
5. Marcar un aviso leído/no leído.
6. Activar quiet hours y guardar.
7. Desconectar red, cambiar lectura y reconectar para comprobar sincronización.
8. Una vez configurado Resend/Cron, generar una notificación y esperar 5 min.
9. Repetir leyendo el aviso antes de los 5 min: el email debe quedar `skipped`.
10. Si se configura VAPID, activar Web Push desde Preferencias y comprobar el dispositivo.
