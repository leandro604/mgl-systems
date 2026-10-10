# MGL Systems 0.16.3 — Estado del roadmap 9–15

- Tarea 9 — Notificaciones: cerrada.
- Tarea 10 — Peticiones de materiales: cerrada.
- Tarea 11 — Interfaz operativa: cerrada.
- Tarea 12 — Interfaz gerencial: cerrada.
- Tarea 13 — **Reforzada v2**: PDF MGL, QR SUNAT, Intifact y canal SUNAT directo para facturas 01. Requiere migración, secretos y prueba end-to-end en SUNAT Beta antes de producción.
- Tarea 14 — Google Drive / OneDrive: reforzada y operativa a nivel de OAuth/exploración; requiere credenciales de producción y webhooks HTTPS para despliegue final.
- Tarea 15 — Motor de compromisos: cerrada.

## Verificación local

Ejecutar en Windows:

```powershell
npm install
npm run verify
npm run dev
```

En el entorno donde se generó esta entrega, `npm install` no pudo completarse por timeout de acceso al registro NPM. Sí se realizaron comprobaciones sintácticas sobre los archivos TypeScript/TSX modificados, validación JSON y una prueba aislada del generador QR. La prueba fiscal end-to-end requiere certificado/configuración de la empresa y SUNAT Beta.

## v0.16.3 — Hotfix de series fiscales y navegación

La configuración de facturación ahora incluye alta, listado y activación/desactivación de series fiscales. El sidebar es desplazable, expone accesos directos a Facturación electrónica e Integraciones y ajusta el workspace al contraerse. También se corrigió el fallback de `SUPABASE_SERVICE_ROLE_KEY` vacío hacia `SUPABASE_SECRET_KEY`. No requiere migración nueva.

Ver `HOTFIX-0.16.3.md`.

## v0.16.0 — Tarea 13 Reforzada v2

Incluye configuración fiscal cifrada por empresa, XML UBL 2.1 de factura 01, firma digital, envío `BillService/sendBill`, persistencia del CDR, descarga PDF/XML/CDR y PDF A4 propio con QR tributario. Las boletas 03 conservan Intifact hasta implementar Resumen Diario.

Ver `TASK-13-REFORZADA-V2.md`.
