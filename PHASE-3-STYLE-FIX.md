# Fase 3 — corrección de estilos Tailwind

La primera versión de Fase 3 podía cargar el CSS global sin generar las utilidades Tailwind en algunos entornos.

Correcciones:

- Se agregó `postcss@8.5.28` como dependencia de desarrollo explícita.
- `globals.css` fija `src` como base de detección mediante `@import "tailwindcss" source("../");`.
- No se modificó Supabase ni las migraciones.

Después de extraer esta versión:

```powershell
npm install
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run verify
npm run dev
```

Si existía un servidor de desarrollo anterior, detenerlo antes con `Ctrl+C`.
