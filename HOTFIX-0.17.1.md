# MGL Systems v0.17.1 — Administración de roles

## Cambio principal

La pantalla **Equipo** ahora permite que un usuario con rol `admin` cambie el rol de otros miembros activos del workspace.

Roles disponibles:

- Administrador (`admin`)
- Project Manager (`pm`)
- Supervisor (`supervisor`)
- Trabajador de campo (`field_worker`)

## Seguridad

- Solo un `admin` puede ejecutar el cambio.
- El administrador no puede cambiar su propio rol desde la interfaz Equipo.
- La operación usa el RPC existente `update_workspace_member_role`, que valida la empresa del actor y del usuario objetivo.
- La base de datos conserva la protección que impide dejar una empresa sin ningún administrador.
- El rol es global por empresa, por lo que modifica la interfaz y permisos del usuario en todos sus proyectos.

## UX

- Selector de rol directamente en la tabla Equipo.
- Botón Guardar solo cuando existe un cambio pendiente.
- Etiquetas legibles en vez de valores técnicos como `field_worker`.
- Mensaje de confirmación/error en la misma fila.
- La cuenta del administrador actual se muestra bloqueada como `Tu cuenta`.

No requiere migración de base de datos.
