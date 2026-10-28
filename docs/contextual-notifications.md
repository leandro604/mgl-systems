# Notificaciones contextuales

La migración `20261028203912_contextual_notifications.sql` reemplaza las funciones privadas de asignación y solicitudes. Conserva los triggers existentes, destinatarios, canales, metadata y enlaces. No cambia RLS, tablas, RPC de sincronización ni Dexie.

- Tareas: título de tarea y responsable; contexto con etapa, código de proyecto, actor y título completo. Distingue asignación de reasignación.
- Solicitudes: hasta tres materiales con cantidad y unidad, con contador de líneas adicionales. El cuerpo conserva el resumen completo de esas líneas, solicitante, etapa, proyecto y número. Sin líneas disponibles usa el título o número de solicitud.
- Cambios de estado: número, estado en español y materiales; el cuerpo incluye actor y motivo de rechazo cuando existe.
- La lista compartida por drawer y página muestra título y contexto en dos líneas compactas, conservando el texto completo en el atributo title.

El backfill modifica únicamente títulos genéricos exactos de los tipos correspondientes, con `entity_id`, empresa y proyecto coincidentes y entidades activas. No altera mensajes personalizados, entidades ausentes ni notificaciones eliminadas. Usa el destinatario histórico de tareas y el estado guardado en metadata de solicitudes, nunca el estado actual para reconstruir un evento antiguo. Los nombres, materiales y etapa se reconstruyen de los registros disponibles actualmente; no existe una instantánea histórica completa. Conserva `action_url`, lecturas y entregas. Actualiza `updated_at` y `mutation_id`; los triggers existentes actualizan `server_updated_at` y `version` para que los clientes reciban el cambio.

Aplicar mediante el proceso habitual de migraciones; no ejecutar de nuevo los SQL históricos. `database/notification-context.sql` es la copia utilizada por las pruebas locales; una prueba verifica su igualdad con la migración. El backfill es idempotente y no encola nuevas entregas.

Verificación: `npm run verify`, incluyendo `test:notification-context` sobre PostgreSQL local WASM con datos sintéticos, sin conexiones a producción.
