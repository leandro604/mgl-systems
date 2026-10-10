-- MGL Systems — Tarea 6
-- RPC local-first dedicada para tareas con etapa obligatoria y partida opcional.
-- Mantiene SECURITY INVOKER para que RLS y validate_task() sigan siendo la autoridad.

CREATE OR REPLACE FUNCTION public.sync_task_mutation(
  p_mutation_id uuid,
  p_entity_id uuid,
  p_project_id uuid,
  p_operation text,
  p_updated_at timestamptz,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
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

  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported synchronization operation';
  END IF;

  SELECT pg_catalog.array_agg(k ORDER BY k)
  INTO v_unknown_keys
  FROM pg_catalog.jsonb_object_keys(p_payload) AS k
  WHERE k NOT IN (
    'title','description','status','priority','assignee_id','starts_on','due_on',
    'progress','position','wbs_code','task_type','parent_task_id','planned_weight',
    'stage_id','budget_item_id'
  );

  IF v_unknown_keys IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported task payload fields: ' || pg_catalog.array_to_string(v_unknown_keys, ',');
  END IF;

  IF p_operation='create' AND NULLIF(p_payload->>'stage_id','') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: stage_id is required when creating a task';
  END IF;

  SELECT p.company_id, p.deleted_at
  INTO v_company_id, v_project_deleted
  FROM public.projects p
  WHERE p.id=p_project_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: project access required';
  END IF;

  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'entity','tasks',
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
    pg_catalog.hashtextextended(v_actor::text || ':' || p_mutation_id::text, 0)
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
    CASE p_operation
      WHEN 'create' THEN
        INSERT INTO public.tasks(
          id,company_id,project_id,title,description,status,priority,assignee_id,
          created_by,starts_on,due_on,progress,position,wbs_code,task_type,
          parent_task_id,planned_weight,stage_id,budget_item_id,updated_at,mutation_id
        ) VALUES (
          p_entity_id,v_company_id,p_project_id,
          p_payload->>'title',
          COALESCE(p_payload->>'description',''),
          COALESCE((p_payload->>'status')::public.task_status,'todo'::public.task_status),
          COALESCE((p_payload->>'priority')::smallint,2),
          NULLIF(p_payload->>'assignee_id','')::uuid,
          v_actor,
          NULLIF(p_payload->>'starts_on','')::date,
          NULLIF(p_payload->>'due_on','')::date,
          COALESCE((p_payload->>'progress')::smallint,0),
          COALESCE((p_payload->>'position')::numeric,0),
          COALESCE(p_payload->>'wbs_code',''),
          COALESCE(NULLIF(p_payload->>'task_type',''),'activity'),
          NULLIF(p_payload->>'parent_task_id','')::uuid,
          COALESCE((p_payload->>'planned_weight')::numeric,1),
          (p_payload->>'stage_id')::uuid,
          NULLIF(p_payload->>'budget_item_id','')::uuid,
          p_updated_at,p_mutation_id
        ) RETURNING pg_catalog.to_jsonb(tasks.*) INTO v_row;

      WHEN 'update' THEN
        UPDATE public.tasks t SET
          title=CASE WHEN p_payload ? 'title' THEN p_payload->>'title' ELSE t.title END,
          description=CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE t.description END,
          status=CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::public.task_status ELSE t.status END,
          priority=CASE WHEN p_payload ? 'priority' THEN (p_payload->>'priority')::smallint ELSE t.priority END,
          assignee_id=CASE WHEN p_payload ? 'assignee_id' THEN NULLIF(p_payload->>'assignee_id','')::uuid ELSE t.assignee_id END,
          starts_on=CASE WHEN p_payload ? 'starts_on' THEN NULLIF(p_payload->>'starts_on','')::date ELSE t.starts_on END,
          due_on=CASE WHEN p_payload ? 'due_on' THEN NULLIF(p_payload->>'due_on','')::date ELSE t.due_on END,
          progress=CASE WHEN p_payload ? 'progress' THEN (p_payload->>'progress')::smallint ELSE t.progress END,
          position=CASE WHEN p_payload ? 'position' THEN (p_payload->>'position')::numeric ELSE t.position END,
          wbs_code=CASE WHEN p_payload ? 'wbs_code' THEN COALESCE(p_payload->>'wbs_code','') ELSE t.wbs_code END,
          task_type=CASE WHEN p_payload ? 'task_type' THEN p_payload->>'task_type' ELSE t.task_type END,
          parent_task_id=CASE WHEN p_payload ? 'parent_task_id' THEN NULLIF(p_payload->>'parent_task_id','')::uuid ELSE t.parent_task_id END,
          planned_weight=CASE WHEN p_payload ? 'planned_weight' THEN (p_payload->>'planned_weight')::numeric ELSE t.planned_weight END,
          stage_id=CASE WHEN p_payload ? 'stage_id' THEN (p_payload->>'stage_id')::uuid ELSE t.stage_id END,
          budget_item_id=CASE WHEN p_payload ? 'budget_item_id' THEN NULLIF(p_payload->>'budget_item_id','')::uuid ELSE t.budget_item_id END,
          updated_at=p_updated_at,
          mutation_id=p_mutation_id
        WHERE t.id=p_entity_id
          AND t.company_id=v_company_id
          AND t.project_id=p_project_id
        RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;

      WHEN 'soft_delete' THEN
        UPDATE public.tasks t SET
          deleted_at=p_updated_at,
          updated_at=p_updated_at,
          mutation_id=p_mutation_id
        WHERE t.id=p_entity_id
          AND t.company_id=v_company_id
          AND t.project_id=p_project_id
        RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;

      WHEN 'restore' THEN
        UPDATE public.tasks t SET
          deleted_at=NULL,
          updated_at=p_updated_at,
          mutation_id=p_mutation_id
        WHERE t.id=p_entity_id
          AND t.company_id=v_company_id
          AND t.project_id=p_project_id
        RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;
    END CASE;

    IF v_row IS NULL THEN
      v_result := 'rejected';
      v_error_code := 'not_found_or_forbidden';
      v_error_message := 'The target task was not visible or writable.';
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
      GET STACKED DIAGNOSTICS v_error_code=RETURNED_SQLSTATE, v_error_message=MESSAGE_TEXT;
    WHEN SQLSTATE '22007' THEN
      v_result := 'rejected';
      GET STACKED DIAGNOSTICS v_error_code=RETURNED_SQLSTATE, v_error_message=MESSAGE_TEXT;
  END;

  IF v_row IS NULL AND v_result IN ('conflict','rejected') THEN
    SELECT pg_catalog.to_jsonb(t.*)
    INTO v_row
    FROM public.tasks t
    WHERE t.id=p_entity_id
      AND t.company_id=v_company_id
      AND t.project_id=p_project_id;
  END IF;

  v_response := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'result',v_result,
    'mutation_id',p_mutation_id,
    'entity','tasks',
    'entity_id',p_entity_id,
    'row',v_row,
    'code',v_error_code,
    'message',v_error_message
  ));

  PERFORM mgl_private.write_sync_receipt(
    v_company_id,p_project_id,p_mutation_id,'tasks',p_entity_id,p_operation,
    v_hash,v_result,v_response
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_task_mutation(uuid,uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_task_mutation(uuid,uuid,uuid,text,timestamptz,jsonb) TO authenticated;
