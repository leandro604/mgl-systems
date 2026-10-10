-- MGL Systems · Tarea 12 · directorio gerencial de miembros con email de Auth.
CREATE OR REPLACE FUNCTION mgl_private.list_workspace_members()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company_id uuid; v_role public.app_role; v_result jsonb;
BEGIN
  SELECT p.company_id,p.role INTO v_company_id,v_role
  FROM public.profiles p WHERE p.user_id=auth.uid() AND p.deleted_at IS NULL LIMIT 1;
  IF v_company_id IS NULL OR v_role NOT IN ('admin','pm','supervisor') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: manager workspace access required';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id',p.user_id,'full_name',p.full_name,'role',p.role,'email',u.email,
    'phone',p.phone,'dni',p.dni,'position',p.position,'status','active'
  ) ORDER BY p.full_name),'[]'::jsonb)
  INTO v_result
  FROM public.profiles p JOIN auth.users u ON u.id=p.user_id
  WHERE p.company_id=v_company_id AND p.deleted_at IS NULL;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION mgl_private.list_workspace_members() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.list_workspace_members() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.list_workspace_members() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.list_workspace_members(); $$;
REVOKE ALL ON FUNCTION public.list_workspace_members() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_members() TO authenticated;
