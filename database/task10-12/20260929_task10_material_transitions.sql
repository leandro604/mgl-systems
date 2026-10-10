-- MGL Systems · Tarea 10 · transición con motivo de rechazo.
CREATE OR REPLACE FUNCTION mgl_private.transition_material_request_v2(
  p_request_id uuid,p_target_status text,p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.material_requests; v_role public.app_role; v_target text; v_reason text:=nullif(btrim(p_reason),'');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  v_target:=CASE p_target_status WHEN 'pending' THEN 'submitted' WHEN 'delivered' THEN 'fulfilled' ELSE p_target_status END;
  IF v_target NOT IN ('submitted','approved','rejected','cancelled','fulfilled') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported material request status'; END IF;
  SELECT * INTO r FROM public.material_requests WHERE id=p_request_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_access(r.company_id,r.project_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: material request access required'; END IF;
  v_role:=mgl_private.company_role(r.company_id);
  IF v_target='submitted' THEN
    IF r.status<>'draft' OR r.approver_id IS NULL OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot submit this material request'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.material_request_items i WHERE i.company_id=r.company_id AND i.project_id=r.project_id AND i.request_id=r.id AND i.deleted_at IS NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request requires at least one line'; END IF;
  ELSIF v_target IN ('approved','rejected') THEN
    IF r.status<>'submitted' OR auth.uid() IS DISTINCT FROM r.approver_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: selected approver action required'; END IF;
    IF v_target='rejected' AND v_reason IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: rejection reason is required'; END IF;
  ELSIF v_target='cancelled' THEN
    IF r.status NOT IN ('draft','submitted','approved') OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot cancel this material request'; END IF;
  ELSIF v_target='fulfilled' AND v_role NOT IN ('admin','pm','supervisor') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: manager delivery confirmation required';
  END IF;
  UPDATE public.material_requests SET
    status=v_target,
    approved_by=CASE WHEN v_target='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN v_target='approved' THEN clock_timestamp() ELSE approved_at END,
    rejection_reason=CASE WHEN v_target='rejected' THEN v_reason WHEN v_target IN ('submitted','approved') THEN NULL ELSE rejection_reason END,
    updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('id',r.id,'status',r.status,'workflow_status',r.workflow_status,'approved_by',r.approved_by,'approved_at',r.approved_at,'rejection_reason',r.rejection_reason);
END $$;
REVOKE ALL ON FUNCTION mgl_private.transition_material_request_v2(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION mgl_private.transition_material_request_v2(uuid,text,text) TO authenticated,service_role;
