# MGL Systems v0.16.0 — Tarea 13 Reforzada v2

## Motor de Facturación Electrónica: PDF MGL + Intifact + SUNAT Directo

Esta versión parte de **v0.15.3 (Tarea 14 Server Actions Hotfix)** y refuerza el módulo de facturación sin retirar Intifact.

### Implementado

- PDF A4 generado por MGL Systems con:
  - datos del emisor y cliente;
  - serie/correlativo;
  - partidas, unidad, cantidad, precio e importe;
  - neto, IGV y total;
  - monto total en letras;
  - estado SUNAT/CDR;
  - marca de agua para borradores o comprobantes pendientes;
  - QR tributario en la parte inferior con corrección de error Q;
  - valor resumen (DigestValue) cuando el XML firmado ya existe.
- Descarga de PDF incluso sin Intifact.
- Descarga XML/CDR para emisión SUNAT directa y fallback a Intifact.
- Configuración fiscal por empresa en `/app/configuracion/facturacion`.
- Cifrado AES-256-GCM para usuario SOL, clave SOL, certificado PFX/P12 y contraseña del certificado.
- Selección de proveedor: `intifact` o `sunat_direct`.
- Ambiente SUNAT `beta` / `production`.
- Generación XML UBL 2.1 para factura electrónica 01.
- Firma XML con certificado digital.
- ZIP del XML y envío por `BillService/sendBill`.
- Recepción, extracción y persistencia del CDR.
- Persistencia del XML firmado, DigestValue y CDR original.
- Estados de emisión y errores visibles desde MGL.
- Intifact se mantiene como alternativa y como canal de boletas en esta versión.

## Limitación deliberada v0.16.0

**SUNAT directo está habilitado para facturas electrónicas tipo 01.**

Las boletas tipo 03 siguen por Intifact mientras se implementa el flujo completo de **Resumen Diario**. No debe activarse producción sin probar primero facturas reales de estructura equivalente en el ambiente Beta de SUNAT.

## Migración

Archivo:

```text
supabase/migrations/20261009203000_task13_sunat_direct_pdf.sql
```

Crea `company_fiscal_settings` y agrega a `invoices`:

- `emission_provider`
- `sunat_xml`
- `sunat_cdr_zip_base64`
- `sunat_digest`
- `sunat_response_description`

También adapta la evidencia requerida para el estado `accepted` a fin de admitir CDR almacenado directamente.

### Importante para este proyecto

El historial local de migraciones del ZIP no contiene todas las migraciones que ya existen en el Supabase remoto. Por ello, para esta entrega no se recomienda ejecutar `supabase migration repair --status reverted` sobre las migraciones remotas faltantes.

Mientras no se sanee ese historial, aplicar esta migración desde el SQL Editor y después registrar únicamente esta versión como aplicada:

```powershell
npx supabase migration repair --status applied 20261009203000
```

## Variables locales

Agregar a `.env.local`:

```env
FISCAL_CREDENTIALS_ENCRYPTION_KEY=UNA_CLAVE_LARGA_Y_PRIVADA
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

`FISCAL_CREDENTIALS_ENCRYPTION_KEY` debe mantenerse estable. Si cambia, MGL ya no podrá descifrar las credenciales/certificado guardados.

## Secreto de Edge Functions

La **misma** clave de cifrado debe existir en Supabase Edge Functions:

```powershell
npx supabase secrets set FISCAL_CREDENTIALS_ENCRYPTION_KEY="LA_MISMA_CLAVE_DE_ENV_LOCAL"
```

Si se seguirá usando Intifact como alternativa:

```powershell
npx supabase secrets set INTIFACT_API_KEY="TU_API_KEY"
```

Luego desplegar:

```powershell
npx supabase functions deploy emitir-factura
npx supabase functions deploy intifact-webhook
```

## Flujo de configuración

1. Abrir `/app/configuracion/facturacion` como administrador.
2. Seleccionar `SUNAT directo`.
3. Mantener `Beta / pruebas` inicialmente.
4. Completar dirección fiscal, ubigeo y establecimiento.
5. En Beta se puede dejar Usuario/Clave SOL vacíos para utilizar `MODDATOS`.
6. Cargar el certificado `.pfx`/`.p12` y su contraseña.
7. Guardar.
8. Crear una factura, agregar partidas y numerarla.
9. Usar `Emitir a SUNAT`.
10. Revisar CDR y descargar PDF/XML/CDR.

## Archivos principales

```text
src/features/fiscal/
  actions.ts
  crypto.ts
  fiscal-settings-form.tsx
  server.ts

src/features/invoices/
  pdf.ts
  pdf.test.ts
  intifact-actions.tsx
  offline.ts
  server.ts

src/app/api/invoices/[invoiceId]/[asset]/route.ts
src/app/(workspace)/app/configuracion/facturacion/page.tsx
supabase/functions/emitir-factura/index.ts
supabase/functions/intifact-webhook/index.ts
```

El generador QR incorpora una copia vendorizada del proyecto **QRCode for JavaScript** de Kazuhiko Arase bajo licencia MIT; se conserva el aviso de licencia en sus archivos fuente.

## Validación antes de producción

Ejecutar en la PC de desarrollo:

```powershell
npm install
npm run verify
```

Después realizar pruebas controladas contra SUNAT Beta. No pasar a `production` solo porque TypeScript/build pasen: la validación tributaria final requiere un XML firmado y CDR devuelto por SUNAT con la configuración/certificado de la empresa emisora.
