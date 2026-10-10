# MGL Systems · Fase 7

## Alcance

La Fase 7 incorpora gestión de almacén e inventario integrada con proyectos, compras y centros de costo:

- catálogo corporativo de materiales (SKU, unidad y stock mínimo);
- múltiples almacenes por proyecto;
- requerimientos de materiales con aprobación y atención;
- ingresos manuales, salidas a obra y transferencias;
- recepción de órdenes de compra vinculadas a materiales;
- stock y valorización derivados del kardex, sin saldo editable;
- costo promedio para salidas y transferencias;
- alertas de stock mínimo;
- trazabilidad hacia requerimiento, orden de compra y partida presupuestal.

## Modelo de inventario

El stock no se guarda como un campo que pueda editarse. `inventory_stock` reconstruye existencias desde `inventory_transactions` e `inventory_transaction_items` con estado `posted`. Una transacción contabilizada queda inmutable.

Los movimientos soportados son:

- `receipt`: recepción de compra;
- `issue`: salida a obra / requerimiento;
- `transfer`: movimiento entre almacenes del mismo proyecto;
- `adjustment_in`: ingreso manual;
- `adjustment_out`: salida por ajuste.

Las salidas no permiten stock negativo. Las recepciones vinculadas a una OC no pueden exceder la cantidad comprada y toman el costo unitario neto de la partida de compra. Las salidas asociadas a un requerimiento no pueden exceder lo solicitado.

La valorización del inventario se expresa en la moneda base de la empresa. Por ello, una partida de OC vinculada a material de almacén debe estar en esa misma moneda; las compras en otra moneda siguen permitidas cuando no controlan stock. La conversión FX queda fuera del alcance de esta fase.

## Seguridad

Las seis tablas nuevas tienen RLS y soft delete. El catálogo y la configuración de almacenes corresponden a `admin`/`pm`; `supervisor` puede gestionar movimientos y aprobaciones; un `field_worker` puede crear y enviar sus propios requerimientos pero no contabilizar movimientos.

Las transiciones críticas se realizan mediante RPC server-side:

- `transition_material_request`;
- `post_inventory_transaction`;
- `create_inventory_movement`, que crea la cabecera, la línea y contabiliza el movimiento en una sola transacción para evitar borradores huérfanos.

Las vistas públicas de consulta usan `security_invoker=true`.

## Integración con fases anteriores

`purchase_order_items.material_id` permite enlazar una partida de OC con el catálogo. `budget_item_id` se conserva en requerimientos y movimientos para mantener la trazabilidad hacia la línea base de Fase 6.

Rutas principales:

- `/app/inventory` — consolidado por proyecto;
- `/app/projects/[projectId]/inventory` — stock, requerimientos y movimientos;
- `/app/projects/[projectId]/inventory/requests/[requestId]` — detalle y flujo del requerimiento.

## Límites de esta fase

La Fase 7 no incluye todavía lotes/series, códigos de barras, ubicación bin/rack, inventario cíclico, guía de remisión electrónica ni almacenes entre empresas. Esos flujos pueden incorporarse posteriormente sin cambiar el principio contable del kardex.
