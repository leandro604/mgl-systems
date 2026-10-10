-- MGL Systems · Actualización arquitectónica crítica · Tarea 6/7
-- Preferencias por usuario. In-app siempre permanece habilitado como fuente de verdad.

CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true CHECK(in_app_enabled),
  email_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_start time,
  quiet_end time,
  timezone text NOT NULL DEFAULT 'America/Lima',
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  compact_mode boolean NOT NULL DEFAULT false,
  UNIQUE(company_id,id),
  UNIQUE(company_id,user_id),
  FOREIGN KEY(company_id,user_id) REFERENCES public.profiles(company_id,user_id),
  CHECK((NOT quiet_hours_enabled) OR (quiet_start IS NOT NULL AND quiet_end IS NOT NULL))
);

INSERT INTO public.user_preferences(company_id,user_id)
SELECT p.company_id,p.user_id
FROM public.profiles p
WHERE p.deleted_at IS NULL;
