# Tarea 6 — Kanban filtrable por etapa

Versión: 0.8.8

## Alcance implementado

- Filtro horizontal por las 7 etapas del proyecto más vista "Todas".
- Cada tarea nueva exige `stage_id`.
- `budget_item_id` es opcional y el selector muestra únicamente partidas de la misma etapa.
- Las tarjetas muestran etapa, partida vinculada y estado de sincronización.
- Cambios de estado y progreso usan UI optimista sobre Dexie antes de sincronizar.
- La sincronización de tareas usa `public.sync_task_mutation(...)`, con idempotencia, LWW, RLS y validación de etapa/partida en PostgreSQL.
- Supervisores y trabajadores conservan el Kanban por etapa aunque no tengan permiso RLS para leer `project_budgets`.

## Verificación recomendada

```powershell
npm install
npm run verify
npm run dev
```

## Prueba funcional rápida

1. Abrir un proyecto y entrar a `Tareas`.
2. Elegir `04 · Ejecución en Campo` en el filtro.
3. Crear una tarea seleccionando obligatoriamente esa etapa.
4. Vincular una partida de la misma etapa si existe una línea base activa.
5. Cambiar el estado a `En curso` y comprobar el badge `Pendiente` hasta completar la sincronización.
