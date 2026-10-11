-- MGL Systems — Tarea 16: índices de cobertura para relaciones de facturación SaaS.
BEGIN;

CREATE INDEX IF NOT EXISTS company_subscriptions_plan_idx
  ON public.company_subscriptions(plan_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS company_subscriptions_created_by_idx
  ON public.company_subscriptions(created_by)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS subscription_payments_subscription_idx
  ON public.subscription_payments(subscription_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS billing_events_company_idx
  ON public.billing_events(company_id)
  WHERE company_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS billing_events_subscription_idx
  ON public.billing_events(subscription_id)
  WHERE subscription_id IS NOT NULL AND deleted_at IS NULL;

COMMIT;
