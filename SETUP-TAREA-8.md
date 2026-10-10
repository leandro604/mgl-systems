# MGL Systems — Tarea 8 · Arranque local

## 1. Instalar dependencias

```powershell
npm install
```

## 2. Configurar Supabase

Este paquete corregido ya contiene `.env.local` con la URL y la clave publicable del proyecto Supabase **MGL Systems**. No necesitas crear el archivo manualmente.

La configuración incluida usa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vscwajxzjnqlcdulfqzl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

> La clave publicable está diseñada para usarse en el navegador bajo RLS. No se incluye `service_role`, `sb_secret_*` ni ningún secreto de backend.

## 3. Verificar

```powershell
npm run verify
```

## 4. Ejecutar

```powershell
npm run dev
```

Abrir: http://localhost:3000

## Correcciones incluidas

- Props opcionales `initialSelectedId` y `focusTaskId` compatibles con `exactOptionalPropertyTypes`.
- `pendingSync` normalizado a `boolean` en el índice del buscador global.
- Se mantiene TypeScript estricto; no se desactivó ninguna validación.
