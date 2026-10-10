# MGL Systems v0.16.3 — Series fiscales + sidebar

Hotfix de interfaz sobre la base estable v0.16.2.

## Cambios

- Se agregó administración visual de series fiscales en `/app/configuracion/facturacion`.
- Alta de series para Factura (01 / Fxxx) y Boleta (03 / Bxxx).
- Visualización de próximo correlativo, última emisión y estado.
- Activación/desactivación de series sin permitir manipular el correlativo ya creado.
- El selector de `Serie fiscal` en comprobantes sigue consumiendo únicamente series activas.
- Se agregó acceso directo a `Facturación electrónica` e `Integraciones` en el sidebar.
- El sidebar ahora tiene desplazamiento vertical cuando la altura disponible no alcanza.
- Al contraer el sidebar, el header y el contenido principal acompañan el nuevo ancho de 64 px.
- Se agregó `Configuración` a la navegación móvil.
- Se corrigió el fallback de `SUPABASE_SERVICE_ROLE_KEY` vacío hacia `SUPABASE_SECRET_KEY` usando `||`.

## Base de datos

No requiere migración nueva. Reutiliza `public.fiscal_series`, sus políticas RLS y el RPC `queue_invoice` ya existentes.
