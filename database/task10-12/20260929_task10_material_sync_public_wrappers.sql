-- WIP Tarea 10: wrappers públicos para el motor local-first de peticiones.
CREATE OR REPLACE FUNCTION public.sync_material_mutation(
  p_mutation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_project_id uuid,
  p_operation text,
  p_updated_at timestamptz,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$
  SELECT mgl_private.sync_material_mutation(
    p_mutation_id,p_entity_type,p_entity_id,p_project_id,p_operation,p_updated_at,p_payload
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_material_request_transition(
  p_mutation_id uuid,
  p_entity_id uuid,
  p_project_id uuid,
  p_updated_at timestamptz,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$
  SELECT mgl_private.sync_material_request_transition(
    p_mutation_id,p_entity_id,p_project_id,p_updated_at,p_payload
  );
$$;

REVOKE ALL ON FUNCTION public.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_material_mutation(uuid,text,uuid,uuid,text,timestamptz,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_material_request_transition(uuid,uuid,uuid,timestamptz,jsonb) TO authenticated;
