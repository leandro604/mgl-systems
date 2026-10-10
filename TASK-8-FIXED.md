# Tarea 8 — corrección de arranque y TypeScript

Correcciones aplicadas después de validar el reporte de ejecución:

1. `ProjectDocumentsPanel`: `initialSelectedId` solo se pasa cuando existe, compatible con `exactOptionalPropertyTypes`.
2. `ProjectTasksBoard`: `focusTaskId` solo se pasa cuando existe.
3. Índice del buscador: `pendingSync` se normaliza siempre a `boolean`.
4. Se añadió `.env.local` con la URL y la clave **publicable** verificadas del proyecto Supabase `MGL Systems`.
5. Se mantiene TypeScript estricto; no se desactivaron reglas del compilador.
6. No se hicieron cambios de esquema ni migraciones en Supabase.

Después de extraer:

```powershell
npm install
npm run verify
npm run dev
```

Prueba final de la Tarea 8: abre el workspace y presiona `Ctrl+K`.
