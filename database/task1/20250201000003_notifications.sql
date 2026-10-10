-- MGL Systems · Actualización arquitectónica crítica · Tarea 4/7
-- La fila notifications es la fuente de verdad in-app. deliveries audita email/push.

CREATE TYPE public.notification_channel AS ENUM ('in_app','email','push');
CREATE TYPE public.notification_delivery_status AS ENUM ('pending','scheduled','sent','skipped','failed');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid,
  recipient_id uuid NOT NULL,
  actor_id uuid,
  kind text NOT NULL CHECK(length(trim(kind)) BETWEEN 2 AND 80),
  title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 180),
  body text NOT NULL DEFAULT '',
  entity_type text,
  entity_id uuid,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(metadata)='object'),
  read_at timestamptz,
  UNIQUE(company_id,id),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,recipient_id) REFERENCES public.profiles(company_id,user_id),
  FOREIGN KEY(company_id,actor_id) REFERENCES public.profiles(company_id,user_id)
);
CREATE INDEX notifications_recipient_unread_idx
  ON public.notifications(company_id,recipient_id,created_at DESC)
  WHERE deleted_at IS NULL AND read_at IS NULL;
CREATE INDEX notifications_project_idx
  ON public.notifications(company_id,project_id,created_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;
CREATE INDEX notifications_actor_idx
  ON public.notifications(company_id,actor_id)
  WHERE deleted_at IS NULL AND actor_id IS NOT NULL;

CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  notification_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  channel public.notification_channel NOT NULL,
  status public.notification_delivery_status NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempted_at timestamptz,
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  provider_message_id text,
  last_error text,
  UNIQUE(company_id,notification_id,channel),
  FOREIGN KEY(company_id,notification_id) REFERENCES public.notifications(company_id,id),
  FOREIGN KEY(company_id,recipient_id) REFERENCES public.profiles(company_id,user_id)
);
CREATE INDEX notification_deliveries_queue_idx
  ON public.notification_deliveries(status,scheduled_for)
  WHERE deleted_at IS NULL AND status IN ('pending','scheduled');
CREATE INDEX notification_deliveries_recipient_idx
  ON public.notification_deliveries(company_id,recipient_id,created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  device_id text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(company_id,id),
  UNIQUE(company_id,user_id,endpoint),
  FOREIGN KEY(company_id,user_id) REFERENCES public.profiles(company_id,user_id)
);
CREATE INDEX push_subscriptions_user_idx
  ON public.push_subscriptions(company_id,user_id)
  WHERE deleted_at IS NULL AND enabled;
