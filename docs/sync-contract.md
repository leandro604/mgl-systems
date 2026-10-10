# Contrato para la Fase 2 (diseñado, aún no implementado)

## Mutación

```ts
type PendingMutation = {
  mutationId: string; // UUIDv4 estable para TODOS los reintentos de una operación
  entityId: string;   // UUIDv4 distinto del identificador de la mutación
  companyId: string;
  projectId: string;
  actorId: string;
  entity: "tasks" | "task_dependencies" | "documents" | "sst_records";
  operation: "create" | "update" | "soft_delete" | "restore";
  updatedAt: string; // ISO UTC; instante de edición local
  payload: Record<string, unknown>; // validar con Zod discriminado en implementación
};
```

El motor validará un discriminante por tabla/operación; este tipo explica el transporte y no sustituye esquemas Zod estrictos.
El servidor deriva actor de sesión; no confía en `actorId` ni en `companyId` sin RLS.
Compras/facturas usarán transacciones de agregado cabecera+líneas. La emisión es una operación online de servidor, nunca una actualización LWW de estado fiscal.

## Transacción servidor obligatoria

La Fase 2 añadirá una RPC de sincronización con allowlist de tablas y columnas. No utilizar SQL dinámico con identificadores recibidos del cliente.

1. Verificar sesión, compañía y permiso actual de proyecto.
2. Bloquear la clave de idempotencia `(company_id, actor_id, mutation_id)` para serializar reintentos.
3. Consultar `sync_logs`. Si existe y el hash canónico coincide, devolver la respuesta guardada. Si el mismo UUID trae otro payload, rechazarlo.
4. Bloquear fila/agregado objetivo y aplicar LWW o resolver el conflicto.
5. Escribir entidad y recibo `sync_logs` en la **misma transacción**. No escribir recibo de éxito antes de confirmar la entidad.
6. Devolver fila canónica y resultado `applied`/`conflict`/`rejected`.

La unicidad del SQL proporciona la base; todavía no existe la RPC que coordina estos pasos. Hacer un upsert y luego un insert de log en dos llamadas no satisface este contrato.

## LWW

Comparación lexicográfica de `(updated_at, mutation_id)`; gana el valor mayor, incluyendo eliminaciones/restauraciones. El trigger rechaza `<=` con `40001 / MGL_LWW_CONFLICT`.
`created_at` y `server_updated_at` nunca se usan como tiempo de edición del cliente. Una operación vieja no gana solo porque llegó tarde.
Se rechazan fechas de cliente más de cinco minutos por delante del servidor. En Fase 2 se medirá desfase y se mostrará conflicto/revisión, evitando reintentos infinitos.
El replay exacto se atiende desde `sync_logs` antes del trigger, no vuelve a mutar la entidad.
No resolver automáticamente un fallo de permisos, integridad o emisión fiscal mediante LWW.

## Descarga y tombstones

No filtrar `deleted_at` en los pulls de sincronización. Sí filtrarlo en UI.
Una primera implementación fiable puede reconciliar snapshots completos paginados de proyectos autorizados, seguida de pulls incrementales por `(server_updated_at,id)` con ventana de solapamiento y deduplicación.
**Un timestamp no es un orden de commit**: una transacción larga podría confirmar después de mover el cursor. No usar ese cursor sin solapamiento y reconciliación completa periódica. El futuro feed de cambios durable debe resolver ese riesgo si crece el volumen.
Realtime solo acelera invalidaciones; no es un log recuperable para clientes desconectados.
Después de cada login/reconexión, reconciliar la lista de proyectos visibles antes de hacer pulls. Una membresía revocada deja de permitir leer incluso su propio tombstone; no esperar recibirlo para detectar revocación.

## Cola local

Dexie guardará entidad + Outbox en una transacción. `pending_sync` es estado local; no es una columna compartida entre dispositivos.
FIFO por actor y base local. Evitar dos procesadores simultáneos mediante Web Locks con lease alternativo. Reintentos con backoff, jitter y `nextAttemptAt`.
Errores 401: refresco/reautenticación. 403: detener operación y revisar permisos. Conflictos: aplicar decisión y fila canónica. 429/5xx/red: reintento limitado y visible.
Una dependencia sin confirmar no adelanta a su padre. Un fallo permanente se marca bloqueado y se muestra al usuario, sin descartar silenciosamente su trabajo.
Fotos offline: blobs temporales con cuotas; primero subir al proveedor y después registrar metadatos. Reintentos deben reutilizar sesión/ID remoto para no duplicar archivos.
Service Worker cacheará app shell de forma versionada. No guardar respuestas de Auth, claves ni JSON privado en una caché compartida. Background Sync es una mejora progresiva, con fallback al abrir la app y al evento `online`.

## Evolución

LWW puede perder cambios concurrentes en campos diferentes. Guardar recibos y mostrar conflictos limita sorpresas, pero no convierte LWW en colaboración sin pérdidas.
Si la edición colaborativa lo exige, migrar por tipo de dato a operaciones CRDT versionadas, snapshots y compactación. Mantener UUIDs, autorización y protocolo versionado; no aplicar CRDT a numeración fiscal o estados PSE.
