-- MGL Systems — Fase 2
-- RPC transaccional de sincronización: idempotencia, LWW y recibo atómico.

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
) RETURNS void
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
  IF p_entity_type NOT IN ('tasks','task_dependencies','documents','sst_records') THEN
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

CREATE OR REPLACE FUNCTION public.sync_mutation(
  p_mutation_id uuid,
  p_entity_type text,
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
  v_allowed_keys text[];
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
  IF p_entity_type NOT IN ('tasks','task_dependencies','documents','sst_records') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported synchronization entity';
  END IF;
  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported synchronization operation';
  END IF;

  -- La lectura está sometida a RLS. Se permite localizar un proyecto eliminado para
  -- poder responder un replay ya confirmado; nuevas mutaciones exigen proyecto activo.
  SELECT p.company_id,p.deleted_at INTO v_company_id,v_project_deleted
  FROM public.projects p
  WHERE p.id=p_project_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: project access required';
  END IF;

  CASE p_entity_type
    WHEN 'tasks' THEN
      v_allowed_keys := ARRAY['title','description','status','priority','assignee_id','starts_on','due_on','progress','position'];
    WHEN 'task_dependencies' THEN
      v_allowed_keys := ARRAY['task_id','depends_on_task_id'];
    WHEN 'documents' THEN
      v_allowed_keys := ARRAY['name','provider','provider_account_id','external_file_id','web_url','mime_type','size_bytes','sha256'];
    WHEN 'sst_records' THEN
      v_allowed_keys := ARRAY['record_type','title','occurred_at','details','document_id'];
  END CASE;

  SELECT pg_catalog.array_agg(k ORDER BY k) INTO v_unknown_keys
  FROM pg_catalog.jsonb_object_keys(p_payload) AS k
  WHERE NOT (k=ANY(v_allowed_keys));
  IF v_unknown_keys IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: unsupported payload fields: ' || pg_catalog.array_to_string(v_unknown_keys,',');
  END IF;

  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'entity',p_entity_type,
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

  -- Serializa todos los reintentos de la misma mutación para este actor.
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
    CASE p_entity_type
      WHEN 'tasks' THEN
        CASE p_operation
          WHEN 'create' THEN
            INSERT INTO public.tasks(
              id,company_id,project_id,title,description,status,priority,assignee_id,
              created_by,starts_on,due_on,progress,position,updated_at,mutation_id
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
              updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE t.id=p_entity_id AND t.company_id=v_company_id AND t.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;
          WHEN 'soft_delete' THEN
            UPDATE public.tasks t SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE t.id=p_entity_id AND t.company_id=v_company_id AND t.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;
          WHEN 'restore' THEN
            UPDATE public.tasks t SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE t.id=p_entity_id AND t.company_id=v_company_id AND t.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(t.*) INTO v_row;
        END CASE;

      WHEN 'task_dependencies' THEN
        CASE p_operation
          WHEN 'create' THEN
            INSERT INTO public.task_dependencies(
              id,company_id,project_id,task_id,depends_on_task_id,updated_at,mutation_id
            ) VALUES (
              p_entity_id,v_company_id,p_project_id,
              (p_payload->>'task_id')::uuid,(p_payload->>'depends_on_task_id')::uuid,
              p_updated_at,p_mutation_id
            ) RETURNING pg_catalog.to_jsonb(task_dependencies.*) INTO v_row;
          WHEN 'update' THEN
            UPDATE public.task_dependencies d SET
              task_id=CASE WHEN p_payload ? 'task_id' THEN (p_payload->>'task_id')::uuid ELSE d.task_id END,
              depends_on_task_id=CASE WHEN p_payload ? 'depends_on_task_id' THEN (p_payload->>'depends_on_task_id')::uuid ELSE d.depends_on_task_id END,
              updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
          WHEN 'soft_delete' THEN
            UPDATE public.task_dependencies d SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
          WHEN 'restore' THEN
            UPDATE public.task_dependencies d SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
        END CASE;

      WHEN 'documents' THEN
        CASE p_operation
          WHEN 'create' THEN
            INSERT INTO public.documents(
              id,company_id,project_id,name,provider,provider_account_id,external_file_id,
              web_url,mime_type,size_bytes,sha256,uploaded_by,updated_at,mutation_id
            ) VALUES (
              p_entity_id,v_company_id,p_project_id,
              p_payload->>'name',p_payload->>'provider',p_payload->>'provider_account_id',p_payload->>'external_file_id',
              p_payload->>'web_url',p_payload->>'mime_type',(p_payload->>'size_bytes')::bigint,
              NULLIF(p_payload->>'sha256',''),v_actor,p_updated_at,p_mutation_id
            ) RETURNING pg_catalog.to_jsonb(documents.*) INTO v_row;
          WHEN 'update' THEN
            UPDATE public.documents d SET
              name=CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE d.name END,
              provider=CASE WHEN p_payload ? 'provider' THEN p_payload->>'provider' ELSE d.provider END,
              provider_account_id=CASE WHEN p_payload ? 'provider_account_id' THEN p_payload->>'provider_account_id' ELSE d.provider_account_id END,
              external_file_id=CASE WHEN p_payload ? 'external_file_id' THEN p_payload->>'external_file_id' ELSE d.external_file_id END,
              web_url=CASE WHEN p_payload ? 'web_url' THEN p_payload->>'web_url' ELSE d.web_url END,
              mime_type=CASE WHEN p_payload ? 'mime_type' THEN p_payload->>'mime_type' ELSE d.mime_type END,
              size_bytes=CASE WHEN p_payload ? 'size_bytes' THEN (p_payload->>'size_bytes')::bigint ELSE d.size_bytes END,
              sha256=CASE WHEN p_payload ? 'sha256' THEN NULLIF(p_payload->>'sha256','') ELSE d.sha256 END,
              updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
          WHEN 'soft_delete' THEN
            UPDATE public.documents d SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
          WHEN 'restore' THEN
            UPDATE public.documents d SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(d.*) INTO v_row;
        END CASE;

      WHEN 'sst_records' THEN
        CASE p_operation
          WHEN 'create' THEN
            INSERT INTO public.sst_records(
              id,company_id,project_id,record_type,title,occurred_at,details,document_id,
              recorded_by,updated_at,mutation_id
            ) VALUES (
              p_entity_id,v_company_id,p_project_id,
              p_payload->>'record_type',p_payload->>'title',(p_payload->>'occurred_at')::timestamptz,
              COALESCE(p_payload->'details','{}'::jsonb),NULLIF(p_payload->>'document_id','')::uuid,
              v_actor,p_updated_at,p_mutation_id
            ) RETURNING pg_catalog.to_jsonb(sst_records.*) INTO v_row;
          WHEN 'update' THEN
            UPDATE public.sst_records s SET
              record_type=CASE WHEN p_payload ? 'record_type' THEN p_payload->>'record_type' ELSE s.record_type END,
              title=CASE WHEN p_payload ? 'title' THEN p_payload->>'title' ELSE s.title END,
              occurred_at=CASE WHEN p_payload ? 'occurred_at' THEN (p_payload->>'occurred_at')::timestamptz ELSE s.occurred_at END,
              details=CASE WHEN p_payload ? 'details' THEN p_payload->'details' ELSE s.details END,
              document_id=CASE WHEN p_payload ? 'document_id' THEN NULLIF(p_payload->>'document_id','')::uuid ELSE s.document_id END,
              updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE s.id=p_entity_id AND s.company_id=v_company_id AND s.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(s.*) INTO v_row;
          WHEN 'soft_delete' THEN
            UPDATE public.sst_records s SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE s.id=p_entity_id AND s.company_id=v_company_id AND s.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(s.*) INTO v_row;
          WHEN 'restore' THEN
            UPDATE public.sst_records s SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
            WHERE s.id=p_entity_id AND s.company_id=v_company_id AND s.project_id=p_project_id
            RETURNING pg_catalog.to_jsonb(s.*) INTO v_row;
        END CASE;
    END CASE;

    IF v_row IS NULL THEN
      v_result := 'rejected';
      v_error_code := 'not_found_or_forbidden';
      v_error_message := 'The target row was not visible or writable.';
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

  -- En conflicto, o si el UPDATE no devolvió fila, leer la fila canónica si sigue visible.
  IF v_row IS NULL AND v_result IN ('conflict','rejected') THEN
    CASE p_entity_type
      WHEN 'tasks' THEN
        SELECT pg_catalog.to_jsonb(t.*) INTO v_row FROM public.tasks t
        WHERE t.id=p_entity_id AND t.company_id=v_company_id AND t.project_id=p_project_id;
      WHEN 'task_dependencies' THEN
        SELECT pg_catalog.to_jsonb(d.*) INTO v_row FROM public.task_dependencies d
        WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id;
      WHEN 'documents' THEN
        SELECT pg_catalog.to_jsonb(d.*) INTO v_row FROM public.documents d
        WHERE d.id=p_entity_id AND d.company_id=v_company_id AND d.project_id=p_project_id;
      WHEN 'sst_records' THEN
        SELECT pg_catalog.to_jsonb(s.*) INTO v_row FROM public.sst_records s
        WHERE s.id=p_entity_id AND s.company_id=v_company_id AND s.project_id=p_project_id;
    END CASE;
  END IF;

  v_response := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'result',v_result,
    'mutation_id',p_mutation_id,
    'entity',p_entity_type,
    'entity_id',p_entity_id,
    'row',v_row,
    'code',v_error_code,
    'message',v_error_message
  ));

  PERFORM mgl_private.write_sync_receipt(
    v_company_id,p_project_id,p_mutation_id,p_entity_type,p_entity_id,p_operation,
    v_hash,v_result,v_response
  );

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
-- El esquema mgl_private no está expuesto por Data API. EXECUTE se concede solo para que
-- la RPC SECURITY INVOKER pueda escribir el recibo dentro de la misma transacción.
GRANT EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb)
  TO authenticated;

REVOKE ALL ON FUNCTION public.sync_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb)
  TO authenticated;
