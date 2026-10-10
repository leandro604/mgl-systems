-- MGL Systems · Tarea 5
-- Sincronización local-first de costos reales por partida.
-- Mantiene la RPC general de Fase 2 intacta y expone una RPC acotada,
-- security-invoker, para qty_actual / unit_price_actual.

CREATE OR REPLACE FUNCTION mgl_private.write_sync_receipt(
  p_company_id uuid,
  p_project_id uuid,
  p_mutation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_operation text,
  p_payload_hash text,
  p_result text,
  p_response jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF p_result NOT IN ('applied','conflict','rejected') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: invalid synchronization result';
  END IF;
  IF p_entity_type NOT IN ('tasks','task_dependencies','documents','sst_records','budget_items') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported synchronization entity';
  END IF;
  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported synchronization operation';
  END IF;
  IF NOT mgl_private.project_access(p_company_id,p_project_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: project access required';
  END IF;

  INSERT INTO public.sync_logs(
    company_id,project_id,actor_id,entity_type,entity_id,operation,
    payload_hash,result,response,mutation_id
  ) VALUES (
    p_company_id,p_project_id,v_actor,p_entity_type,p_entity_id,p_operation,
    p_payload_hash,p_result,p_response,p_mutation_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_budget_item_actual(
  p_mutation_id uuid,
  p_entity_id uuid,
  p_project_id uuid,
  p_operation text,
  p_updated_at timestamptz,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_project_deleted timestamptz;
  v_hash text;
  v_existing public.sync_logs;
  v_row jsonb;
  v_response jsonb;
  v_result text;
  v_error_code text;
  v_error_message text;
  v_unknown_keys text[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF p_mutation_id IS NULL OR p_entity_id IS NULL OR p_project_id IS NULL OR p_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22004', MESSAGE='MGL: synchronization identifiers and timestamp are required';
  END IF;
  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: payload must be a JSON object';
  END IF;
  IF p_operation <> 'update' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: budget item offline sync supports update only';
  END IF;
  IF NOT (p_payload ? 'qty_actual' OR p_payload ? 'unit_price_actual') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: qty_actual or unit_price_actual is required';
  END IF;

  SELECT pg_catalog.array_agg(k ORDER BY k) INTO v_unknown_keys
  FROM pg_catalog.jsonb_object_keys(p_payload) AS k
  WHERE k NOT IN ('qty_actual','unit_price_actual');
  IF v_unknown_keys IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported budget item payload fields: ' || pg_catalog.array_to_string(v_unknown_keys,',');
  END IF;

  SELECT p.company_id,p.deleted_at INTO v_company_id,v_project_deleted
  FROM public.projects p
  WHERE p.id=p_project_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: project access required';
  END IF;

  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'entity','budget_items',
          'entity_id',p_entity_id,
          'project_id',p_project_id,
          'operation',p_operation,
          'updated_at',p_updated_at,
          'payload',p_payload
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text,0)
  );

  SELECT * INTO v_existing
  FROM public.sync_logs s
  WHERE s.company_id=v_company_id
    AND s.actor_id=v_actor
    AND s.mutation_id=p_mutation_id;

  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'result','rejected',
        'code','idempotency_mismatch',
        'message','The same mutation_id was already used with a different canonical payload.',
        'mutation_id',p_mutation_id
      );
    END IF;
    RETURN v_existing.response;
  END IF;

  IF v_project_deleted IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: active project access required';
  END IF;

  BEGIN
    UPDATE public.budget_items b SET
      qty_actual=CASE WHEN p_payload ? 'qty_actual' THEN (p_payload->>'qty_actual')::numeric ELSE b.qty_actual END,
      unit_price_actual=CASE WHEN p_payload ? 'unit_price_actual' THEN (p_payload->>'unit_price_actual')::numeric ELSE b.unit_price_actual END,
      updated_at=p_updated_at,
      mutation_id=p_mutation_id
    WHERE b.id=p_entity_id
      AND b.company_id=v_company_id
      AND b.project_id=p_project_id
      AND b.deleted_at IS NULL
    RETURNING pg_catalog.to_jsonb(b.*) INTO v_row;

    IF v_row IS NULL THEN
      v_result := 'rejected';
      v_error_code := 'not_found_or_forbidden';
      v_error_message := 'The target budget item was not visible or writable.';
    ELSE
      v_result := 'applied';
    END IF;

  EXCEPTION
    WHEN SQLSTATE '40001' THEN
      v_result := 'conflict';
      v_error_code := 'lww_conflict';
      v_error_message := 'A newer canonical row already exists.';
    WHEN unique_violation THEN
      v_result := 'conflict';
      v_error_code := 'unique_conflict';
      v_error_message := 'A conflicting canonical row already exists.';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation OR
         datetime_field_overflow OR numeric_value_out_of_range OR string_data_right_truncation OR insufficient_privilege THEN
      v_result := 'rejected';
      GET STACKED DIAGNOSTICS v_error_code = RETURNED_SQLSTATE, v_error_message = MESSAGE_TEXT;
    WHEN SQLSTATE '22007' THEN
      v_result := 'rejected';
      GET STACKED DIAGNOSTICS v_error_code = RETURNED_SQLSTATE, v_error_message = MESSAGE_TEXT;
  END;

  IF v_row IS NULL AND v_result IN ('conflict','rejected') THEN
    SELECT pg_catalog.to_jsonb(b.*) INTO v_row
    FROM public.budget_items b
    WHERE b.id=p_entity_id
      AND b.company_id=v_company_id
      AND b.project_id=p_project_id;
  END IF;

  v_response := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'result',v_result,
    'mutation_id',p_mutation_id,
    'entity','budget_items',
    'entity_id',p_entity_id,
    'row',v_row,
    'code',v_error_code,
    'message',v_error_message
  ));

  PERFORM mgl_private.write_sync_receipt(
    v_company_id,p_project_id,p_mutation_id,'budget_items',p_entity_id,p_operation,
    v_hash,v_result,v_response
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_budget_item_actual(uuid,uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_budget_item_actual(uuid,uuid,uuid,text,timestamptz,jsonb) TO authenticated;

-- The public invoker function calls this private receipt writer after RLS has
-- authorized the mutation. Keep the private helper unavailable to anon/public.
REVOKE EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) TO authenticated;
