# Configuración externa — MGL Systems 0.15.1

## 1. Instalación

```powershell
npm install
npm run verify
npm run dev
```

`pdf-lib` se añadió en esta versión para el PDF fiscal offline. Si el `package-lock.json` cambia durante el primer `npm install`, conservar el lock regenerado.

## 2. Intifact

En Supabase Edge Function secrets:

- `INTIFACT_API_KEY`
- `INTIFACT_WEBHOOK_SECRET`

Configurar en Intifact el webhook hacia la Edge Function `intifact-webhook` y usar el mismo secreto.

No poner ninguna de estas variables con prefijo `NEXT_PUBLIC_`.

## 3. Google Drive

Variables server-only:

- `DRIVE_TOKEN_ENCRYPTION_KEY`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`

Registrar como redirect URI:

`http://localhost:3000/api/oauth/google/callback`

En producción, registrar la misma ruta sobre el dominio HTTPS final.

## 4. Microsoft OneDrive

Variables server-only:

- `DRIVE_TOKEN_ENCRYPTION_KEY`
- `MICROSOFT_DRIVE_CLIENT_ID`
- `MICROSOFT_DRIVE_CLIENT_SECRET`
- `MICROSOFT_DRIVE_TENANT_ID` (opcional; `common` por defecto)

Redirect URI local:

`http://localhost:3000/api/oauth/microsoft/callback`

## 5. Seguridad

`DRIVE_TOKEN_ENCRYPTION_KEY` debe ser estable y privada. Si se cambia después de conectar cuentas, los refresh tokens existentes ya no podrán descifrarse y habrá que reconectar las cuentas.

No usar Supabase Storage para los documentos de Drive/OneDrive.


## 6. Tarea 14 reforzada — migración y webhooks

Aplicar la migración:

`supabase/migrations/20261003143000_task14_drive_onedrive_reinforced.sql`

Para sincronización automática:

- `MGL_APP_URL=https://tu-dominio-publico.com` (HTTPS obligatorio para proveedores).
- `DRIVE_WEBHOOK_SECRET` (secreto largo aleatorio, server-only).
- `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_SECRET_KEY` solo en el runtime servidor de Next.js.

En local (`http://localhost:3000`) funcionan OAuth, explorador, vinculación, subida y sincronización manual. Los webhooks requieren una URL HTTPS accesible desde Google/Microsoft.
