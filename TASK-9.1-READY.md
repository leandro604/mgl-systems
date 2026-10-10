# MGL Systems — Tarea 9.1 lista

## Problema corregido

El registro normal creaba un workspace nuevo para cada usuario sin distinguir a una persona invitada. Como consecuencia, dos cuentas reales podían terminar en empresas distintas y no aparecer en el selector de responsables del mismo proyecto.

## Implementado

- `Equipo > Invitar usuario` solo para administradores.
- Invitación por correo mediante Magic Link de Supabase.
- Selección de rol: admin, PM, supervisor o campo.
- Selección de uno o varios proyectos al invitar.
- Historial de invitaciones y revocación de pendientes.
- Pantalla `/join?invitation=...` para aceptar la invitación.
- `/onboarding` detecta una invitación antes de ofrecer crear una empresa nueva.
- El registro explica que `/register` es para crear una empresa nueva, no para usuarios invitados.
- Cambio de rol desde `/app/team` con protección para no dejar la empresa sin administrador.
- RLS: las invitaciones solo son visibles para el administrador de su empresa; el destinatario las consulta mediante RPC validado por su correo autenticado.
- Transferencia segura de un workspace accidental: solo se permite si la empresa anterior no tiene proyectos activos y solo tiene al propio usuario como perfil activo.
- Se conservan perfiles históricos con soft delete; no se borran físicamente.
- Al aceptar una invitación se crean/reactivan las membresías de proyectos seleccionados.

## Migración

- `20260927030908_task9_1_workspace_invitations.sql`
- `20260927031543_task9_1_invitation_security_hardening.sql`

Añade:

- `workspace_invitations`
- `create_workspace_invitation(...)`
- `list_workspace_invitations()`
- `get_my_workspace_invitation(...)`
- `accept_workspace_invitation(...)`
- `revoke_workspace_invitation(...)`
- `update_workspace_member_role(...)`

La segunda migración mueve la lógica privilegiada a `mgl_private`, deja wrappers `SECURITY INVOKER` en `public` y añade índices de FK.

También cambia la unicidad global histórica de `profiles.user_id` por una unicidad parcial sobre el perfil activo. Esto permite mantener el perfil anterior archivado sin perder referencias históricas y crear el perfil activo en el workspace aceptado.

## Caso real corregido

Las dos cuentas existentes quedaron en el mismo workspace y en `Hospital celendin`:

- Leandro mendoza — `admin`
- Haldran mendoza — `field_worker`

El workspace accidental de Haldran estaba vacío (0 proyectos, 1 perfil), por lo que fue archivado de forma segura al realizar la incorporación.

## Flujo futuro

1. Admin abre `/app/team`.
2. Escribe el correo.
3. Selecciona rol.
4. Selecciona proyectos.
5. Pulsa `Enviar invitación`.
6. El destinatario abre el Magic Link.
7. MGL valida que el correo autenticado coincide con la invitación.
8. Al aceptar, queda dentro de la misma empresa y de los proyectos seleccionados.

## Validación backend

Se probó primero con `BEGIN ... ROLLBACK`:

- invitación creada por admin;
- destinatario correcto puede verla;
- workspace accidental puede trasladarse;
- perfil anterior queda archivado;
- empresa accidental vacía queda archivada;
- perfil destino queda activo;
- membresía de proyecto queda activa;
- invitación queda `accepted`.

Después se aplicó el mismo flujo al caso real confirmado por el usuario.

Supabase Advisors quedó sin advertencias nuevas por las invitaciones; permanece únicamente la advertencia global preexistente de Auth sobre leaked password protection. Los avisos de índices sin uso son informativos en este proyecto reciente.

## Validación local

El entorno de generación no pudo completar `npm ci` porque el registro NPM no respondió y faltaban paquetes en caché. Se validó la sintaxis TS/TSX de los archivos modificados con TypeScript global. Ejecutar en la PC final:

```powershell
npm install
npm run verify
npm run dev
```

Si `verify` reporta un error, corregir sobre esta versión 0.9.1 antes de avanzar a Tarea 10.
