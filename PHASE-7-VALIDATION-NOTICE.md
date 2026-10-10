# Validación Fase 7

La migración fue validada primero dentro de una transacción con `ROLLBACK` y luego aplicada al proyecto remoto de Supabase.

Prueba funcional realizada contra PostgreSQL:

1. requerimiento de 5 unidades;
2. aprobación;
3. ingreso de 10 unidades a costo 20;
4. salida de 5 contra el requerimiento;
5. transferencia de 2 entre almacenes.

Resultado verificado antes de `ROLLBACK`: requerimiento `fulfilled`, stock 3 + 2 y valor total 100.

Los Advisors no reportan nuevas advertencias de seguridad relacionadas con la migración. Continúa únicamente el aviso preexistente de protección contra contraseñas filtradas desactivada. Los índices nuevos pueden figurar temporalmente como `unused_index` hasta que exista carga real.

Ejecutar en el equipo del usuario:

```powershell
npm install
npm run verify
```

No considerar cerrada la fase hasta que typecheck, unit tests, schema tests y build queden en verde.

Validación esperada del paquete 0.7.0:

- TypeScript: sin errores.
- Unit tests: 15 pruebas.
- Schema/RLS: 90 comprobaciones.
- Build Next.js: producción sin errores.

La creación de movimientos usada por la interfaz se consolidó en `create_inventory_movement`, por lo que cabecera + línea + contabilización ocurren en una sola transacción PostgreSQL. También se añadió un guard de moneda para impedir mezclar una OC en USD con un inventario valorizado en PEN (o viceversa) sin una conversión FX explícita.
