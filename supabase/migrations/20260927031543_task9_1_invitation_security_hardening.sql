DO $$
DECLARE
  v_name text;
  v_args text;
  v_sql text;
BEGIN
  FOR v_name,v_args IN
    SELECT * FROM (VALUES
      ('create_workspace_invitation','text,public.app_role,uuid[]'),
      ('list_workspace_invitations',''),
      ('get_my_workspace_invitation','uuid'),
      ('accept_workspace_invitation','uuid,text'),
      ('revoke_workspace_invitation','uuid'),
      ('update_workspace_member_role','uuid,public.app_role')
    ) AS f(name,args)
  LOOP
    SELECT pg_get_functiondef(
      CASE
        WHEN v_args='' THEN format('public.%I()',v_name)::regprocedure
        ELSE format('public.%I(%s)',v_name,v_args)::regprocedure
      END
    ) INTO v_sql;
    v_sql := replace(v_sql,format('CREATE OR REPLACE FUNCTION public.%I',v_name),format('CREATE OR REPLACE FUNCTION mgl_private.%I',v_name));
    EXECUTE v_sql;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION mgl_private.create_workspace_invitation(text,public.app_role,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION mgl_private.list_workspace_invitations() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION mgl_private.get_my_workspace_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION mgl_private.accept_workspace_invitation(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION mgl_private.revoke_workspace_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION mgl_private.update_workspace_member_role(uuid,public.app_role) FROM PUBLIC,anon;

GRANT USAGE ON SCHEMA mgl_private TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.create_workspace_invitation(text,public.app_role,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.list_workspace_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.get_my_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.accept_workspace_invitation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.revoke_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.update_workspace_member_role(uuid,public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_workspace_invitation(p_email text,p_role public.app_role,p_project_ids uuid[] DEFAULT '{}'::uuid[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT mgl_private.create_workspace_invitation(p_email,p_role,p_project_ids);
$$;
CREATE OR REPLACE FUNCTION public.list_workspace_invitations()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.list_workspace_invitations(); $$;
CREATE OR REPLACE FUNCTION public.get_my_workspace_invitation(p_invitation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.get_my_workspace_invitation(p_invitation_id); $$;
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_invitation_id uuid,p_full_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.accept_workspace_invitation(p_invitation_id,p_full_name); $$;
CREATE OR REPLACE FUNCTION public.revoke_workspace_invitation(p_invitation_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.revoke_workspace_invitation(p_invitation_id); $$;
CREATE OR REPLACE FUNCTION public.update_workspace_member_role(p_user_id uuid,p_role public.app_role)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.update_workspace_member_role(p_user_id,p_role); $$;

REVOKE ALL ON FUNCTION public.create_workspace_invitation(text,public.app_role,uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_workspace_invitations() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_my_workspace_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.revoke_workspace_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_workspace_member_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(text,public.app_role,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_workspace_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid,public.app_role) TO authenticated;

CREATE INDEX IF NOT EXISTS workspace_invitations_accepted_by_idx ON public.workspace_invitations(accepted_by) WHERE accepted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_invitations_inviter_idx ON public.workspace_invitations(company_id,invited_by);
