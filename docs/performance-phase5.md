# MGL Systems — Optimización de rendimiento Fase 5

## Problema observado

La navegación interna podía tardar varios segundos porque `requireWorkspaceContext()` hacía varias solicitudes Supabase de forma secuencial en cada render de servidor:

1. validación de sesión,
2. perfil,
3. empresa,
4. proyectos,
5. consulta propia del módulo.

En conexiones con latencia hacia la región de Supabase, esas esperas se acumulaban.

## Cambios

- `get_workspace_context()` consolida perfil, empresa y proyectos visibles en una sola llamada PostgreSQL/RPC.
- La función es `SECURITY INVOKER`; las políticas RLS existentes siguen controlando los proyectos visibles.
- `React.cache()` deduplica el contexto cuando layout y página lo solicitan dentro del mismo render RSC.
- `requireProjectContext()` reutiliza los proyectos ya devueltos por el contexto y elimina una consulta adicional.
- Dashboard, Tareas, Documentos, SST, Equipo, Compras, Facturación y vistas de proyecto arrancan sus consultas independientes en paralelo con el contexto.
- Los enlaces principales y la navegación de proyecto habilitan prefetch de Next.js.
- La navegación móvil usa `next/link` en lugar de `<a>`, evitando recargas completas.
- Se añadió `loading.tsx` para feedback inmediato durante transiciones que todavía necesiten red.

## Seguridad

No se añadió caché compartida entre usuarios. El contexto sigue siendo por solicitud/sesión y respeta RLS.
