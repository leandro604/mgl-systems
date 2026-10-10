# Diccionario de datos

El archivo SQL es la definición exacta y ejecutable; este documento explica su intención.

| Tabla | Propósito y relaciones |
|---|---|
| companies | Razón social, RUC único, zona horaria y moneda por compañía. Alta servidor. |
| profiles | Enlace con auth.users, compañía, nombre y rol; un usuario por compañía en este MVP. |
| projects | Código único por compañía, descripción, estado, fechas y creador. |
| project_members | Usuarios asignados al proyecto, únicos por compañía/proyecto/usuario; reactivar actualizando el mismo registro. |
| tasks | Título, estado, prioridad 1–4, responsable, fechas, progreso y orden decimal Kanban. |
| task_dependencies | Dependencia fin-a-inicio; misma compañía y proyecto, sin autorreferencia ni ciclos. |
| documents | Metadatos Drive/OneDrive; ningún binario ni token OAuth. |
| sst_records | Inspección, incidente, capacitación o permiso; JSON de detalle y evidencia documental opcional. |
| purchase_orders | Cabecera de compra, proveedor, número, estado y moneda. |
| purchase_order_items | Cantidades, valores unitarios netos y tributos; montos calculados. |
| invoices | Borrador fiscal, receptor, fecha y estado; campos PSE/CDR restringidos al servidor. |
| invoice_items | Líneas de comprobante; inmutables después de abandonar draft. |
| sync_logs | Recibo de mutación por actor: UUID, hash de payload, operación y respuesta; solo escribe servidor. |

## Campos comunes

- `id uuid`: identidad estable. Reintentos reutilizan UUID; no usan autoincremento local.
- `created_at timestamptz`: fecha inicial del servidor, inmutable.
- `updated_at timestamptz`: instante lógico de la edición para LWW. No se sustituye por la hora de recepción.
- `server_updated_at timestamptz`: hora de recepción servidor para reconciliación; el trigger ignora valores suministrados por clientes.
- `mutation_id uuid`: identidad de la última mutación; junto con `updated_at` desempata LWW.
- `deleted_at timestamptz`: tombstone, NULL si activo. Eliminar y restaurar también requieren nueva versión.
- `company_id`: en todas salvo companies. `project_id`: en todas las entidades operativas y project_members.

Las claves comerciales (RUC, código de proyecto, número de orden, serie/número de factura) siguen reservadas después de una baja lógica. No se reutilizan silenciosamente.

## Estados

- Proyecto: `planning`, `active`, `on_hold`, `completed`.
- Tarea: `todo`, `in_progress`, `blocked`, `done`. `done` exige progreso 100; los demás estados exigen menos de 100.
- Compra: `draft`, `issued`, `received`, `cancelled`. Las líneas se editan exclusivamente en draft.
- Factura: `draft`, `queued`, `processing`, `submitted`, `accepted`, `rejected`, `unknown`, `voided`.

La máquina completa de transiciones fiscales y anulación se implementará con el proveedor en Fase 5. El cliente solo crea/edita `draft`; no puede cambiar directamente estado, serie, número ni CDR.

## Totales

Las vistas `invoice_totals` y `purchase_order_totals` usan `security_invoker=true`: respetan los permisos de las tablas y excluyen líneas/cabeceras eliminadas.
`net_amount = round(quantity * unit_price, 2)`.
`tax_amount = round(net_amount * tax_rate / 100, 2)`.
`total_amount = sum(net_amount + tax_amount)`.
Se permite un borrador vacío; exigir al menos una línea es una precondición de emisión en Fase 5.
