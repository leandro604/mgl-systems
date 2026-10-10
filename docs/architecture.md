# Arquitectura

## Capas

- `src/app`: rutas de Next.js App Router, layouts y endpoints. No contiene reglas de sincronización embebidas en componentes.
- `src/features`: casos de uso, esquemas Zod y UI por módulo. Los repositorios ocultan IndexedDB y la API.
- `src/lib/db`: Dexie y migraciones locales, separados del esquema Postgres.
- `src/lib/sync`: cola, procesador y reconciliación. Importable por ventana y worker; sin dependencias de React ni del DOM.
- `src/lib/supabase`: clientes de navegador/servidor y tipos generados desde la base aplicada.
- `src/stores`: Zustand solo para estado de UI. Dexie es la fuente local de entidades; TanStack Query maneja lecturas remotas y su caché.
- `src/components/ui`: Shadcn/ui; layout y accesibilidad en carpetas separadas.
- `supabase/functions`: integraciones de servidor. El PSE nunca se invoca con su token privado desde el navegador.

Se usará Next.js 14 o posterior, TypeScript estricto, Tailwind, Lucide, Framer Motion, React Hook Form y Zod en las siguientes fases. Las dependencias de UI se fijarán juntas al iniciar su implementación; no se declara ahora una aplicación Next funcional ficticia.

## Multi-tenancy

Cada entidad tiene un UUID generado por el cliente; Postgres ofrece `gen_random_uuid()` como respaldo para operaciones servidor. `company_id` y `project_id` son inmutables.
Las FK compuestas impiden, por ejemplo, una tarea de empresa A con responsable de empresa B o una dependencia hacia una tarea de otro proyecto.
Los helpers de RLS se ubican en `mgl_private`, con `search_path` vacío, referencias calificadas y usuario derivado de `auth.uid()`. Su privilegio definidor permite consultar membresías sin recursión de RLS; no permite elegir otra identidad.
Las funciones de trigger no son endpoints públicos. La única RPC pública de esta fase, `create_project`, es SECURITY INVOKER y sigue sometida a RLS.

Un admin controla solo sus proyectos asignados. Recuperar un proyecto sin PM/admin activo requiere aprovisionamiento de servidor, con verificación organizacional. No se añade una puerta de acceso global al rol admin.

## Auth y funcionamiento offline

La autenticación remota y el desbloqueo de datos locales son conceptos distintos. No se crea una autenticación válida en Supabase a partir de un JWT vencido.
En la Fase 2 se almacenará una identidad local previamente verificada, separada por `company_id + user_id`. El modo offline permite cambios locales pendientes, mientras la API sigue exigiendo una sesión válida.
Al reconectar: refrescar sesión, comprobar compañía y membresías, luego procesar Outbox. Si el refresco falla, pausar y pedir inicio de sesión; no enviar con otro usuario.
No hay almacenamiento de navegador que haga invulnerable un bearer token frente a XSS. No se guardarán copias adicionales del JWT en Dexie, Cache Storage o logs. La implementación de sesión SSR/navegador deberá decidir el flujo y endurecer CSP antes de producción. Contraseñas y cambios de contraseña requieren conexión.
La revocación remota no puede borrar un dispositivo desconectado inmediatamente. En cada reconexión se reconcilian permisos y se purgan datos revocados; el cambio de cuenta no reutiliza la base de otra persona.

## Documentos

`documents` guarda únicamente proveedor, cuenta, identificador externo, URL y metadatos. Los blobs offline serán temporales en IndexedDB, sujetos a cuotas y errores de almacenamiento.
Google Drive/OneDrive usan OAuth con PKCE, permisos mínimos y subida directa a su API, preferentemente reanudable. Nunca se almacenan secretos OAuth en tablas públicas. Los permisos del archivo en la nube del usuario son independientes de RLS y deben configurarse coherentemente.
Las URLs HTTPS no equivalen a una validación de proveedor: en la fase de integración se verificará host, cuenta y archivo. Ningún backend debe hacer fetch ciego de estas URLs.

## Facturación

Esta fase modela borradores de factura/boleta con operaciones gravadas y sin descuentos, anticipos, exportación, detracción, percepción, ISC ni notas de crédito/débito. `tax_affectation_code='10'` hace explícito este alcance reducido. `tax_rate=18` es una configuración inicial, no un motor de determinación tributaria; debe confirmarse para cada operación y contrato PSE.
`unit_price` es valor unitario SIN IGV. Redondeo decimal a dos posiciones por línea; el proveedor seleccionado deberá confirmar que coincide con su contrato.
La validación de RUC en SQL solo verifica once dígitos; no consulta condición del contribuyente ni dígito verificador.
El PDF offline futuro tendrá UUID y marca **PENDIENTE DE ENVÍO**, sin apropiarse de un correlativo oficial definitivo.
La Fase 5 deberá asignar serie/correlativo bajo bloqueo transaccional, guardar snapshot fiscal, validar totales e identidad del emisor y emitir mediante PSE. Un HTTP 200 o un estado `submitted` nunca significa aceptación SUNAT.
`accepted` exige CDR con código de aceptación, URL y fecha; el servidor verificará que ese CDR corresponde al emisor y comprobante. La restricción SQL verifica presencia, no autenticidad criptográfica del CDR.
Timeouts ambiguos pasarán a `unknown`, con consulta al PSE antes de reenviar. La idempotencia local no garantiza exactamente una emisión externa: depende del protocolo del proveedor.

## Fuentes técnicas consultadas

- https://supabase.com/changelog.md (24/09/2026; cambios relevantes: restricciones del esquema realtime y versiones de extensiones; no se modifica ese esquema ni se fijan versiones de extensiones).
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/tables

No se afirma homologación ni cumplimiento tributario integral con este esquema. La integración y pruebas del proveedor pertenecen a Fase 5.
