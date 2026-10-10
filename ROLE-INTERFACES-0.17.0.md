# MGL Systems v0.17.0 — Interfaces por rol

## Objetivo
Separar la experiencia operativa del trabajador de campo de la experiencia administrativa/gerencial sin duplicar permisos de base de datos.

## Enrutamiento
- `field_worker` → `/field/hoy`
- `supervisor` → `/app`
- `pm` → `/app`
- `admin` → `/app`

Los layouts actúan como guardas de servidor:
- un trabajador que intente entrar a `/app/*` vuelve a `/field/hoy`;
- un usuario gerencial que intente entrar a `/field/*` vuelve a `/app`.

## Interfaz de campo
- Mis tareas
- Mis peticiones
- Notificaciones
- SST
- Mi perfil
- navegación inferior en móvil;
- sidebar operativo en escritorio;
- cierre de sesión visible en ambos formatos.

## Interfaz de gestión
El menú se adapta al rol:
- supervisor: operación/supervisión, proyectos, tareas, peticiones, documentos, SST, almacén, planificación, equipo, integraciones;
- PM: lo anterior + control, compras, finanzas y reportes;
- admin: acceso completo, incluyendo configuración fiscal.

La seguridad de datos sigue dependiendo de RLS, RPC y validaciones server-side existentes. La separación de interfaz no reemplaza esos controles.

## Migraciones
No requiere una nueva migración SQL.
