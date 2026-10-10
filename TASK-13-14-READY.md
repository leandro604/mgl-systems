# MGL Systems 0.15.1 — Tareas 13 y 14 (Tarea 14 reforzada)

Base: 0.12.2. Alcance detenido expresamente en Tarea 14.

## Tarea 13 — Intifact

- Edge Function `emitir-factura` con autenticación JWT.
- Edge Function `intifact-webhook` con firma HMAC y ventana anti-replay.
- Campos de estado/idempotencia Intifact en `invoices`.
- Hash SHA-256 para no duplicar envíos.
- Reintento de documentos en cola fallida.
- Descarga proxy de PDF/XML/CDR sin exponer API key al navegador.
- PDF local con `pdf-lib` y marca `PENDIENTE DE ENVÍO`.
- Cola local Dexie `integrationJobs` y reintento al recuperar conexión.
- Ruta gerencial `/app/finanzas/invoices/[id]`.

## Tarea 14 — Drive / OneDrive

> Reforzada en v0.15.1. Ver `TASK-14-REFORZADA.md`.

- OAuth Google Drive y Microsoft OneDrive.
- Refresh tokens cifrados AES-256-GCM; la clave vive solo en runtime servidor.
- Rotación de refresh token cuando el proveedor entrega uno nuevo.
- `listFolders`, `createFolder`, `uploadFile`/sesión resumible y `watchFolder`.
- Upload directo navegador → proveedor mediante sesión resumible.
- Importación de carpetas `NN_` hacia `project_stages` y `documents`.
- Persistencia canónica de proveedor: `google_drive` / `onedrive`.
- No se usa Supabase Storage para documentos.
- UI `/app/configuracion/integraciones`.

## Backend remoto

- `emitir-factura`: ACTIVE.
- `intifact-webhook`: ACTIVE.
- Columnas Intifact en `invoices`: presentes.
- Columnas cifradas Drive/OneDrive en `profiles`: presentes.

## Pendiente de configuración externa

Las integraciones no pueden probarse end-to-end sin credenciales reales del usuario/proveedor. Configurar las variables descritas en `SETUP-TASK-13-14.md`.

## Continuación

Tarea 15 está cerrada en `TASK-15-READY.md` para la versión 0.15.0.
