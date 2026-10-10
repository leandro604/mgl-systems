# Fase 4 — operación del proyecto

La Fase 4 convierte el workspace de Fase 3 en una herramienta operativa sobre el motor local-first de Fase 2.

## Alcance implementado

- Ficha operativa por proyecto en `/app/projects/[projectId]`.
- Edición de código, nombre, descripción, estado y fechas para `admin`/`pm`.
- Tablero de tareas por estado con prioridad, responsable, fechas y progreso.
- Creación/edición/archivo de tareas mediante Dexie + Outbox, con sincronización inmediata cuando hay conectividad.
- Dependencias de tareas local-first.
- Biblioteca documental por proyecto para referencias HTTPS de Google Drive/OneDrive.
- Registros SST (inspección, incidente, capacitación, permiso) local-first y asociación opcional a documento.
- Equipo por proyecto: alta/reactivación y retiro de perfiles ya existentes en la empresa para `admin`/`pm`.
- Vistas consolidadas de tareas, documentos y SST en el workspace.
- Evento `mgl:sync-request` para disparar un ciclo de sincronización inmediatamente después de una escritura local.

## Límites conscientes de esta fase

- Crear/editar el proyecto y administrar membresías requiere conexión; estas entidades todavía no forman parte del Outbox de Fase 2.
- Documentos son referencias a Drive/OneDrive. La subida binaria y OAuth de proveedores se hará con conectores dedicados.
- El alta de nuevos usuarios externos a la empresa no se abre aquí: Equipo administra perfiles existentes y evita modificar roles directamente.
- La navegación inicial tras un reload sigue requiriendo red; las operaciones local-first funcionan dentro del workspace ya cargado.

## Validación esperada

Ejecutar:

```bash
npm install
npm run verify
npm run dev
```

Las pruebas unitarias de Fase 4 validan escritura atómica tarea+Outbox, encadenamiento FIFO de ediciones y cola offline para documentos/SST.
