-- MGL Systems — Fase 3
-- Aprovisionamiento inicial de compañía/perfil para un usuario autenticado.
-- La función privilegiada vive fuera del esquema expuesto; el wrapper público es invoker.

CREATE OR REPLACE FUNCTION mgl_private.bootstrap_company(
  p_legal_name text,
  p_ruc text,
  p_full_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_profile_id uuid;
  v_role public.app_role;
  v_legal_name text := pg_catalog.btrim(p_legal_name);
  v_ruc text := pg_catalog.btrim(p_ruc);
  v_full_name text := pg_catalog.btrim(p_full_name);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mgl-bootstrap-company:' || v_actor::text, 0)
  );

  SELECT p.company_id, p.id, p.role
    INTO v_company_id, v_profile_id, v_role
  FROM public.profiles p
  JOIN public.companies c ON c.id = p.company_id
  WHERE p.user_id = v_actor
    AND p.deleted_at IS NULL
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'company_id', v_company_id,
      'profile_id', v_profile_id,
      'role', v_role,
      'already_provisioned', true
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_actor) THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='MGL: account was previously provisioned; contact an administrator';
  END IF;

  IF v_legal_name IS NULL OR pg_catalog.length(v_legal_name) NOT BETWEEN 2 AND 200 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid legal name';
  END IF;
  IF v_ruc IS NULL OR v_ruc !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: RUC must contain exactly 11 digits';
  END IF;
  IF v_full_name IS NULL OR pg_catalog.length(v_full_name) NOT BETWEEN 2 AND 150 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid full name';
  END IF;

  BEGIN
    INSERT INTO public.companies(legal_name, ruc)
    VALUES(v_legal_name, v_ruc)
    RETURNING id INTO v_company_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='MGL: this RUC is already provisioned';
  END;

  INSERT INTO public.profiles(company_id, user_id, full_name, role)
  VALUES(v_company_id, v_actor, v_full_name, 'admin'::public.app_role)
  RETURNING id INTO v_profile_id;

  RETURN pg_catalog.jsonb_build_object(
    'company_id', v_company_id,
    'profile_id', v_profile_id,
    'role', 'admin',
    'already_provisioned', false
  );
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.bootstrap_company(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.bootstrap_company(text,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_company(
  p_legal_name text,
  p_ruc text,
  p_full_name text
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT mgl_private.bootstrap_company(p_legal_name, p_ruc, p_full_name);
$$;

REVOKE ALL ON FUNCTION public.bootstrap_company(text,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_company(text,text,text)
  TO authenticated;
