-- MGL Systems · Tarea 9.1
-- Workspace invitations + safe tenant transfer for accidentally bootstrapped accounts.

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'field_worker',
  project_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid NOT NULL,
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '7 days'),
  CONSTRAINT workspace_invitations_inviter_fk
    FOREIGN KEY (company_id, invited_by)
    REFERENCES public.profiles(company_id, user_id),
  CONSTRAINT workspace_invitations_email_check
    CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_company_id_id_key
  ON public.workspace_invitations(company_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_pending_email_key
  ON public.workspace_invitations(company_id, lower(email))
  WHERE deleted_at IS NULL AND status='pending';
CREATE INDEX IF NOT EXISTS workspace_invitations_company_status_idx
  ON public.workspace_invitations(company_id,status,created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workspace_invitations_email_status_idx
  ON public.workspace_invitations(lower(email),status,expires_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.workspace_invitations TO authenticated;

DROP POLICY IF EXISTS workspace_invitations_admin_read ON public.workspace_invitations;
CREATE POLICY workspace_invitations_admin_read
ON public.workspace_invitations FOR SELECT TO authenticated
USING (mgl_private.company_role(company_id)='admin'::public.app_role);

-- The original onboarding model allowed one historical profile row per auth user forever.
-- Invitations need to preserve an old, soft-deleted tenant identity while activating a new one.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_active_user_id_key
  ON public.profiles(user_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION mgl_private.normalized_auth_email(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
  SELECT lower(btrim(u.email))
  FROM auth.users u
  WHERE u.id=p_user_id AND u.email_confirmed_at IS NOT NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION mgl_private.normalized_auth_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.normalized_auth_email(uuid) TO service_role;

CREATE OR REPLACE FUNCTION mgl_private.can_switch_workspace(p_user_id uuid, p_target_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_company_id uuid;
  v_project_count integer;
  v_profile_count integer;
BEGIN
  SELECT p.company_id INTO v_company_id
  FROM public.profiles p
  WHERE p.user_id=p_user_id AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_company_id IS NULL OR v_company_id=p_target_company_id THEN
    RETURN true;
  END IF;

  SELECT count(*)::integer INTO v_project_count
  FROM public.projects pr
  WHERE pr.company_id=v_company_id AND pr.deleted_at IS NULL;

  SELECT count(*)::integer INTO v_profile_count
  FROM public.profiles p
  WHERE p.company_id=v_company_id AND p.deleted_at IS NULL;

  RETURN v_project_count=0 AND v_profile_count=1;
END;
$$;
REVOKE ALL ON FUNCTION mgl_private.can_switch_workspace(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.can_switch_workspace(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_workspace_invitation(
  p_email text,
  p_role public.app_role,
  p_project_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_company_id uuid;
  v_actor_role public.app_role;
  v_email text:=lower(btrim(p_email));
  v_project_ids uuid[]:=coalesce(p_project_ids,'{}'::uuid[]);
  v_invite public.workspace_invitations;
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;

  SELECT p.company_id,p.role INTO v_company_id,v_actor_role
  FROM public.profiles p
  WHERE p.user_id=v_actor AND p.deleted_at IS NULL
  LIMIT 1;

  IF v_company_id IS NULL OR v_actor_role<>'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: only company admins can invite users';
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid invitation email';
  END IF;

  IF v_email=mgl_private.normalized_auth_email(v_actor) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: you cannot invite your own account';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id=u.id
    WHERE lower(btrim(u.email))=v_email
      AND p.company_id=v_company_id
      AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='MGL: this user is already an active company member';
  END IF;

  IF cardinality(v_project_ids)>0 THEN
    SELECT count(DISTINCT pr.id)::integer INTO v_count
    FROM public.projects pr
    WHERE pr.company_id=v_company_id
      AND pr.id=ANY(v_project_ids)
      AND pr.deleted_at IS NULL;
    IF v_count<>cardinality(ARRAY(SELECT DISTINCT unnest(v_project_ids))) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: one or more invitation projects are invalid';
    END IF;
  END IF;

  UPDATE public.workspace_invitations wi
  SET status='revoked',
      updated_at=clock_timestamp(),
      server_updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid(),
      version=wi.version+1
  WHERE wi.company_id=v_company_id
    AND lower(wi.email)=v_email
    AND wi.status='pending'
    AND wi.deleted_at IS NULL;

  INSERT INTO public.workspace_invitations(company_id,email,role,project_ids,invited_by)
  VALUES(v_company_id,v_email,p_role,ARRAY(SELECT DISTINCT unnest(v_project_ids)),v_actor)
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'id',v_invite.id,
    'email',v_invite.email,
    'role',v_invite.role,
    'project_ids',v_invite.project_ids,
    'status',v_invite.status,
    'expires_at',v_invite.expires_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_workspace_invitation(text,public.app_role,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(text,public.app_role,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_workspace_invitations()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_company_id uuid;
  v_role public.app_role;
  v_result jsonb;
BEGIN
  SELECT p.company_id,p.role INTO v_company_id,v_role
  FROM public.profiles p
  WHERE p.user_id=v_actor AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_company_id IS NULL OR v_role<>'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: only company admins can list invitations';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',wi.id,
    'email',wi.email,
    'role',wi.role,
    'project_ids',wi.project_ids,
    'project_names',coalesce((
      SELECT jsonb_agg(pr.name ORDER BY pr.name)
      FROM public.projects pr
      WHERE pr.company_id=wi.company_id AND pr.id=ANY(wi.project_ids) AND pr.deleted_at IS NULL
    ),'[]'::jsonb),
    'status',CASE WHEN wi.status='pending' AND wi.expires_at<=clock_timestamp() THEN 'expired' ELSE wi.status END,
    'created_at',wi.created_at,
    'expires_at',wi.expires_at,
    'accepted_at',wi.accepted_at
  ) ORDER BY wi.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM public.workspace_invitations wi
  WHERE wi.company_id=v_company_id AND wi.deleted_at IS NULL;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.list_workspace_invitations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_workspace_invitation(p_invitation_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_email text;
  v_invite public.workspace_invitations;
  v_company public.companies;
  v_projects jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN NULL; END IF;
  v_email:=mgl_private.normalized_auth_email(v_actor);
  IF v_email IS NULL THEN RETURN NULL; END IF;

  SELECT wi.* INTO v_invite
  FROM public.workspace_invitations wi
  WHERE lower(wi.email)=v_email
    AND wi.deleted_at IS NULL
    AND wi.status='pending'
    AND wi.expires_at>clock_timestamp()
    AND (p_invitation_id IS NULL OR wi.id=p_invitation_id)
  ORDER BY wi.created_at DESC
  LIMIT 1;

  IF v_invite.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_company FROM public.companies c
  WHERE c.id=v_invite.company_id AND c.deleted_at IS NULL;
  IF v_company.id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'code',pr.code,'name',pr.name) ORDER BY pr.name),'[]'::jsonb)
  INTO v_projects
  FROM public.projects pr
  WHERE pr.company_id=v_invite.company_id
    AND pr.id=ANY(v_invite.project_ids)
    AND pr.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'id',v_invite.id,
    'company_id',v_invite.company_id,
    'company_name',v_company.legal_name,
    'email',v_invite.email,
    'role',v_invite.role,
    'projects',v_projects,
    'expires_at',v_invite.expires_at,
    'can_transfer',mgl_private.can_switch_workspace(v_actor,v_invite.company_id)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_workspace_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(
  p_invitation_id uuid,
  p_full_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_email text;
  v_invite public.workspace_invitations;
  v_current public.profiles;
  v_target public.profiles;
  v_old_company_id uuid;
  v_full_name text:=nullif(btrim(p_full_name),'');
  v_project_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  v_email:=mgl_private.normalized_auth_email(v_actor);

  PERFORM pg_advisory_xact_lock(hashtextextended('mgl-accept-invite:'||v_actor::text,0));

  SELECT wi.* INTO v_invite
  FROM public.workspace_invitations wi
  WHERE wi.id=p_invitation_id AND wi.deleted_at IS NULL
  FOR UPDATE;

  IF v_invite.id IS NULL OR v_invite.status<>'pending' THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MGL: invitation unavailable';
  END IF;
  IF v_invite.expires_at<=clock_timestamp() THEN
    UPDATE public.workspace_invitations SET status='expired',updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=version+1 WHERE id=v_invite.id;
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invitation expired';
  END IF;
  IF lower(v_invite.email)<>v_email THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: invitation belongs to another email';
  END IF;

  SELECT p.* INTO v_current
  FROM public.profiles p
  WHERE p.user_id=v_actor AND p.deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_current.id IS NOT NULL AND v_current.company_id<>v_invite.company_id THEN
    IF NOT mgl_private.can_switch_workspace(v_actor,v_invite.company_id) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: account already belongs to another workspace with active data';
    END IF;
    v_old_company_id:=v_current.company_id;
    IF v_full_name IS NULL THEN v_full_name:=v_current.full_name; END IF;

    UPDATE public.profiles
    SET deleted_at=clock_timestamp(),updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=version+1
    WHERE id=v_current.id;

    UPDATE public.companies c
    SET deleted_at=clock_timestamp(),updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
    WHERE c.id=v_old_company_id
      AND NOT EXISTS(SELECT 1 FROM public.projects pr WHERE pr.company_id=c.id AND pr.deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.company_id=c.id AND p.deleted_at IS NULL);
  ELSIF v_current.id IS NOT NULL THEN
    IF v_full_name IS NULL THEN v_full_name:=v_current.full_name; END IF;
  END IF;

  IF v_full_name IS NULL THEN
    v_full_name:=split_part(v_email,'@',1);
  END IF;
  IF length(v_full_name) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: full name is required';
  END IF;

  SELECT p.* INTO v_target
  FROM public.profiles p
  WHERE p.company_id=v_invite.company_id AND p.user_id=v_actor
  LIMIT 1
  FOR UPDATE;

  IF v_target.id IS NULL THEN
    INSERT INTO public.profiles(company_id,user_id,full_name,role)
    VALUES(v_invite.company_id,v_actor,v_full_name,v_invite.role)
    RETURNING * INTO v_target;
  ELSE
    UPDATE public.profiles p
    SET full_name=v_full_name,
        role=v_invite.role,
        deleted_at=NULL,
        updated_at=clock_timestamp(),
        server_updated_at=clock_timestamp(),
        mutation_id=gen_random_uuid(),
        version=p.version+1
    WHERE p.id=v_target.id
    RETURNING * INTO v_target;
  END IF;

  INSERT INTO public.user_preferences(company_id,user_id)
  VALUES(v_invite.company_id,v_actor)
  ON CONFLICT(company_id,user_id) DO UPDATE SET
    deleted_at=NULL,
    updated_at=clock_timestamp(),
    server_updated_at=clock_timestamp(),
    mutation_id=gen_random_uuid(),
    version=user_preferences.version+1;

  FOREACH v_project_id IN ARRAY v_invite.project_ids LOOP
    INSERT INTO public.project_members(company_id,project_id,user_id)
    VALUES(v_invite.company_id,v_project_id,v_actor)
    ON CONFLICT(company_id,project_id,user_id) DO UPDATE SET
      deleted_at=NULL,
      updated_at=clock_timestamp(),
      server_updated_at=clock_timestamp(),
      mutation_id=gen_random_uuid();
  END LOOP;

  UPDATE public.workspace_invitations wi
  SET status='accepted',accepted_by=v_actor,accepted_at=clock_timestamp(),updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=wi.version+1
  WHERE wi.id=v_invite.id;

  UPDATE public.workspace_invitations wi
  SET status='revoked',updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=wi.version+1
  WHERE lower(wi.email)=v_email
    AND wi.id<>v_invite.id
    AND wi.status='pending'
    AND wi.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'company_id',v_invite.company_id,
    'profile_id',v_target.id,
    'role',v_target.role,
    'project_ids',v_invite.project_ids,
    'transferred_from_company_id',v_old_company_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_invite public.workspace_invitations;
BEGIN
  SELECT wi.* INTO v_invite
  FROM public.workspace_invitations wi
  WHERE wi.id=p_invitation_id AND wi.deleted_at IS NULL
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MGL: invitation unavailable';
  END IF;
  IF mgl_private.company_role(v_invite.company_id)<>'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: only company admins can revoke invitations';
  END IF;

  UPDATE public.workspace_invitations wi
  SET status='revoked',updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=wi.version+1
  WHERE wi.id=v_invite.id AND wi.status='pending'
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object('id',p_invitation_id,'status',coalesce(v_invite.status,'revoked'));
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_workspace_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_workspace_member_role(
  p_user_id uuid,
  p_role public.app_role
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_company_id uuid;
  v_actor_role public.app_role;
  v_target public.profiles;
  v_admin_count integer;
BEGIN
  SELECT p.company_id,p.role INTO v_company_id,v_actor_role
  FROM public.profiles p
  WHERE p.user_id=v_actor AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_company_id IS NULL OR v_actor_role<>'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: only company admins can change roles';
  END IF;

  SELECT p.* INTO v_target FROM public.profiles p
  WHERE p.company_id=v_company_id AND p.user_id=p_user_id AND p.deleted_at IS NULL
  LIMIT 1 FOR UPDATE;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MGL: member unavailable';
  END IF;

  IF v_target.role='admin'::public.app_role AND p_role<>'admin'::public.app_role THEN
    SELECT count(*)::integer INTO v_admin_count
    FROM public.profiles p
    WHERE p.company_id=v_company_id AND p.role='admin'::public.app_role AND p.deleted_at IS NULL;
    IF v_admin_count<=1 THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: company must keep at least one admin';
    END IF;
  END IF;

  UPDATE public.profiles p
  SET role=p_role,updated_at=clock_timestamp(),server_updated_at=clock_timestamp(),mutation_id=gen_random_uuid(),version=p.version+1
  WHERE p.id=v_target.id
  RETURNING * INTO v_target;

  RETURN jsonb_build_object('user_id',v_target.user_id,'role',v_target.role);
END;
$$;
REVOKE ALL ON FUNCTION public.update_workspace_member_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid,public.app_role) TO authenticated;
