# MGL Systems v0.18.1 — Archivo fiscal en Google Drive

## Objetivo

Los comprobantes electrónicos dejan de usar Supabase como repositorio permanente de archivos fiscales. MGL conserva en PostgreSQL únicamente metadata y referencias; el PDF, XML firmado y CDR se archivan en el Google Drive conectado por la empresa.

## Flujo

1. La empresa conecta Google Drive en **Configuración → Integraciones**.
2. En **Configuración → Facturación** activa **Archivar comprobantes automáticamente en Google Drive**.
3. Elige el formato PDF predeterminado para factura y boleta: A4, A5, Ticket 80 mm o Ticket 58 mm.
4. MGL emite el comprobante.
5. Cuando SUNAT lo acepta, MGL crea/reutiliza la ruta:
   `MGL Systems/Facturación Electrónica/<Año>/<Facturas|Boletas>/<MM - Mes>/`.
6. MGL sube PDF, XML y CDR.
7. `invoice_cloud_assets` conserva sólo `file_id`, carpeta, nombre, MIME, tamaño, SHA-256 y fecha de sincronización.
8. Para SUNAT directo, una vez confirmado el archivo en Drive se limpian `sunat_xml`, `sunat_cdr_zip_base64` y `cdr_xml` de `invoices`. Esos campos sólo sirven como buffer temporal seguro si Drive falla.

## Seguridad y comportamiento ante fallos

- La emisión queda bloqueada si la empresa no ha activado un Google Drive fiscal.
- Si SUNAT ya aceptó pero Drive falla, el comprobante **no se vuelve a emitir**: queda pendiente de sincronización y MGL conserva temporalmente los bytes necesarios para reintentar.
- La descarga de XML/CDR busca primero el archivo archivado en Drive.
- Un PDF en otro formato se genera bajo demanda y no se almacena, por lo que no multiplica el consumo del Drive.
- La tabla `invoice_cloud_assets` no es accesible desde `anon` ni `authenticated`; sólo el backend con `service_role` administra esas referencias.

## Migración requerida

Aplicar:

`supabase/migrations/20261011233000_task13_drive_fiscal_storage.sql`

Luego desplegar de nuevo la Edge Function:

`supabase/functions/emitir-factura/index.ts`

## Verificación local

```powershell
npm install
npm run verify
```

En este paquete también se añadió `tests/unit/invoice-pdf-formats.test.ts` para validar A4, A5, 80 mm y 58 mm.
