# Setup — MGL Systems 0.12.0

## Instalación

```powershell
npm install
npm run verify
npm run dev
```

Abrir `http://localhost:3000`.

## Prueba operativa — Haldran / field_worker

1. `/field/hoy`
2. `/field/peticion/nueva` — crear una petición con material, cantidad, precio, aprobador, etapa y prioridad.
3. `/field/mis-peticiones` — confirmar que aparece incluso mientras esté pendiente de sincronizar.
4. `/field/sst` — registrar un reporte.
5. `/field/perfil` — editar datos personales.
6. `/field/notificaciones` — revisar cambios de estado de peticiones.

## Prueba gerencial — Leandro / admin

1. `/app/peticiones` — filtrar y abrir la petición.
2. Aprobar o rechazar. El rechazo exige motivo.
3. `/app/compras` — revisar OCs y peticiones aprobadas.
4. `/app/equipos` — revisar directorio e invitaciones/importación Excel.
5. `/app/reportes` — revisar las tres tablas de reporte.
6. `/app/finanzas` — revisar estructura por tipo de comprobante.

## Nota de validación

El entorno de construcción usado para esta entrega no pudo reconstruir `node_modules` porque `registry.npmjs.org` devolvió `EAI_AGAIN`. La sintaxis TypeScript/TSX y los imports internos sí fueron verificados. El `npm run verify` completo debe ejecutarse localmente después de `npm install`.
