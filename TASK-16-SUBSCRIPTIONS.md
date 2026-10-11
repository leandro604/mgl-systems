# Tarea 16 — Suscripciones SaaS con Culqi

Versión: `0.18.0`

## Incluye

- Planes Básico, Pro y Empresa en PEN.
- Modalidad mensual y anual.
- Checkout Custom de Culqi para tokenizar tarjetas en el navegador.
- Creación server-side de cliente, tarjeta, plan Culqi y suscripción.
- Cancelación inmediata desde MGL Systems.
- Webhook `/api/billing/culqi/webhook` con verificación del evento contra la API de Culqi.
- Historial de cobros exitosos y fallidos.
- Límites opcionales de proyectos/usuarios por plan.
- Página pública `/planes`.
- Panel `/app/configuracion/suscripcion` exclusivo para administradores.

## Variables

```env
NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_...
CULQI_SECRET_KEY=sk_test_...
MGL_BILLING_ENFORCEMENT=off
```

`MGL_BILLING_ENFORCEMENT`:

- `off`: no bloquea funcionalidades existentes.
- `limits`: aplica límites cuando existe una suscripción activa.
- `strict`: exige suscripción activa y aplica límites.

## Base de datos

Aplicar:

`supabase/migrations/20261010211500_task16_culqi_subscriptions.sql`

`supabase/migrations/20261010212500_task16_billing_covering_indexes.sql`

`supabase/migrations/20261010213000_task16_billing_events_deny_policy.sql`

## CulqiPanel

Registrar el webhook público HTTPS:

`https://TU-DOMINIO/api/billing/culqi/webhook`

Eventos recomendados:

- `subscription.creation.succeeded`
- `subscription.creation.failed`
- `subscription.charge.succeeded`
- `subscription.charge.failed`
- `subscription.cancel.succeeded`
- `subscription.cancel.failed`
- `subscription.trial.end`

El endpoint vuelve a consultar el `event_id` en Culqi usando `CULQI_SECRET_KEY` antes de cambiar estado local.
