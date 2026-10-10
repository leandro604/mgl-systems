# Fase 5 — Compras, costos y facturación

## Alcance implementado

### Proveedores
- Maestro de proveedores por empresa.
- RUC opcional validado a 11 dígitos cuando se informa.
- Contacto, correo, teléfono, dirección y moneda habitual.
- RLS: solo `admin` y `pm` pueden leer/escribir.
- Soft delete y protección de tenant mediante `row_guard`.

### Órdenes de compra
- Cabecera por proyecto con número interno, proveedor, moneda, fechas y notas.
- Partidas con cantidad, precio unitario, IGV y totales calculados en PostgreSQL.
- Estado protegido: `draft -> issued -> received` o cancelación desde draft/issued.
- La emisión exige al menos una partida activa.
- Una orden emitida congela cabecera y líneas.
- Costos comprometidos y recibidos por proyecto.

### Facturación
- Factura (`01`) y boleta (`03`) como borradores.
- Partidas gravadas con código de afectación `10` e IGV 18 % en este MVP.
- Series fiscales por empresa con correlativo transaccional.
- `queue_invoice` asigna serie+número y congela el comprobante de forma atómica.
- Estados CDR/PSE siguen protegidos del navegador.
- Resumen financiero por proyecto: costos, emitido, aceptado y margen operativo.

## Límite SUNAT

La Fase 5 **no envía todavía XML ni inventa una aceptación SUNAT**. Deja preparada la cola fiscal y el modelo de estados para conectar en una fase posterior un PSE/OSE o integración server-side. Las credenciales, certificados y CDR nunca deben residir en el frontend.

SUNAT mantiene guías para Factura y Boleta bajo UBL 2.1 y publica reglas de validación que cambian con el tiempo; antes de producción se debe validar el adaptador contra la versión vigente.

## Seguridad

- `fiscal_series.next_number` no es editable por el cliente.
- La reserva del correlativo usa bloqueo transaccional de la fila de serie.
- El cliente no puede fijar `accepted`, CDR ni respuesta PSE.
- Supervisores y trabajadores de campo no ven datos financieros.
- Las vistas financieras usan `security_invoker`.

## Validación esperada

```bash
npm run verify
```

Debe cubrir TypeScript, pruebas unitarias, PGlite/RLS y build de Next.js.
