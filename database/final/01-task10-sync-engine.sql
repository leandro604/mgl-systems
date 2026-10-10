-- MGL Systems · finalización del contrato local-first de peticiones.
-- Requiere database/task1 y database/task10-12/20260929_task10_material_fields.sql.

CREATE OR REPLACE FUNCTION mgl_private.sync_material_mutation(
  p_mutation_id uuid,p_entity_type text,p_entity_id uuid,p_project_id uuid,
  p_operation text,p_updated_at timestamptz,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_company_id uuid; v_hash text; v_existing public.sync_logs;
  v_row jsonb; v_response jsonb; v_result text:='applied'; v_error_code text; v_error_message text; v_unknown text[];
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  IF p_entity_type NOT IN ('material_requests','material_request_items') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported material sync entity'; END IF;
  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported synchronization operation'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: payload must be a JSON object'; END IF;
  SELECT p.company_id INTO v_company_id FROM public.projects p WHERE p.id=p_project_id AND p.deleted_at IS NULL;
  IF v_company_id IS NULL OR NOT mgl_private.project_access(v_company_id,p_project_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: active project access required'; END IF;

  IF p_entity_type='material_requests' THEN
    SELECT array_agg(k ORDER BY k) INTO v_unknown FROM jsonb_object_keys(p_payload) k
    WHERE k NOT IN ('number','title','needed_on','notes','approver_id','priority','stage_id','budget_item_id');
  ELSE
    SELECT array_agg(k ORDER BY k) INTO v_unknown FROM jsonb_object_keys(p_payload) k
    WHERE k NOT IN ('request_id','material_id','budget_item_id','quantity','estimated_unit_price','notes');
  END IF;
  IF v_unknown IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported material payload fields: '||array_to_string(v_unknown,','); END IF;

  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'entity',p_entity_type,'entity_id',p_entity_id,'project_id',p_project_id,
    'operation',p_operation,'updated_at',p_updated_at,'payload',p_payload
  )::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  SELECT * INTO v_existing FROM public.sync_logs s WHERE s.company_id=v_company_id AND s.actor_id=v_actor AND s.mutation_id=p_mutation_id;
  IF FOUND THEN
    IF v_existing.payload_hash<>v_hash THEN RETURN jsonb_build_object('result','rejected','code','idempotency_mismatch','message','Mutation id already used with another payload.','mutation_id',p_mutation_id); END IF;
    RETURN v_existing.response;
  END IF;

  BEGIN
    IF p_entity_type='material_requests' THEN
      CASE p_operation
        WHEN 'create' THEN
          INSERT INTO public.material_requests(id,company_id,project_id,number,title,needed_on,status,notes,requested_by,approver_id,priority,stage_id,budget_item_id,updated_at,mutation_id)
          VALUES(p_entity_id,v_company_id,p_project_id,p_payload->>'number',p_payload->>'title',NULLIF(p_payload->>'needed_on','')::date,'draft',COALESCE(p_payload->>'notes',''),v_actor,NULLIF(p_payload->>'approver_id','')::uuid,COALESCE(NULLIF(p_payload->>'priority',''),'normal')::public.material_request_priority,(p_payload->>'stage_id')::uuid,NULLIF(p_payload->>'budget_item_id','')::uuid,p_updated_at,p_mutation_id)
          RETURNING to_jsonb(material_requests.*) INTO v_row;
        WHEN 'update' THEN
          UPDATE public.material_requests r SET
            number=CASE WHEN p_payload?'number' THEN p_payload->>'number' ELSE r.number END,
            title=CASE WHEN p_payload?'title' THEN p_payload->>'title' ELSE r.title END,
            needed_on=CASE WHEN p_payload?'needed_on' THEN NULLIF(p_payload->>'needed_on','')::date ELSE r.needed_on END,
            notes=CASE WHEN p_payload?'notes' THEN COALESCE(p_payload->>'notes','') ELSE r.notes END,
            approver_id=CASE WHEN p_payload?'approver_id' THEN NULLIF(p_payload->>'approver_id','')::uuid ELSE r.approver_id END,
            priority=CASE WHEN p_payload?'priority' THEN (p_payload->>'priority')::public.material_request_priority ELSE r.priority END,
            stage_id=CASE WHEN p_payload?'stage_id' THEN (p_payload->>'stage_id')::uuid ELSE r.stage_id END,
            budget_item_id=CASE WHEN p_payload?'budget_item_id' THEN NULLIF(p_payload->>'budget_item_id','')::uuid ELSE r.budget_item_id END,
            updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE r.id=p_entity_id AND r.company_id=v_company_id AND r.project_id=p_project_id
          RETURNING to_jsonb(r.*) INTO v_row;
        WHEN 'soft_delete' THEN
          UPDATE public.material_requests r SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE r.id=p_entity_id AND r.company_id=v_company_id AND r.project_id=p_project_id RETURNING to_jsonb(r.*) INTO v_row;
        WHEN 'restore' THEN
          UPDATE public.material_requests r SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE r.id=p_entity_id AND r.company_id=v_company_id AND r.project_id=p_project_id RETURNING to_jsonb(r.*) INTO v_row;
      END CASE;
    ELSE
      CASE p_operation
        WHEN 'create' THEN
          INSERT INTO public.material_request_items(id,company_id,project_id,request_id,material_id,budget_item_id,quantity,estimated_unit_price,notes,updated_at,mutation_id)
          VALUES(p_entity_id,v_company_id,p_project_id,(p_payload->>'request_id')::uuid,(p_payload->>'material_id')::uuid,NULLIF(p_payload->>'budget_item_id','')::uuid,(p_payload->>'quantity')::numeric,COALESCE((p_payload->>'estimated_unit_price')::numeric,0),COALESCE(p_payload->>'notes',''),p_updated_at,p_mutation_id)
          RETURNING to_jsonb(material_request_items.*) INTO v_row;
        WHEN 'update' THEN
          UPDATE public.material_request_items i SET
            budget_item_id=CASE WHEN p_payload?'budget_item_id' THEN NULLIF(p_payload->>'budget_item_id','')::uuid ELSE i.budget_item_id END,
            quantity=CASE WHEN p_payload?'quantity' THEN (p_payload->>'quantity')::numeric ELSE i.quantity END,
            estimated_unit_price=CASE WHEN p_payload?'estimated_unit_price' THEN (p_payload->>'estimated_unit_price')::numeric ELSE i.estimated_unit_price END,
            notes=CASE WHEN p_payload?'notes' THEN COALESCE(p_payload->>'notes','') ELSE i.notes END,
            updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE i.id=p_entity_id AND i.company_id=v_company_id AND i.project_id=p_project_id RETURNING to_jsonb(i.*) INTO v_row;
        WHEN 'soft_delete' THEN
          UPDATE public.material_request_items i SET deleted_at=p_updated_at,updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE i.id=p_entity_id AND i.company_id=v_company_id AND i.project_id=p_project_id RETURNING to_jsonb(i.*) INTO v_row;
        WHEN 'restore' THEN
          UPDATE public.material_request_items i SET deleted_at=NULL,updated_at=p_updated_at,mutation_id=p_mutation_id
          WHERE i.id=p_entity_id AND i.company_id=v_company_id AND i.project_id=p_project_id RETURNING to_jsonb(i.*) INTO v_row;
      END CASE;
    END IF;
    IF v_row IS NULL THEN v_result:='rejected';v_error_code:='not_found_or_forbidden';v_error_message:='Target row unavailable.';END IF;
  EXCEPTION
    WHEN unique_violation THEN v_result:='conflict';v_error_code:='unique_conflict';v_error_message:='A conflicting canonical row already exists.';
    WHEN foreign_key_violation OR check_violation OR not_null_violation OR invalid_text_representation OR insufficient_privilege THEN
      v_result:='rejected';GET STACKED DIAGNOSTICS v_error_code=RETURNED_SQLSTATE,v_error_message=MESSAGE_TEXT;
  END;
  IF v_row IS NULL AND v_result IN ('rejected','conflict') THEN
    IF p_entity_type='material_requests' THEN SELECT to_jsonb(r.*) INTO v_row FROM public.material_requests r WHERE r.id=p_entity_id AND r.company_id=v_company_id AND r.project_id=p_project_id;
    ELSE SELECT to_jsonb(i.*) INTO v_row FROM public.material_request_items i WHERE i.id=p_entity_id AND i.company_id=v_company_id AND i.project_id=p_project_id; END IF;
  END IF;
  v_response:=jsonb_strip_nulls(jsonb_build_object('result',v_result,'mutation_id',p_mutation_id,'entity',p_entity_type,'entity_id',p_entity_id,'row',v_row,'code',v_error_code,'message',v_error_message));
  PERFORM mgl_private.write_sync_receipt(v_company_id,p_project_id,p_mutation_id,p_entity_type,p_entity_id,p_operation,v_hash,v_result,v_response);
  RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION mgl_private.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION mgl_private.sync_material_request_transition(
  p_mutation_id uuid,p_entity_id uuid,p_project_id uuid,p_updated_at timestamptz,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_company_id uuid; v_hash text; v_existing public.sync_logs;
  v_transition text; v_reason text; v_error text; v_row jsonb; v_response jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  v_transition:=NULLIF(p_payload->>'transition',''); v_reason:=NULLIF(p_payload->>'reason','');
  IF v_transition IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('transition','reason')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: invalid material request transition payload';
  END IF;
  SELECT p.company_id INTO v_company_id FROM public.projects p WHERE p.id=p_project_id AND p.deleted_at IS NULL;
  IF v_company_id IS NULL OR NOT mgl_private.project_access(v_company_id,p_project_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: active project access required'; END IF;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('entity','material_requests','entity_id',p_entity_id,'project_id',p_project_id,'operation','update','updated_at',p_updated_at,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||p_mutation_id::text,0));
  SELECT * INTO v_existing FROM public.sync_logs s WHERE s.company_id=v_company_id AND s.actor_id=v_actor AND s.mutation_id=p_mutation_id;
  IF FOUND THEN
    IF v_existing.payload_hash<>v_hash THEN RETURN jsonb_build_object('result','rejected','code','idempotency_mismatch','message','Mutation id already used with another payload.','mutation_id',p_mutation_id); END IF;
    RETURN v_existing.response;
  END IF;
  BEGIN
    PERFORM mgl_private.transition_material_request_v2(p_entity_id,v_transition,v_reason);
    SELECT to_jsonb(r.*) INTO v_row FROM public.material_requests r WHERE r.company_id=v_company_id AND r.project_id=p_project_id AND r.id=p_entity_id;
    v_response:=jsonb_build_object('result','applied','mutation_id',p_mutation_id,'entity','material_requests','entity_id',p_entity_id,'row',v_row);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation OR invalid_text_representation THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    SELECT to_jsonb(r.*) INTO v_row FROM public.material_requests r WHERE r.company_id=v_company_id AND r.project_id=p_project_id AND r.id=p_entity_id;
    v_response:=jsonb_build_object('result','rejected','mutation_id',p_mutation_id,'entity','material_requests','entity_id',p_entity_id,'row',v_row,'code',SQLSTATE,'message',v_error);
  END;
  PERFORM mgl_private.write_sync_receipt(v_company_id,p_project_id,p_mutation_id,'material_requests',p_entity_id,'update',v_hash,v_response->>'result',v_response);
  RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION mgl_private.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.sync_material_mutation($1,$2,$3,$4,$5,$6,$7); $$;
CREATE OR REPLACE FUNCTION public.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT mgl_private.sync_material_request_transition($1,$2,$3,$4,$5); $$;
REVOKE ALL ON FUNCTION public.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) TO authenticated;

-- Runtime guards and notification trigger matching the deployed Tarea 10 contract.
CREATE OR REPLACE FUNCTION mgl_private.write_sync_receipt(
  p_company_id uuid,p_project_id uuid,p_mutation_id uuid,p_entity_type text,
  p_entity_id uuid,p_operation text,p_payload_hash text,p_result text,p_response jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  IF p_result NOT IN ('applied','conflict','rejected') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: invalid synchronization result'; END IF;
  IF p_entity_type NOT IN ('tasks','task_dependencies','documents','sst_records','budget_items','material_requests','material_request_items') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported synchronization entity';
  END IF;
  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported synchronization operation'; END IF;
  IF NOT mgl_private.project_access(p_company_id,p_project_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: project access required'; END IF;
  INSERT INTO public.sync_logs(company_id,project_id,actor_id,entity_type,entity_id,operation,payload_hash,result,response,mutation_id)
  VALUES(p_company_id,p_project_id,v_actor,p_entity_type,p_entity_id,p_operation,p_payload_hash,p_result,p_response,p_mutation_id);
END $$;
REVOKE ALL ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION mgl_private.material_request_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.workflow_status := CASE NEW.status
    WHEN 'submitted' THEN 'pending'::public.material_request_status
    WHEN 'fulfilled' THEN 'delivered'::public.material_request_status
    ELSE NEW.status::public.material_request_status END;
  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.requested_by<>auth.uid() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: invalid material request requester'; END IF;
    IF NEW.status<>'draft' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material requests start as draft'; END IF;
  ELSE
    IF NEW.requested_by<>OLD.requested_by THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request requester is immutable'; END IF;
    IF OLD.status<>'draft' AND
      (to_jsonb(NEW)-ARRAY['status','workflow_status','approved_by','approved_at','notes','rejection_reason','updated_at','server_updated_at','mutation_id','version'])
      IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','workflow_status','approved_by','approved_at','notes','rejection_reason','updated_at','server_updated_at','mutation_id','version'])
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: submitted material request header is immutable'; END IF;
  END IF;
  IF NEW.approver_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.project_members m
    WHERE m.company_id=NEW.company_id AND m.project_id=NEW.project_id AND m.user_id=NEW.approver_id AND m.deleted_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request approver must be an active project member'; END IF;
  IF NEW.budget_item_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.budget_items i JOIN public.project_budgets b
      ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id AND i.id=NEW.budget_item_id AND i.stage_id=NEW.stage_id
      AND i.item_type='item' AND i.deleted_at IS NULL AND b.deleted_at IS NULL AND b.status='baseline'
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request budget item must be an active leaf item from the same stage'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mgl_private.material_request_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION mgl_private.material_request_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_requester uuid; v_item_type text; v_budget_status text;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.request_id<>OLD.request_id OR NEW.material_id<>OLD.material_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: request line identity is immutable';
  END IF;
  SELECT r.status,r.requested_by INTO v_status,v_requester
  FROM public.material_requests r
  WHERE r.company_id=NEW.company_id AND r.project_id=NEW.project_id AND r.id=NEW.request_id AND r.deleted_at IS NULL FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: request lines are editable only in drafts'; END IF;
  IF mgl_private.company_role(NEW.company_id)='field_worker' AND v_requester IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: workers edit only their own material requests';
  END IF;
  IF NEW.budget_item_id IS NOT NULL THEN
    SELECT i.item_type,b.status INTO v_item_type,v_budget_status
    FROM public.budget_items i JOIN public.project_budgets b
      ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id AND i.id=NEW.budget_item_id
      AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
    IF v_item_type IS DISTINCT FROM 'item' OR v_budget_status IS DISTINCT FROM 'baseline' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: request cost code must be a leaf item from the active baseline';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mgl_private.material_request_item_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION mgl_private.notify_material_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status='submitted' AND NEW.approver_id IS NOT NULL THEN
      PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.approver_id,NEW.requested_by,
        'material_request_created','Nueva petición de materiales',NEW.title,'material_request',NEW.id,
        '/app/peticiones/'||NEW.id,jsonb_build_object('priority',NEW.priority,'stage_id',NEW.stage_id,'number',NEW.number));
    ELSIF NEW.status IN ('approved','rejected','fulfilled','cancelled') THEN
      PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.requested_by,auth.uid(),
        'material_request_status','Petición de materiales actualizada','La petición '||NEW.number||' cambió a '||NEW.workflow_status::text,
        'material_request',NEW.id,'/field/peticion/'||NEW.id,jsonb_build_object('status',NEW.workflow_status,'number',NEW.number));
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION mgl_private.notify_material_request() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS material_request_guard ON public.material_requests;
CREATE TRIGGER material_request_guard BEFORE INSERT OR UPDATE ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.material_request_guard();
DROP TRIGGER IF EXISTS material_request_item_guard ON public.material_request_items;
CREATE TRIGGER material_request_item_guard BEFORE INSERT OR UPDATE ON public.material_request_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.material_request_item_guard();
DROP TRIGGER IF EXISTS notify_material_request ON public.material_requests;
CREATE TRIGGER notify_material_request AFTER INSERT OR UPDATE OF status ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.notify_material_request();
