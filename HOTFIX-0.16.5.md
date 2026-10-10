# MGL Systems v0.16.5 — Personalización fiscal y PDF

## Incluye

- Logo de empresa PNG/JPG (máx. 2 MB) guardado en Supabase Storage privado (`company-branding`).
- Vista previa y opción para reemplazar/quitar el logo.
- Teléfonos y correos del emisor.
- Mensaje de agradecimiento y mensaje adicional para la representación PDF.
- Hasta 5 cuentas bancarias y 5 billeteras digitales.
- Logo, contactos, mensajes y medios de pago integrados al PDF MGL.
- No modifica el XML UBL ni los datos tributarios enviados a SUNAT.
- Mantiene series fiscales, SUNAT directo, Intifact y el hotfix React 19 de v0.16.4.

## Base de datos

Aplicar:

`supabase/migrations/20261009235500_task13_fiscal_branding.sql`

La migración es aditiva: agrega campos a `company_fiscal_settings` y no borra datos existentes.

## Seguridad

- El logo se almacena en un bucket privado.
- La carga/descarga administrativa se realiza server-side con la clave privada de Supabase.
- La tabla `company_fiscal_settings` continúa revocada para `anon` y `authenticated`.
