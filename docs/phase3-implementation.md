# Fase 3 — Identidad, onboarding y workspace

## Implementado

### Auth SSR
- Login por correo/contraseña.
- Registro con redirect PKCE.
- Callback por `code` y endpoint alternativo por `token_hash`.
- Recuperación/cambio de contraseña.
- Cierre de sesión por Route Handler.
- Proxy con `getClaims()` y protección de `/app`, `/onboarding` y `/reset-password`.

### Onboarding
`public.bootstrap_company` es un wrapper `SECURITY INVOKER`. La operación privilegiada vive en `mgl_private.bootstrap_company` como `SECURITY DEFINER`, comprueba `auth.uid()`, serializa por usuario, no usa `user_metadata` para autorización y no concede INSERT directo sobre `companies`/`profiles`.

### Workspace
- Sidebar y header responsivos.
- Estado de sincronización de Fase 2.
- Selector de proyecto.
- Dashboard con métricas RLS.
- Creación/listado/vista general de proyectos.
- Equipo y roles en modo lectura.
- Edición controlada de perfil y razón social.
- Placeholders de Tareas, Documentos, SST, Compras y Facturación para siguientes fases.

### UI
- Tailwind CSS 4.3.3.
- Componentes estilo shadcn/ui.
- Lucide React.
- Framer Motion en micro-interacciones de Auth.

## Límite intencional de esta fase
Las invitaciones de usuarios y cambios administrativos de rol no se habilitan todavía. La base actual evita abrir una vía insegura de autoasignación de roles.

## Verificación esperada
`npm run verify` ejecuta TypeScript, pruebas unitarias, pruebas PostgreSQL/PGlite y `next build`.
