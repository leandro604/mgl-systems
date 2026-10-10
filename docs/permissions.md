# Matriz de permisos

Todos requieren perfil y compañía activos. Para datos operativos, se exige proyecto asignado, también a administradores. El perfil de compañía sirve de directorio básico para asignaciones.

| Acción | admin | pm | supervisor | field_worker |
|---|---|---|---|---|
| Leer compañía y directorio básico de perfiles | Sí | Sí | Sí | Sí |
| Editar su propio nombre | Sí | Sí | Sí | Sí |
| Editar razón social | Sí | No | No | No |
| Cambiar compañía, rol o altas de perfiles | Servidor | Servidor | Servidor | Servidor |
| Crear proyecto | Sí | Sí | No | No |
| Leer proyecto | Asignado | Asignado | Asignado | Asignado |
| Editar/eliminar/restaurar proyecto | Asignado | Asignado | No | No |
| Asignar/revocar integrantes | Asignado | Asignado | No | No |
| Leer tareas/dependencias | Asignado | Asignado | Asignado | Asignado |
| Crear tarea | Sí | Sí | Sí | Solo para sí mismo |
| Editar tarea | Sí | Sí | Sí | Solo estado/progreso de tareas asignadas a sí mismo |
| Baja/restauración de tarea | Sí | Sí | Sí | No |
| Editar dependencias | Sí | Sí | Sí | No |
| Crear documentos/SST propios | Sí | Sí | Sí | Sí |
| Editar documentos/SST | Sí | Sí | Sí | Solo propios |
| Leer/gestionar compras y borradores fiscales | Sí | Sí | No | No |
| Marcar aceptado, asignar numeración, guardar CDR | Servidor | Servidor | Servidor | Servidor |
| Leer recibos de sincronización | Del proyecto | Del proyecto | Propios | Propios |
| Escribir recibos de sincronización | Servidor | Servidor | Servidor | Servidor |
| Borrado físico | No | No | No | No |

En esta fase el rol PM tiene acceso financiero a sus proyectos. Separar contabilidad/compras del PM requerirá nuevos permisos explícitos; no se infiere de la UI.
Los supervisores pueden registrar evidencias y tareas, pero no modificar membresías ni acceder a importes financieros.
Una baja de proyecto detiene escrituras de hijos y conserva lectura de tombstones para miembros activos. Una baja de compañía o perfil revoca el acceso online completo.
Las bajas de miembros no disparan borrado masivo en servidores: al reconectar, el cliente debe detectar la revocación y purgar su copia local.
El rol `service_role` omite RLS. Cada endpoint privilegiado debe verificar usuario, compañía y asignación antes de usarlo; estos permisos no constituyen validación automática de una Edge Function.
