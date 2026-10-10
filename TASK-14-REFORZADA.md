# MGL Systems v0.15.1 — Tarea 14 Reforzada

## Objetivo

Convertir la base OAuth de Google Drive / OneDrive en una integración documental utilizable por proyecto, sin pedir IDs manuales y manteniendo los archivos en el proveedor cloud (no en Supabase Storage).

## Implementado

### 14.1 — Cuentas cloud seguras

- Nueva tabla `cloud_accounts` con RLS por usuario.
- Refresh tokens cifrados AES-256-GCM continúan siendo server-only.
- La migración mueve los ciphertexts heredados de `profiles` a `cloud_accounts` y limpia los campos antiguos.
- Se guarda ID de cuenta, correo, nombre y fecha de conexión.
- Botones Conectar / Reconectar / Desconectar.
- Revocación best-effort del token Google al desconectar.

### 14.2 — Explorador visual

- `/app/configuracion/integraciones` ya no solicita pegar `root_folder_id`.
- Navegador visual de carpetas para Google Drive y OneDrive.
- Soporte de carpeta raíz y navegación por subcarpetas.

### 14.3 — Proyecto ↔ carpeta cloud

- Nueva tabla `project_cloud_drives`.
- Un proyecto puede vincular Google Drive y/o OneDrive.
- Guarda carpeta raíz, proveedor, cuenta, estado, último sync y configuración de webhook.
- RLS: lectura por acceso al proyecto; modificación solo por el usuario que conectó la cuenta y con rol `admin`, `pm` o `supervisor`.

### 14.4 — Estructura automática

- Botón `Crear estructura`.
- Crea/reutiliza carpetas correspondientes a `project_stages`.
- Guarda `stage_folder_map` para que las subidas sepan a qué carpeta corresponde cada etapa.

### 14.5 — Subida directa desde Documentos

- Nuevo panel en `/app/projects/[projectId]/documents`.
- Selección múltiple de archivos.
- Carga resumible directa navegador → Google/OneDrive.
- Después de la carga, MGL registra metadatos en `documents`.
- No usa Supabase Storage.
- La subida valida que el destino pertenezca a la carpeta raíz o a una carpeta de etapa vinculada.

### 14.6 — Importación recursiva

- La sincronización ya no analiza solo un nivel.
- Recorre recursivamente hasta 12 niveles / 5000 elementos por ejecución.
- Detecta etapas por código (`00_`, `01_`, `04_`, `EV_`, etc.) o por `stage_folder_map`.
- Actualiza nombre, ruta, tamaño, URL y etapa de documentos existentes.
- Archiva en MGL los documentos de esa cuenta/proyecto que desaparecieron de la carpeta vinculada.

### 14.7 / 14.8 — Sincronización y webhooks

- `Sincronizar ahora` para sincronización manual completa.
- `Activar automático` / `Renovar webhook`.
- Google Drive: `changes.watch`, con canal firmado y expiración controlada.
- OneDrive: Microsoft Graph subscriptions sobre el root, compatible con OneDrive personal y trabajo/escuela.
- Endpoint: `/api/drive/webhook/[provider]`.
- Validación HMAC del token/clientState del webhook.
- Webhook usa clave Supabase privilegiada solo en servidor para ejecutar la sincronización sin sesión de navegador.

### 14.9 — Estado y errores

Cada vínculo mantiene:

- `sync_status`
- `last_sync_at`
- `sync_error`
- `sync_enabled`
- `watch_channel_id`
- `watch_resource_id`
- `watch_expires_at`
- `delta_cursor`

La interfaz muestra último sync, error y expiración del webhook.

- Las lecturas idempotentes a Google Drive / Microsoft Graph reintentan automáticamente respuestas `429` y `5xx` o fallos transitorios de red (hasta 3 intentos).

### 14.10 — Desconexión

- Desvincular carpeta de un proyecto.
- Desconectar completamente la cuenta cloud.
- `ON DELETE CASCADE` elimina vínculos pertenecientes a una cuenta eliminada.

### 14.11 — Seguridad / RLS

- RLS habilitado en las dos tablas nuevas.
- `anon` sin privilegios.
- Grants explícitos a `authenticated` y `service_role`.
- Credenciales cloud accesibles mediante RLS solo por su propietario.
- Los endpoints de upload verifican link, usuario y carpeta permitida.
- Webhook protegido por token HMAC (`DRIVE_WEBHOOK_SECRET`).

### 14.12 — Tests

- `drive-utils.test.ts` cubre detección de códigos de etapa y normalización del mapa de carpetas.
- La validación completa sigue siendo `npm run verify`.
- El E2E OAuth/upload/webhook requiere credenciales reales y un callback/webhook HTTPS público.

## Migración requerida

Aplicar:

`supabase/migrations/20261003143000_task14_drive_onedrive_reinforced.sql`

El mismo contrato consolidado está en:

`database/final/03-task14-drive.sql`
