# MGL Systems 0.12.2 — Hotfix Next.js + Dexie

Correcciones sobre 0.12.1:

- Next.js 16: `dynamic` ya no se reexporta desde rutas alias. Se declara localmente en `/app/dashboard` y `/app/configuracion`.
- Dexie: las instancias locales se conservan por `companyId:userId` y ya no se cierran automáticamente cuando cambia/refresca la sesión.
- RuntimeBoot: evita reiniciar/cerrar IndexedDB para el mismo usuario en eventos repetidos de Supabase Auth.
- Cleanup de React/HMR: detiene el coordinador de sync pero no cierra IndexedDB antes de que terminen los `liveQuery` hijos.

Esto corrige los errores observados:

- `Next.js can't recognize the exported dynamic field in route. It mustn't be reexported.`
- `DatabaseClosedError: Database has been closed`

Validación en el entorno de entrega:

- Sintaxis TypeScript/TSX de los 4 archivos modificados: OK.
- `npm run typecheck` completo no pudo ejecutarse localmente porque `npm install` volvió a quedar incompleto por timeout de red del entorno de entrega. Ejecutar `npm install && npm run verify` en el equipo Windows del proyecto.
