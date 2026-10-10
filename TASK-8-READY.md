# Tarea 8 — Buscador global Cmd+K / Ctrl+K

Versión: 0.8.10. Base: Tarea 7, versión 0.8.9.

## Implementado

- Buscador global disponible desde el header y mediante `Ctrl+K` en Windows/Linux o `Cmd+K` en macOS.
- Índice unificado para módulos, proyectos, tareas y documentos.
- Búsqueda tolerante a mayúsculas, tildes y signos; admite varias palabras y prioriza coincidencias en el título.
- Navegación completa por teclado: flechas arriba/abajo, `Enter` para abrir y `Esc` para cerrar.
- Resultados agrupados por tipo con contexto del proyecto y badge `LOCAL` cuando una tarea o documento está pendiente de sincronización.
- Lectura reactiva desde Dexie/IndexedDB usando `liveQuery`; no se agregó una consulta por tecla ni una dependencia de un motor de búsqueda externo.
- El índice se limita a los proyectos que el workspace autenticado ya expone al usuario.
- Accesos directos a los módulos principales aunque todavía no existan registros locales.
- Enlaces profundos: una tarea encontrada abre su Kanban y se resalta temporalmente; un documento encontrado abre directamente su panel de detalle.
- El buscador muestra el estado del índice local y continúa consultando la caché cuando el navegador queda sin conexión.

## Seguridad y arquitectura

No hay migración SQL ni cambio de RLS en esta tarea. La búsqueda no amplía permisos: solo indexa proyectos ya visibles en el contexto del workspace y filas que ya existen en la caché local del usuario. Los datos archivados se excluyen del índice.

No se guarda un índice duplicado en IndexedDB. Los resultados se construyen en memoria a partir de las tablas locales existentes, evitando inconsistencias y nuevas migraciones de Dexie.

## Archivos principales

- `src/features/search/global-search.ts` — normalización, índice y ranking.
- `src/features/search/global-search-command.tsx` — paleta de comandos, atajos y navegación.
- `src/features/search/global-search.test.ts` — pruebas de normalización, deep links, archivado y búsqueda contextual.
- `src/components/layout/workspace-header.tsx` — acceso al buscador.
- `src/app/(workspace)/app/projects/[projectId]/tasks/page.tsx` y `project-tasks-board.tsx` — foco de tarea.
- `src/app/(workspace)/app/projects/[projectId]/documents/page.tsx` y `project-documents-panel.tsx` — apertura directa de documento.

## Prueba funcional

1. Ejecutar `npm install` y `npm run dev`.
2. Entrar al workspace y presionar `Ctrl+K` o `Cmd+K`.
3. Buscar por código/nombre de proyecto, título de tarea, nombre/carpeta de documento o nombre de módulo.
4. Usar las flechas y `Enter` para abrir un resultado.
5. Abrir una tarea y comprobar el resaltado de la tarjeta.
6. Abrir un documento y comprobar que aparece su drawer de detalle.
7. Desconectar la red después de haber sincronizado datos y comprobar que las coincidencias locales siguen apareciendo.

## Validación

La Tarea 8 no requiere cambios remotos en Supabase. `npm run test` incluye automáticamente `global-search.test.ts`.

En el entorno de construcción usado para preparar esta entrega no fue posible completar `npm ci` porque el registro npm no estaba disponible desde el contenedor; por ello la verificación completa debe ejecutarse en el equipo del proyecto con las dependencias instaladas. Se realizó verificación sintáctica local de los archivos TypeScript/TSX modificados antes de empaquetar.

## Continuación

La siguiente tarea debe partir de esta versión 0.8.10 para mantener el buscador global y sus deep links.
