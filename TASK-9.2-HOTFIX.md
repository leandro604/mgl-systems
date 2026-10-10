# MGL Systems — Tarea 9.2 HOTFIX de sincronización

## Problema corregido
Las tareas podían permanecer indefinidamente con el badge **Pendiente** en Dexie aunque el navegador estuviera online. Mientras una tarea no llega a Supabase, no existe `assignee_id` canónico ni se dispara `task_assigned`, por lo que el responsable tampoco recibe notificación.

## Cambios
- El motor ahora vacía la **outbox antes de reconciliar/pullar módulos remotos**.
- Al arrancar esta versión se despiertan inmediatamente las mutaciones `retry` heredadas de la versión anterior, sin resetear su contador de intentos.
- Se vuelve a vaciar la outbox después de reconciliar, para dependencias que hayan quedado desbloqueadas.
- Crear/mover/actualizar/eliminar tareas y dependencias intenta una **sincronización inmediata verificable** cuando hay conexión.
- Si otro proceso tiene el lock de sincronización, la acción espera hasta 12 s y reintenta adquirirlo.
- Las tarjetas pendientes o con error muestran **Reintentar**.
- Los fallos temporales ya no esperan al ciclo periódico de 60 s: el coordinador programa el siguiente intento exactamente según el backoff de la outbox.
- Mientras existe un fallo temporal, la tarjeta muestra el detalle `Reintentando: ...` en vez de quedar silenciosamente en Pendiente.
- Los errores de sincronización se muestran al usuario en vez de dejar únicamente el estado Pendiente.
- El indicador superior `Error de sync` expone el detalle en su tooltip.

## Recuperación de tareas ya pendientes
No borres IndexedDB ni limpies datos del navegador. Ejecuta esta versión en el mismo origen `http://localhost:3000`. Al iniciar, el coordinador procesa primero la outbox existente, por lo que las tareas creadas con la versión anterior deben enviarse automáticamente.

## Validación recomendada
1. Cerrar el servidor anterior.
2. Ejecutar esta versión en puerto 3000.
3. Entrar como Leandro y abrir Hospital celendin > Tareas.
4. Esperar unos segundos. Las tarjetas `Pendiente` deben pasar a `Sync`.
5. Entrar como Haldran: debe aparecer la notificación `Nueva tarea asignada`.
6. Si una tarjeta sigue pendiente, pulsar `Reintentar`; ahora se mostrará el error real si Supabase rechaza la mutación.
