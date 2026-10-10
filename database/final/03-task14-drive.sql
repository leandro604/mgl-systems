-- MGL Systems · Tarea 14 reforzada · Google Drive / OneDrive.
-- Credenciales cifradas por usuario + vínculo proyecto/carpeta + estado de sincronización.

-- Compatibilidad con la Tarea 14 original: estas columnas pueden existir ya.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS microsoft_refresh_token_enc text;


CREATE TABLE IF NOT EXISTS public.cloud_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK(provider IN ('google','microsoft')),
  refresh_token_enc text NOT NULL,
  provider_account_id text,
  account_email text,
  account_name text,
  avatar_url text,
  connected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_token_refresh_at timestamptz,
  UNIQUE(company_id,id),
  UNIQUE(company_id,user_id,provider),
  FOREIGN KEY(company_id,user_id) REFERENCES public.profiles(company_id,user_id)
);

CREATE INDEX IF NOT EXISTS cloud_accounts_user_provider_idx
  ON public.cloud_accounts(company_id,user_id,provider)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.project_cloud_drives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  provider text NOT NULL CHECK(provider IN ('google','microsoft')),
  cloud_account_id uuid NOT NULL,
  provider_account_id text,
  root_folder_id text NOT NULL,
  root_folder_name text NOT NULL,
  root_folder_url text NOT NULL DEFAULT '',
  stage_folder_map jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(stage_folder_map)='object'),
  sync_enabled boolean NOT NULL DEFAULT false,
  sync_status text NOT NULL DEFAULT 'idle' CHECK(sync_status IN ('idle','syncing','synced','error','disconnected')),
  last_sync_at timestamptz,
  sync_error text,
  watch_channel_id text,
  watch_resource_id text,
  watch_expires_at timestamptz,
  delta_cursor text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,id),
  UNIQUE(company_id,project_id,provider),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,cloud_account_id) REFERENCES public.cloud_accounts(company_id,id) ON DELETE CASCADE,
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);

CREATE INDEX IF NOT EXISTS project_cloud_drives_project_idx
  ON public.project_cloud_drives(company_id,project_id,provider)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_cloud_drives_watch_idx
  ON public.project_cloud_drives(watch_channel_id)
  WHERE deleted_at IS NULL AND watch_channel_id IS NOT NULL;

ALTER TABLE public.cloud_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_cloud_drives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cloud_accounts FROM anon;
REVOKE ALL ON public.project_cloud_drives FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.cloud_accounts TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_cloud_drives TO authenticated,service_role;

DROP POLICY IF EXISTS cloud_accounts_read ON public.cloud_accounts;
CREATE POLICY cloud_accounts_read ON public.cloud_accounts FOR SELECT TO authenticated
USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
DROP POLICY IF EXISTS cloud_accounts_insert ON public.cloud_accounts;
CREATE POLICY cloud_accounts_insert ON public.cloud_accounts FOR INSERT TO authenticated
WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
DROP POLICY IF EXISTS cloud_accounts_update ON public.cloud_accounts;
CREATE POLICY cloud_accounts_update ON public.cloud_accounts FOR UPDATE TO authenticated
USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL)
WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
DROP POLICY IF EXISTS cloud_accounts_delete ON public.cloud_accounts;
CREATE POLICY cloud_accounts_delete ON public.cloud_accounts FOR DELETE TO authenticated
USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);

DROP POLICY IF EXISTS project_cloud_drives_read ON public.project_cloud_drives;
CREATE POLICY project_cloud_drives_read ON public.project_cloud_drives FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id));
DROP POLICY IF EXISTS project_cloud_drives_insert ON public.project_cloud_drives;
CREATE POLICY project_cloud_drives_insert ON public.project_cloud_drives FOR INSERT TO authenticated
WITH CHECK(
  created_by=(select auth.uid())
  AND mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])
  AND EXISTS(
    SELECT 1 FROM public.cloud_accounts a
    WHERE a.company_id=project_cloud_drives.company_id
      AND a.id=project_cloud_drives.cloud_account_id
      AND a.user_id=(select auth.uid())
      AND a.deleted_at IS NULL
  )
);
DROP POLICY IF EXISTS project_cloud_drives_update ON public.project_cloud_drives;
CREATE POLICY project_cloud_drives_update ON public.project_cloud_drives FOR UPDATE TO authenticated
USING(
  created_by=(select auth.uid())
  AND mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])
)
WITH CHECK(
  created_by=(select auth.uid())
  AND mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])
  AND EXISTS(
    SELECT 1 FROM public.cloud_accounts a
    WHERE a.company_id=project_cloud_drives.company_id
      AND a.id=project_cloud_drives.cloud_account_id
      AND a.user_id=(select auth.uid())
      AND a.deleted_at IS NULL
  )
);
DROP POLICY IF EXISTS project_cloud_drives_delete ON public.project_cloud_drives;
CREATE POLICY project_cloud_drives_delete ON public.project_cloud_drives FOR DELETE TO authenticated
USING(
  created_by=(select auth.uid())
  AND mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor']::public.app_role[])
);

-- Compatibilidad: importar los refresh tokens cifrados de la implementación 0.14/0.15.
INSERT INTO public.cloud_accounts(company_id,user_id,provider,refresh_token_enc,provider_account_id,account_name,connected_at)
SELECT p.company_id,p.user_id,'google',p.google_refresh_token_enc,p.user_id::text,p.full_name,clock_timestamp()
FROM public.profiles p
WHERE p.google_refresh_token_enc IS NOT NULL AND p.deleted_at IS NULL
ON CONFLICT(company_id,user_id,provider) DO NOTHING;

INSERT INTO public.cloud_accounts(company_id,user_id,provider,refresh_token_enc,provider_account_id,account_name,connected_at)
SELECT p.company_id,p.user_id,'microsoft',p.microsoft_refresh_token_enc,p.user_id::text,p.full_name,clock_timestamp()
FROM public.profiles p
WHERE p.microsoft_refresh_token_enc IS NOT NULL AND p.deleted_at IS NULL
ON CONFLICT(company_id,user_id,provider) DO NOTHING;

-- Una vez migrados, los ciphertexts heredados dejan de residir en profiles,
-- cuya lectura es más amplia dentro de la compañía.
UPDATE public.profiles
SET google_refresh_token_enc=NULL,
    microsoft_refresh_token_enc=NULL,
    updated_at=clock_timestamp(),
    mutation_id=gen_random_uuid()
WHERE google_refresh_token_enc IS NOT NULL OR microsoft_refresh_token_enc IS NOT NULL;
COMMENT ON COLUMN public.profiles.google_refresh_token_enc IS 'Deprecated after Tarea 14 reforzada; credentials live in cloud_accounts.';
COMMENT ON COLUMN public.profiles.microsoft_refresh_token_enc IS 'Deprecated after Tarea 14 reforzada; credentials live in cloud_accounts.';
