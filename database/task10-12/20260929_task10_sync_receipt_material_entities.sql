-- WIP Tarea 10: ampliar la allow-list del recibo idempotente para peticiones.
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
SET search_path=''
AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required';
  END IF;
  IF p_result NOT IN ('applied','conflict','rejected') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: invalid synchronization result';
  END IF;
  IF p_entity_type NOT IN (
    'tasks','task_dependencies','documents','sst_records','budget_items',
    'material_requests','material_request_items'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported synchronization entity';
  END IF;
  IF p_operation NOT IN ('create','update','soft_delete','restore') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported synchronization operation';
  END IF;
  IF NOT mgl_private.project_access(p_company_id,p_project_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: project access required';
  END IF;
  INSERT INTO public.sync_logs(
    company_id,project_id,actor_id,entity_type,entity_id,operation,
    payload_hash,result,response,mutation_id
  )
  VALUES(
    p_company_id,p_project_id,v_actor,p_entity_type,p_entity_id,p_operation,
    p_payload_hash,p_result,p_response,p_mutation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.write_sync_receipt(uuid,uuid,uuid,text,uuid,text,text,text,jsonb) TO authenticated,service_role;
