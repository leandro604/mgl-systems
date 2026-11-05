-- Contextual notification copy. Private helpers share rendering with the backfill.
-- No changes to policies, delivery queues, links, or client sync contracts.
CREATE OR REPLACE FUNCTION mgl_private.notification_context(p_company uuid, p_project uuid, p_stage uuid)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT concat_ws(' · ',
    (SELECT s.name FROM public.project_stages s WHERE s.company_id=p_company AND s.project_id=p_project AND s.id=p_stage),
    (SELECT p.code FROM public.projects p WHERE p.company_id=p_company AND p.id=p_project))
$$;

CREATE OR REPLACE FUNCTION mgl_private.notification_person(p_company uuid, p_user uuid)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT nullif(trim(p.full_name),'') FROM public.profiles p
  WHERE p.company_id=p_company AND p.user_id=p_user
$$;

CREATE OR REPLACE FUNCTION mgl_private.material_notification_summary(p_company uuid, p_project uuid, p_request uuid)
RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT string_agg(label, ' + ' ORDER BY position)
    || CASE WHEN max(total)>3 THEN ' + '||(max(total)-3)::text||' más' ELSE '' END
  FROM (
    SELECT trim(trailing '.' FROM trim(trailing '0' FROM i.quantity::text))||' '||m.unit_code||' '||m.name AS label,
      row_number() OVER (ORDER BY i.created_at,i.id) AS position, count(*) OVER () AS total
    FROM public.material_request_items i
    JOIN public.materials m ON m.company_id=i.company_id AND m.id=i.material_id
    WHERE i.company_id=p_company AND i.project_id=p_project AND i.request_id=p_request AND i.deleted_at IS NULL
  ) items WHERE position<=3
$$;

CREATE OR REPLACE FUNCTION mgl_private.notify_task_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_assignment text;
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    v_assignment := CASE WHEN TG_OP='UPDATE' AND OLD.assignee_id IS NOT NULL THEN ' reasignada a ' ELSE ' asignada a ' END;
    PERFORM mgl_private.enqueue_notification(
      NEW.company_id,NEW.project_id,NEW.assignee_id,auth.uid(),'task_assigned',
      left(NEW.title,100)||v_assignment||left(coalesce(mgl_private.notification_person(NEW.company_id,NEW.assignee_id),'responsable'),60),
      concat_ws(' · ',nullif(mgl_private.notification_context(NEW.company_id,NEW.project_id,NEW.stage_id),''),
        'Asignada por '||mgl_private.notification_person(NEW.company_id,auth.uid()),NEW.title),
      'task',NEW.id,'/app/projects/'||NEW.project_id||'/tasks?focus='||NEW.id,
      jsonb_build_object('stage_id',NEW.stage_id));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION mgl_private.notify_material_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_summary text; v_body text; v_status text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_summary := coalesce(mgl_private.material_notification_summary(NEW.company_id,NEW.project_id,NEW.id),nullif(NEW.title,''),NEW.number);
    v_body := concat_ws(' · ','Solicitada por '||coalesce(mgl_private.notification_person(NEW.company_id,NEW.requested_by),'solicitante'),
      nullif(mgl_private.notification_context(NEW.company_id,NEW.project_id,NEW.stage_id),''),NEW.number,v_summary);
    IF NEW.status='submitted' AND NEW.approver_id IS NOT NULL THEN
      PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.approver_id,NEW.requested_by,
        'material_request_created',left('Solicitud: '||v_summary,180),v_body,'material_request',NEW.id,
        '/app/peticiones/'||NEW.id,jsonb_build_object('priority',NEW.priority,'stage_id',NEW.stage_id,'number',NEW.number));
    ELSIF NEW.status IN ('approved','rejected','fulfilled','cancelled') THEN
      v_status := CASE NEW.status WHEN 'approved' THEN 'aprobada' WHEN 'rejected' THEN 'rechazada' WHEN 'fulfilled' THEN 'entregada' ELSE 'cancelada' END;
      PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.requested_by,auth.uid(),
        'material_request_status',left(NEW.number||' '||v_status||': '||v_summary,180),
        concat_ws(' · ',v_body,'Actualizada por '||mgl_private.notification_person(NEW.company_id,auth.uid()),
          CASE WHEN NEW.status='rejected' THEN 'Motivo: '||nullif(NEW.rejection_reason,'') END),
        'material_request',NEW.id,'/field/peticion/'||NEW.id,jsonb_build_object('status',NEW.workflow_status,'number',NEW.number));
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION mgl_private.notification_context(uuid,uuid,uuid),mgl_private.notification_person(uuid,uuid),mgl_private.material_notification_summary(uuid,uuid,uuid),mgl_private.notify_task_assignment(),mgl_private.notify_material_request() FROM PUBLIC,anon,authenticated;

-- Only exact legacy titles with a matching tenant/project/entity are eligible.
-- Use the original recipient, not the task's current assignee. Missing entities
-- and custom copy are left untouched. Existing row guards/version triggers run.
UPDATE public.notifications n SET
  title=left(t.title,100)||' asignada a '||left(coalesce(mgl_private.notification_person(n.company_id,n.recipient_id),'responsable'),60),
  body=concat_ws(' · ',nullif(mgl_private.notification_context(n.company_id,t.project_id,t.stage_id),''),
    'Asignada por '||mgl_private.notification_person(n.company_id,n.actor_id),t.title),
  updated_at=greatest(clock_timestamp(),n.updated_at+interval '1 microsecond'),mutation_id=gen_random_uuid()
FROM public.tasks t
WHERE n.kind='task_assigned' AND n.title='Nueva tarea asignada' AND n.entity_type='task'
  AND n.entity_id=t.id AND n.company_id=t.company_id AND n.project_id=t.project_id
  AND n.deleted_at IS NULL AND t.deleted_at IS NULL;

UPDATE public.notifications n SET
  title=left(CASE WHEN n.kind='material_request_status' THEN r.number||' '||
    CASE n.metadata->>'status' WHEN 'approved' THEN 'aprobada' WHEN 'rejected' THEN 'rechazada'
      WHEN 'delivered' THEN 'entregada' WHEN 'fulfilled' THEN 'entregada' WHEN 'cancelled' THEN 'cancelada' ELSE 'actualizada' END||': '
    ELSE 'Solicitud: ' END||coalesce(mgl_private.material_notification_summary(r.company_id,r.project_id,r.id),nullif(r.title,''),r.number),180),
  body=concat_ws(' · ','Solicitada por '||coalesce(mgl_private.notification_person(r.company_id,r.requested_by),'solicitante'),
    nullif(mgl_private.notification_context(r.company_id,r.project_id,r.stage_id),''),r.number,
    coalesce(mgl_private.material_notification_summary(r.company_id,r.project_id,r.id),nullif(r.title,''),r.number)),
  updated_at=greatest(clock_timestamp(),n.updated_at+interval '1 microsecond'),mutation_id=gen_random_uuid()
FROM public.material_requests r
WHERE ((n.kind='material_request_created' AND n.title='Nueva petición de materiales')
    OR (n.kind='material_request_status' AND n.title='Petición de materiales actualizada')) AND n.entity_type='material_request'
  AND n.entity_id=r.id AND n.company_id=r.company_id AND n.project_id=r.project_id
  AND n.deleted_at IS NULL AND r.deleted_at IS NULL;
