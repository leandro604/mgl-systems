-- MGL Systems — Tarea 16: suscripciones SaaS con Culqi.
-- Planes globales, una suscripción activa por empresa, historial de cobros y webhooks idempotentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  code text NOT NULL CHECK(code ~ '^[a-z0-9_-]{2,40}$'),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 80),
  billing_interval text NOT NULL CHECK(billing_interval IN ('month','year')),
  price_cents integer NOT NULL CHECK(price_cents >= 300),
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  max_projects integer CHECK(max_projects IS NULL OR max_projects > 0),
  max_users integer CHECK(max_users IS NULL OR max_users > 0),
  features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(features)='array'),
  provider text NOT NULL DEFAULT 'culqi' CHECK(provider='culqi'),
  provider_plan_id text,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(code,billing_interval),
  UNIQUE(provider,provider_plan_id)
);

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  provider text NOT NULL DEFAULT 'culqi' CHECK(provider='culqi'),
  provider_customer_id text,
  provider_card_id text,
  provider_subscription_id text,
  provider_status integer,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','trialing','active','past_due','canceled','ended','failed')),
  billing_contact_name text NOT NULL DEFAULT '',
  billing_email text NOT NULL DEFAULT '',
  billing_phone text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT '',
  billing_city text NOT NULL DEFAULT '',
  card_brand text,
  card_last_four text CHECK(card_last_four IS NULL OR card_last_four ~ '^[0-9]{4}$'),
  next_billing_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  idempotency_key uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(provider,provider_subscription_id),
  UNIQUE(idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_one_live_subscription_idx
  ON public.company_subscriptions(company_id)
  WHERE deleted_at IS NULL AND status IN ('pending','trialing','active','past_due');
CREATE INDEX IF NOT EXISTS company_subscriptions_company_created_idx
  ON public.company_subscriptions(company_id,created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  subscription_id uuid NOT NULL REFERENCES public.company_subscriptions(id),
  provider text NOT NULL DEFAULT 'culqi' CHECK(provider='culqi'),
  provider_event_id text NOT NULL,
  provider_charge_id text,
  amount_cents integer NOT NULL DEFAULT 0 CHECK(amount_cents >= 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK(currency IN ('PEN','USD')),
  status text NOT NULL CHECK(status IN ('pending','paid','failed','refunded')),
  card_brand text,
  card_last_four text CHECK(card_last_four IS NULL OR card_last_four ~ '^[0-9]{4}$'),
  failure_message text,
  paid_at timestamptz,
  UNIQUE(provider,provider_event_id),
  UNIQUE(provider,provider_charge_id)
);
CREATE INDEX IF NOT EXISTS subscription_payments_company_created_idx
  ON public.subscription_payments(company_id,created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  provider text NOT NULL DEFAULT 'culqi' CHECK(provider='culqi'),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  subscription_id uuid REFERENCES public.company_subscriptions(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'),
  processed_at timestamptz,
  error text,
  UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS billing_events_unprocessed_idx
  ON public.billing_events(created_at)
  WHERE processed_at IS NULL AND deleted_at IS NULL;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_plans,public.company_subscriptions,public.subscription_payments,public.billing_events
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.subscription_plans TO anon,authenticated,service_role;
GRANT SELECT ON public.company_subscriptions,public.subscription_payments TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.subscription_plans,public.company_subscriptions,public.subscription_payments,public.billing_events TO service_role;

DROP POLICY IF EXISTS subscription_plans_public_read ON public.subscription_plans;
CREATE POLICY subscription_plans_public_read ON public.subscription_plans
  FOR SELECT TO anon,authenticated
  USING(active AND deleted_at IS NULL);

DROP POLICY IF EXISTS company_subscriptions_admin_read ON public.company_subscriptions;
CREATE POLICY company_subscriptions_admin_read ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING(deleted_at IS NULL AND mgl_private.company_role(company_id)='admin');

DROP POLICY IF EXISTS subscription_payments_admin_read ON public.subscription_payments;
CREATE POLICY subscription_payments_admin_read ON public.subscription_payments
  FOR SELECT TO authenticated
  USING(deleted_at IS NULL AND mgl_private.company_role(company_id)='admin');

-- billing_events intentionally has no authenticated policies: it is a server-only audit inbox.

INSERT INTO public.subscription_plans(code,name,billing_interval,price_cents,currency,max_projects,max_users,features)
VALUES
  ('basic','Básico','month',4900,'PEN',3,5,'["projects","tasks","documents","sst"]'::jsonb),
  ('basic','Básico','year',49000,'PEN',3,5,'["projects","tasks","documents","sst"]'::jsonb),
  ('pro','Pro','month',9900,'PEN',10,20,'["projects","tasks","documents","sst","inventory","planning","control","purchases","finance","reports"]'::jsonb),
  ('pro','Pro','year',99000,'PEN',10,20,'["projects","tasks","documents","sst","inventory","planning","control","purchases","finance","reports"]'::jsonb),
  ('empresa','Empresa','month',19900,'PEN',NULL,50,'["projects","tasks","documents","sst","inventory","planning","control","purchases","finance","reports","drive","sunat"]'::jsonb),
  ('empresa','Empresa','year',199000,'PEN',NULL,50,'["projects","tasks","documents","sst","inventory","planning","control","purchases","finance","reports","drive","sunat"]'::jsonb)
ON CONFLICT(code,billing_interval) DO UPDATE SET
  name=EXCLUDED.name,
  price_cents=EXCLUDED.price_cents,
  currency=EXCLUDED.currency,
  max_projects=EXCLUDED.max_projects,
  max_users=EXCLUDED.max_users,
  features=EXCLUDED.features,
  active=true,
  deleted_at=NULL,
  updated_at=clock_timestamp();

COMMIT;
