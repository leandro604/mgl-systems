CREATE OR REPLACE FUNCTION mgl_private.valid_peruvian_ruc(p_ruc text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO ''
AS $$
DECLARE
  v_sum integer := 0;
  v_check integer;
  v_weights integer[] := ARRAY[5,4,3,2,7,6,5,4,3,2];
  i integer;
BEGIN
  IF p_ruc !~ '^[0-9]{11}$' THEN RETURN false; END IF;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(p_ruc from i for 1)::integer * v_weights[i];
  END LOOP;
  v_check := 11 - (v_sum % 11);
  IF v_check = 10 THEN v_check := 0; END IF;
  IF v_check = 11 THEN v_check := 1; END IF;
  RETURN v_check = substring(p_ruc from 11 for 1)::integer;
END;
$$;
REVOKE ALL ON FUNCTION mgl_private.valid_peruvian_ruc(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION mgl_private.sunat_direct_readiness(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_company public.companies;
  v_settings public.company_fiscal_settings;
  v_role public.app_role;
  v_ruc_ok boolean := false;
  v_fiscal_identity_ok boolean := false;
  v_certificate_ok boolean := false;
  v_sol_ok boolean := false;
  v_ready_beta boolean := false;
  v_ready_production boolean := false;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  v_role := mgl_private.company_role(p_company_id);
  IF v_role IS DISTINCT FROM 'admin'::public.app_role THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: admin role required';
  END IF;
  SELECT * INTO v_company FROM public.companies WHERE id=p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MGL: company not found'; END IF;
  SELECT * INTO v_settings FROM public.company_fiscal_settings WHERE company_id=p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('company_id',p_company_id,'provider',null,'environment',null,
      'valid_ruc',false,'fiscal_identity_complete',false,'certificate_configured',false,
      'sol_configured',false,'ready_beta',false,'ready_production',false,
      'missing',jsonb_build_array('company_fiscal_settings'));
  END IF;
  v_ruc_ok := mgl_private.valid_peruvian_ruc(v_company.ruc);
  v_fiscal_identity_ok :=
    length(trim(coalesce(v_settings.issuer_address,''))) > 0
    AND v_settings.ubigeo ~ '^[0-9]{6}$'
    AND length(trim(coalesce(v_settings.department,''))) > 0
    AND length(trim(coalesce(v_settings.province,''))) > 0
    AND length(trim(coalesce(v_settings.district,''))) > 0
    AND v_settings.establishment_code ~ '^[0-9A-Z]{4}$';
  v_certificate_ok :=
    v_settings.certificate_pfx_enc IS NOT NULL AND length(v_settings.certificate_pfx_enc) > 0
    AND v_settings.certificate_password_enc IS NOT NULL AND length(v_settings.certificate_password_enc) > 0;
  v_sol_ok :=
    v_settings.sol_user_enc IS NOT NULL AND length(v_settings.sol_user_enc) > 0
    AND v_settings.sol_password_enc IS NOT NULL AND length(v_settings.sol_password_enc) > 0;
  IF v_settings.provider <> 'sunat_direct' THEN v_missing := array_append(v_missing,'provider:sunat_direct'); END IF;
  IF NOT v_ruc_ok THEN v_missing := array_append(v_missing,'valid_ruc'); END IF;
  IF length(trim(coalesce(v_settings.issuer_address,''))) = 0 THEN v_missing := array_append(v_missing,'issuer_address'); END IF;
  IF v_settings.ubigeo !~ '^[0-9]{6}$' THEN v_missing := array_append(v_missing,'ubigeo'); END IF;
  IF length(trim(coalesce(v_settings.department,''))) = 0 THEN v_missing := array_append(v_missing,'department'); END IF;
  IF length(trim(coalesce(v_settings.province,''))) = 0 THEN v_missing := array_append(v_missing,'province'); END IF;
  IF length(trim(coalesce(v_settings.district,''))) = 0 THEN v_missing := array_append(v_missing,'district'); END IF;
  IF NOT v_certificate_ok THEN v_missing := array_append(v_missing,'certificate_pfx'); END IF;
  IF v_settings.environment='production' AND NOT v_sol_ok THEN v_missing := array_append(v_missing,'sol_credentials'); END IF;
  v_ready_beta := v_settings.provider='sunat_direct' AND v_ruc_ok AND v_fiscal_identity_ok AND v_certificate_ok;
  v_ready_production := v_ready_beta AND v_sol_ok;
  RETURN jsonb_build_object('company_id',p_company_id,'provider',v_settings.provider,
    'environment',v_settings.environment,'valid_ruc',v_ruc_ok,
    'fiscal_identity_complete',v_fiscal_identity_ok,'certificate_configured',v_certificate_ok,
    'sol_configured',v_sol_ok,'ready_beta',v_ready_beta,'ready_production',v_ready_production,
    'certificate_name',v_settings.certificate_name,'certificate_uploaded_at',v_settings.certificate_uploaded_at,
    'missing',to_jsonb(v_missing));
END;
$$;
REVOKE ALL ON FUNCTION mgl_private.sunat_direct_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mgl_private.sunat_direct_readiness(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sunat_direct_readiness(p_company_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT mgl_private.sunat_direct_readiness(p_company_id);
$$;
REVOKE ALL ON FUNCTION public.sunat_direct_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sunat_direct_readiness(uuid) TO authenticated;

