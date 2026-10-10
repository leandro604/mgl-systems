# Fase 5 — validación pendiente en equipo local

El backend remoto fue migrado y probado en una transacción real con `ROLLBACK`:

- proveedor creado;
- orden + partida creada;
- transición `draft -> issued -> received`;
- total de compra S/ 118 para base 100 + IGV 18;
- serie fiscal creada;
- factura + partida creada;
- `queue_invoice` asignó correlativo 700;
- total de factura S/ 118;
- toda la prueba fue revertida al terminar.

Además, los 104 archivos TypeScript/TSX del proyecto pasaron un chequeo de sintaxis con 0 errores.

El entorno de generación no pudo completar `npm install` por timeout del registro npm. Ejecuta en tu PC:

```bash
npm install
npm run verify
```

La advertencia actual del Security Advisor de Supabase es `Leaked Password Protection Disabled`; no proviene de Fase 5 y debe activarse antes de producción.
