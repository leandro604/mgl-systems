# MGL Systems · Fase 6

## Alcance

La Fase 6 convierte compras y datos operativos en control de proyecto:

- versiones de presupuesto por proyecto;
- capítulos/grupos y partidas/subpartidas;
- línea base única e inmutable;
- centros de costo vinculados a líneas de órdenes de compra;
- control **sin IGV** de presupuestado, comprometido, recibido y saldo;
- avance físico por metrado ejecutado;
- porcentaje físico ponderado por valor presupuestal;
- valorizaciones por periodo con flujo borrador → presentada → aprobada/observada;
- precio unitario de valorización tomado desde la línea base en la base de datos;
- vista consolidada por proyecto y portafolio.

## Seguridad

Las tablas de control usan RLS y están limitadas a `admin` y `pm`. Las líneas base y valorizaciones se protegen con triggers/RPCs de PostgreSQL, no solo con controles de UI. Las vistas son `security_invoker=true`.

## Integración con Fase 5

`purchase_order_items.budget_item_id` enlaza una línea de compra con la partida presupuestal. Solo puede vincularse a una partida hoja de la línea base activa y la moneda debe coincidir con el presupuesto.

## Criterio económico

Los indicadores de Fase 6 son **netos, sin IGV**, para no confundir crédito/débito fiscal con costo operativo. Los módulos Compras y Facturación conservan sus totales tributarios con IGV.

## Migraciones

- `20260924182005_phase6_project_control.sql` — modelo, RLS, guards, RPCs y vistas de control.
- `20260924182946_phase6_covering_indexes.sql` — índices de cobertura para las claves foráneas de creador.
- `20260924183131_phase6_restore_private_rpc_grants.sql` — conserva los permisos internos requeridos por los wrappers de Fases 2, 3 y 5.

Las tres migraciones ya fueron aplicadas al proyecto Supabase principal. Los archivos se conservan para reproducibilidad.
