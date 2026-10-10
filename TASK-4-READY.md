# MGL Systems — Tarea 4 lista

Versión: 0.8.3

## Alcance

- Dashboard gerencial por etapas montado en el Resumen del proyecto.
- KPI hero de desviación global cotizado vs. real con semáforo.
- Grid de las 7 etapas operativas con avance ponderado y control de costo.
- Top 5 partidas con mayor desviación.
- Actividad reciente basada en notifications bajo RLS.
- Reutiliza project_cost_summary(project_id) de la Tarea 1.
- Reutiliza cost-calculator.ts de la Tarea 2 para clasificar el semáforo.
- Reutiliza Card, Badge, ProgressBar y EmptyState de la Tarea 3.
- Sin edición de partidas: queda para Tarea 5.
- Sin mutaciones nuevas ni cambios de esquema en Supabase.

## Diseño

Se mantiene la regla visual 60/30/10:
- 60% blanco / gris muy claro.
- 30% bordes y superficies de soporte.
- 10% azul MGL para acentos y acciones.
- Verde/ámbar/rojo solo para estados semánticos.

## Validación recomendada

```powershell
npm install
npm run verify
```
