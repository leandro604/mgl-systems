-- MGL Systems · Actualización arquitectónica crítica · Tarea 7/7
-- RLS, triggers, compatibilidad con clientes antiguos, alertas y búsqueda documental.

-- Versionado servidor-compatible: updated_at sigue siendo reloj del cliente para LWW.
ALTER TABLE public.tasks ADD COLUMN version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.documents ADD COLUMN version bigint NOT NULL DEFAULT 1;

CREATE FUNCTION mgl_private.bump_version() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();
CREATE TRIGGER z_bump_version BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION mgl_private.bump_version();

-- Defaults de etapa para clientes anteriores que todavía no envían stage_id.
CREATE FUNCTION mgl_private.assign_default_stage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_type public.project_stage := TG_ARGV[0]::public.project_stage;
BEGIN
  IF NEW.stage_id IS NULL THEN
    SELECT s.id INTO NEW.stage_id
    FROM public.project_stages s
    WHERE s.company_id=NEW.company_id AND s.project_id=NEW.project_id
      AND s.stage_type=v_type AND s.deleted_at IS NULL
    LIMIT 1;
  END IF;
  IF NEW.stage_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: project stage is required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER b_default_stage BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.assign_default_stage('field_execution');
CREATE TRIGGER b_default_stage BEFORE INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION mgl_private.assign_default_stage('management');
CREATE TRIGGER b_default_stage BEFORE INSERT ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.assign_default_stage('field_execution');
CREATE TRIGGER b_default_stage BEFORE INSERT ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.assign_default_stage('field_execution');

-- Sembrar etapas automáticamente en proyectos nuevos.
CREATE FUNCTION mgl_private.seed_project_stages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.project_stages(company_id,project_id,stage_type,code,name,sort_order,is_locked,created_by)
  VALUES
    (NEW.company_id,NEW.id,'management','00','00_Gestion del proyecto',10,false,NEW.created_by),
    (NEW.company_id,NEW.id,'engineering','01','01_Ingeniería',20,false,NEW.created_by),
    (NEW.company_id,NEW.id,'procurement','02','02_Compras',30,false,NEW.created_by),
    (NEW.company_id,NEW.id,'field_execution','04','04_Ejecución en Campo',40,false,NEW.created_by),
    (NEW.company_id,NEW.id,'finance','07','07_Finanzas del proyecto',50,false,NEW.created_by),
    (NEW.company_id,NEW.id,'quotation_closed','98','98_Cotización (Cerrada)',60,true,NEW.created_by),
    (NEW.company_id,NEW.id,'execution_versioned','EV','Ejecución versionada',70,false,NEW.created_by);
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_default_stages AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION mgl_private.seed_project_stages();

CREATE FUNCTION mgl_private.project_stage_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.is_locked AND
     (NEW.stage_type IS DISTINCT FROM OLD.stage_type OR NEW.code IS DISTINCT FROM OLD.code OR
      NEW.name IS DISTINCT FROM OLD.name OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR
      NEW.is_locked IS DISTINCT FROM OLD.is_locked) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: locked project stage is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER stage_guard BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION mgl_private.project_stage_guard();

-- Estado de costo automático por umbrales del proyecto.
CREATE FUNCTION mgl_private.recalculate_budget_cost_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_minor numeric; v_major numeric; v_quoted numeric; v_actual numeric; v_pct numeric;
BEGIN
  IF NEW.item_type='group' THEN
    NEW.cost_status := 'dentro_presupuesto';
    NEW.qty_actual := 0;
    NEW.unit_price_actual := 0;
    RETURN NEW;
  END IF;
  SELECT p.cost_alert_minor_max_pct,p.cost_alert_major_max_pct INTO v_minor,v_major
  FROM public.projects p WHERE p.company_id=NEW.company_id AND p.id=NEW.project_id AND p.deleted_at IS NULL;
  v_quoted := round(NEW.quantity*NEW.unit_price,2);
  v_actual := round(NEW.qty_actual*NEW.unit_price_actual,2);
  IF v_actual <= v_quoted THEN NEW.cost_status := 'dentro_presupuesto';
  ELSIF v_quoted=0 THEN NEW.cost_status := 'critico';
  ELSE
    v_pct := ((v_actual-v_quoted)/v_quoted)*100;
    IF v_pct <= v_minor THEN NEW.cost_status := 'alerta_menor';
    ELSIF v_pct <= v_major THEN NEW.cost_status := 'alerta_mayor';
    ELSE NEW.cost_status := 'critico'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER c_budget_cost_status BEFORE INSERT OR UPDATE OF quantity,unit_price,qty_actual,unit_price_actual,item_type
ON public.budget_items FOR EACH ROW EXECUTE FUNCTION mgl_private.recalculate_budget_cost_status();

-- Permite ejecución real sobre línea base sin abrir los datos cotizados/estructurales.
CREATE OR REPLACE FUNCTION mgl_private.budget_item_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_parent_type text; v_role public.app_role;
BEGIN
  SELECT b.status INTO v_status
  FROM public.project_budgets b
  WHERE b.company_id=NEW.company_id AND b.project_id=NEW.project_id
    AND b.id=NEW.budget_id AND b.deleted_at IS NULL
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: budget version not found';
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT i.item_type INTO v_parent_type
    FROM public.budget_items i
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
      AND i.budget_id=NEW.budget_id AND i.id=NEW.parent_id AND i.deleted_at IS NULL;
    IF v_parent_type IS DISTINCT FROM 'group' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: budget parent must be an active group';
    END IF;
  END IF;

  v_role := mgl_private.company_role(NEW.company_id);

  IF v_status='draft' THEN
    IF v_role NOT IN ('admin','pm') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: only admin or pm can edit draft budgets';
    END IF;
    RETURN NEW;
  END IF;

  IF v_status<>'baseline' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: superseded/archived budget items are immutable';
  END IF;

  IF TG_OP='INSERT' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: baseline structure is immutable';
  END IF;

  IF (to_jsonb(NEW)-ARRAY['qty_actual','unit_price_actual','cost_status','budget_amount','qty_quoted','unit_price_quoted','actual_amount','deviation_amount','deviation_pct','updated_at','server_updated_at','mutation_id','version'])
     IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['qty_actual','unit_price_actual','cost_status','budget_amount','qty_quoted','unit_price_quoted','actual_amount','deviation_amount','deviation_pct','updated_at','server_updated_at','mutation_id','version']) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: quoted baseline fields are immutable';
  END IF;

  IF v_role='field_worker' THEN
    IF NEW.unit_price_actual IS DISTINCT FROM OLD.unit_price_actual OR NOT EXISTS(
      SELECT 1
      FROM public.tasks t
      WHERE t.company_id=NEW.company_id AND t.project_id=NEW.project_id
        AND t.budget_item_id=NEW.id AND t.assignee_id=auth.uid()
        AND t.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: worker may update only actual quantity of an assigned budget item';
    END IF;
  ELSIF v_role NOT IN ('admin','pm','supervisor') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: insufficient cost-control role';
  END IF;

  RETURN NEW;
END;
$$;

-- Etapa obligatoria y coherente con partida vinculada.
CREATE OR REPLACE FUNCTION mgl_private.validate_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_parent_type text; v_budget_type text; v_budget_status text; v_budget_stage uuid;
BEGIN
  IF NEW.stage_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: every task requires a stage'; END IF;
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) AND NOT EXISTS (
    SELECT 1 FROM public.project_members m JOIN public.profiles p ON p.company_id=m.company_id AND p.user_id=m.user_id
    WHERE m.company_id=NEW.company_id AND m.project_id=NEW.project_id AND m.user_id=NEW.assignee_id
      AND m.deleted_at IS NULL AND p.deleted_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: assignee is not an active project member'; END IF;
  IF NEW.task_type='milestone' AND (NEW.starts_on IS NULL OR NEW.due_on IS DISTINCT FROM NEW.starts_on) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: milestone requires the same start and finish date';
  END IF;
  IF NEW.task_type<>'summary' AND EXISTS(SELECT 1 FROM public.tasks c WHERE c.company_id=NEW.company_id AND c.project_id=NEW.project_id AND c.parent_task_id=NEW.id AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: a WBS parent with active children must remain a summary task';
  END IF;
  IF NEW.task_type='summary' AND EXISTS(SELECT 1 FROM public.task_dependencies d WHERE d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.deleted_at IS NULL AND (d.task_id=NEW.id OR d.depends_on_task_id=NEW.id)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: summary tasks cannot participate in CPM dependencies';
  END IF;
  IF NEW.parent_task_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,8));
    SELECT p.task_type INTO v_parent_type FROM public.tasks p
    WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id AND p.id=NEW.parent_task_id AND p.deleted_at IS NULL;
    IF v_parent_type IS DISTINCT FROM 'summary' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: WBS parent must be an active summary task'; END IF;
    IF EXISTS(WITH RECURSIVE parents(id,parent_task_id) AS (
      SELECT p.id,p.parent_task_id FROM public.tasks p WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id AND p.id=NEW.parent_task_id
      UNION ALL SELECT p.id,p.parent_task_id FROM public.tasks p JOIN parents a ON p.id=a.parent_task_id
      WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id
    ) SELECT 1 FROM parents WHERE id=NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: cyclic WBS hierarchy';
    END IF;
  END IF;
  IF NEW.budget_item_id IS NOT NULL THEN
    SELECT i.item_type,b.status,i.stage_id INTO v_budget_type,v_budget_status,v_budget_stage
    FROM public.budget_items i JOIN public.project_budgets b ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id AND i.id=NEW.budget_item_id AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
    IF v_budget_type IS DISTINCT FROM 'item' OR v_budget_status IS DISTINCT FROM 'baseline' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: task cost link must use a leaf item from the active budget baseline';
    END IF;
    IF v_budget_stage IS DISTINCT FROM NEW.stage_id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: task and linked budget item must belong to the same stage';
    END IF;
  END IF;
  IF mgl_private.company_role(NEW.company_id)='field_worker' THEN
    IF TG_OP='INSERT' AND (NEW.created_by<>auth.uid() OR NEW.assignee_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: workers create only self-assigned tasks';
    END IF;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id','version'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id','version']) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: workers may update only status and progress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Documentos: metadata adicional + FTS; los bytes permanecen en Drive/OneDrive.
ALTER TABLE public.documents
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN folder_path text NOT NULL DEFAULT '/',
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish',coalesce(name,'')),'A') ||
    setweight(to_tsvector('spanish',coalesce(description,'')),'B') ||
    setweight(to_tsvector('spanish',coalesce(folder_path,'')),'B')
  ) STORED;
CREATE INDEX documents_search_vector_gin ON public.documents USING gin(search_vector);
CREATE INDEX documents_project_stage_created_idx
  ON public.documents(company_id,project_id,stage_id,created_at DESC)
  WHERE deleted_at IS NULL;

-- Preferencias automáticas para perfiles nuevos.
CREATE FUNCTION mgl_private.ensure_user_preferences() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.user_preferences(company_id,user_id)
  VALUES(NEW.company_id,NEW.user_id)
  ON CONFLICT(company_id,user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profile_default_preferences AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION mgl_private.ensure_user_preferences();

-- Material requests: aprobador seleccionado y aliases pending/delivered sin romper Fase 7.
CREATE OR REPLACE FUNCTION mgl_private.material_request_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  NEW.workflow_status := CASE NEW.status
    WHEN 'submitted' THEN 'pending'::public.material_request_status
    WHEN 'fulfilled' THEN 'delivered'::public.material_request_status
    ELSE NEW.status::public.material_request_status
  END;

  IF TG_OP='INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.requested_by<>auth.uid() THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: invalid material request requester';
    END IF;
    IF NEW.status<>'draft' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material requests start as draft';
    END IF;
  ELSE
    IF NEW.requested_by<>OLD.requested_by THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request requester is immutable';
    END IF;
    IF OLD.status<>'draft' AND
      (to_jsonb(NEW)-ARRAY['status','workflow_status','approved_by','approved_at','notes','updated_at','server_updated_at','mutation_id','version'])
      IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','workflow_status','approved_by','approved_at','notes','updated_at','server_updated_at','mutation_id','version']) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: submitted material request header is immutable';
    END IF;
  END IF;

  IF NEW.approver_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.project_members m
    WHERE m.company_id=NEW.company_id AND m.project_id=NEW.project_id AND m.user_id=NEW.approver_id AND m.deleted_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request approver must be an active project member'; END IF;

  IF NEW.budget_item_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.budget_items i JOIN public.project_budgets b
      ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id AND i.id=NEW.budget_item_id
      AND i.stage_id=NEW.stage_id AND i.item_type='item' AND i.deleted_at IS NULL AND b.deleted_at IS NULL AND b.status='baseline'
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request budget item must be an active leaf item from the same stage'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION mgl_private.transition_material_request(p_request_id uuid,p_target_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.material_requests; v_role public.app_role; v_target text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='MGL: authentication required'; END IF;
  v_target := CASE p_target_status WHEN 'pending' THEN 'submitted' WHEN 'delivered' THEN 'fulfilled' ELSE p_target_status END;
  IF v_target NOT IN ('submitted','approved','rejected','cancelled','fulfilled') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported material request status'; END IF;
  SELECT * INTO r FROM public.material_requests WHERE id=p_request_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT mgl_private.project_access(r.company_id,r.project_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: material request access required'; END IF;
  v_role:=mgl_private.company_role(r.company_id);
  IF v_target='submitted' THEN
    IF r.status<>'draft' OR r.approver_id IS NULL OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot submit this material request'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.material_request_items i WHERE i.company_id=r.company_id AND i.project_id=r.project_id AND i.request_id=r.id AND i.deleted_at IS NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: material request requires at least one line'; END IF;
  ELSIF v_target IN ('approved','rejected') THEN
    IF r.status<>'submitted' OR auth.uid() IS DISTINCT FROM r.approver_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: selected approver action required'; END IF;
  ELSIF v_target='cancelled' THEN
    IF r.status NOT IN ('draft','submitted','approved') OR (r.requested_by<>auth.uid() AND v_role NOT IN ('admin','pm','supervisor')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: cannot cancel this material request'; END IF;
  ELSIF v_target='fulfilled' THEN
    IF v_role NOT IN ('admin','pm','supervisor') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='MGL: manager delivery confirmation required'; END IF;
  END IF;
  UPDATE public.material_requests SET status=v_target,
    approved_by=CASE WHEN v_target='approved' THEN auth.uid() ELSE approved_by END,
    approved_at=CASE WHEN v_target='approved' THEN clock_timestamp() ELSE approved_at END,
    updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('id',r.id,'status',r.status,'workflow_status',r.workflow_status,'approved_by',r.approved_by,'approved_at',r.approved_at);
END;
$$;

-- Fuente de verdad de notificaciones. No es callable por cliente.
CREATE FUNCTION mgl_private.enqueue_notification(
  p_company_id uuid,p_project_id uuid,p_recipient_id uuid,p_actor_id uuid,p_kind text,p_title text,p_body text,
  p_entity_type text,p_entity_id uuid,p_action_url text,p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=gen_random_uuid(); v_email boolean:=true; v_push boolean:=false;
BEGIN
  IF p_recipient_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(id,company_id,project_id,recipient_id,actor_id,kind,title,body,entity_type,entity_id,action_url,metadata)
  VALUES(v_id,p_company_id,p_project_id,p_recipient_id,p_actor_id,p_kind,p_title,coalesce(p_body,''),p_entity_type,p_entity_id,p_action_url,coalesce(p_metadata,'{}'::jsonb));
  INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for,sent_at)
  VALUES(p_company_id,v_id,p_recipient_id,'in_app','sent',clock_timestamp(),clock_timestamp());
  SELECT coalesce(u.email_enabled,true),coalesce(u.push_enabled,false) INTO v_email,v_push
  FROM public.user_preferences u WHERE u.company_id=p_company_id AND u.user_id=p_recipient_id AND u.deleted_at IS NULL;
  IF v_email THEN
    INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for)
    VALUES(p_company_id,v_id,p_recipient_id,'email','scheduled',clock_timestamp()+interval '5 minutes');
  END IF;
  IF v_push THEN
    INSERT INTO public.notification_deliveries(company_id,notification_id,recipient_id,channel,status,scheduled_for)
    VALUES(p_company_id,v_id,p_recipient_id,'push','scheduled',clock_timestamp());
  END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION mgl_private.notify_task_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.assignee_id,auth.uid(),'task_assigned','Nueva tarea asignada',NEW.title,'task',NEW.id,'/app/tasks/'||NEW.id,jsonb_build_object('stage_id',NEW.stage_id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_task_assignment AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.notify_task_assignment();

CREATE FUNCTION mgl_private.notify_material_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.approver_id IS NOT NULL THEN
    PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.approver_id,NEW.requested_by,'material_request_created','Nueva petición de materiales','Petición '||NEW.number||' pendiente de revisión','material_request',NEW.id,'/app/peticiones',jsonb_build_object('priority',NEW.priority,'stage_id',NEW.stage_id));
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,NEW.requested_by,auth.uid(),'material_request_status','Petición de materiales actualizada','La petición '||NEW.number||' cambió a '||NEW.status::text,'material_request',NEW.id,'/field/mis-peticiones',jsonb_build_object('status',NEW.status));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_material_request AFTER INSERT OR UPDATE OF status ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION mgl_private.notify_material_request();

CREATE FUNCTION mgl_private.notify_cost_alert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
  IF NEW.item_type='item' AND NEW.cost_status IN ('alerta_mayor','critico') AND NEW.cost_status IS DISTINCT FROM OLD.cost_status THEN
    FOR r IN
      SELECT pm.user_id FROM public.project_members pm JOIN public.profiles p ON p.company_id=pm.company_id AND p.user_id=pm.user_id
      WHERE pm.company_id=NEW.company_id AND pm.project_id=NEW.project_id AND pm.deleted_at IS NULL AND p.deleted_at IS NULL AND p.role IN ('admin','pm')
    LOOP
      PERFORM mgl_private.enqueue_notification(NEW.company_id,NEW.project_id,r.user_id,auth.uid(),'cost_alert','Alerta de desviación de costo',NEW.code||' · '||NEW.description,'budget_item',NEW.id,'/app/projects/'||NEW.project_id||'/control',jsonb_build_object('status',NEW.cost_status,'deviation_amount',NEW.deviation_amount,'deviation_pct',NEW.deviation_pct,'stage_id',NEW.stage_id));
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notify_cost_alert AFTER UPDATE OF qty_actual,unit_price_actual,cost_status ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION mgl_private.notify_cost_alert();

CREATE FUNCTION mgl_private.cancel_unread_external_deliveries() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    UPDATE public.notification_deliveries
    SET status='skipped',last_error='read_in_app_before_delivery',updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
    WHERE company_id=NEW.company_id AND notification_id=NEW.id AND channel IN ('email','push')
      AND status IN ('pending','scheduled') AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER notification_read_skip_external AFTER UPDATE OF read_at ON public.notifications
FOR EACH ROW EXECUTE FUNCTION mgl_private.cancel_unread_external_deliveries();

-- Resumen de costos global + por etapa + top desviaciones.
CREATE FUNCTION public.project_cost_summary(p_project_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH project_row AS (
  SELECT p.id,p.company_id FROM public.projects p WHERE p.id=p_project_id AND p.deleted_at IS NULL
), leaf AS (
  SELECT i.*,s.code AS stage_code,s.name AS stage_name,s.sort_order AS stage_sort_order
  FROM public.budget_items i
  JOIN public.project_budgets b ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
  JOIN public.project_stages s ON s.company_id=i.company_id AND s.project_id=i.project_id AND s.id=i.stage_id
  JOIN project_row p ON p.company_id=i.company_id AND p.id=i.project_id
  WHERE i.deleted_at IS NULL AND b.deleted_at IS NULL AND b.status='baseline' AND i.item_type='item' AND s.deleted_at IS NULL
), agg AS (
  SELECT coalesce(sum(budget_amount),0)::numeric(18,2) quoted,
         coalesce(sum(actual_amount),0)::numeric(18,2) actual
  FROM leaf
)
SELECT jsonb_build_object(
  'project_id',p_project_id,
  'quoted_total',a.quoted,
  'actual_total',a.actual,
  'deviation_amount',(a.actual-a.quoted)::numeric(18,2),
  'deviation_pct',CASE WHEN a.quoted=0 THEN NULL ELSE round(((a.actual-a.quoted)/a.quoted)*100,2) END,
  'stages',coalesce((SELECT jsonb_agg(x ORDER BY (x->>'sort_order')::int) FROM (
    SELECT jsonb_build_object('stage_id',stage_id,'stage_code',stage_code,'stage_name',stage_name,'sort_order',stage_sort_order,
      'quoted_total',sum(budget_amount)::numeric(18,2),'actual_total',sum(actual_amount)::numeric(18,2),
      'deviation_amount',(sum(actual_amount)-sum(budget_amount))::numeric(18,2),
      'deviation_pct',CASE WHEN sum(budget_amount)=0 THEN NULL ELSE round(((sum(actual_amount)-sum(budget_amount))/sum(budget_amount))*100,2) END,
      'critical_items',count(*) FILTER(WHERE cost_status='critico')) x
    FROM leaf GROUP BY stage_id,stage_code,stage_name,stage_sort_order
  ) q),'[]'::jsonb),
  'top_deviations',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (
    SELECT id,code,description,stage_id,budget_amount AS quoted_total,actual_amount AS actual_total,deviation_amount,deviation_pct,cost_status
    FROM leaf ORDER BY deviation_amount DESC NULLS LAST LIMIT 5
  ) q),'[]'::jsonb)
) FROM agg a
$$;
REVOKE ALL ON FUNCTION public.project_cost_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_cost_summary(uuid) TO authenticated;

-- RLS / grants.
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_stages,public.notifications,public.notification_deliveries,public.push_subscriptions,public.user_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_stages,public.notifications,public.notification_deliveries,public.push_subscriptions,public.user_preferences TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.project_stages,public.notifications,public.notification_deliveries,public.push_subscriptions,public.user_preferences TO service_role;
GRANT INSERT,UPDATE ON public.project_stages TO authenticated;
GRANT INSERT,UPDATE ON public.push_subscriptions TO authenticated;
GRANT INSERT,UPDATE ON public.user_preferences TO authenticated;
GRANT UPDATE(read_at,updated_at,mutation_id) ON public.notifications TO authenticated;

CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.project_stages FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE POLICY project_stages_read ON public.project_stages FOR SELECT TO authenticated USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY project_stages_insert ON public.project_stages FOR INSERT TO authenticated WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]) AND created_by=(select auth.uid()));
CREATE POLICY project_stages_update ON public.project_stages FOR UPDATE TO authenticated USING(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[])) WITH CHECK(mgl_private.project_write(company_id,project_id,ARRAY['admin','pm']::public.app_role[]));

CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING(recipient_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING(recipient_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL) WITH CHECK(recipient_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY notification_deliveries_read ON public.notification_deliveries FOR SELECT TO authenticated USING(recipient_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY push_subscriptions_read ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE TO authenticated USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL) WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY user_preferences_read ON public.user_preferences FOR SELECT TO authenticated USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY user_preferences_insert ON public.user_preferences FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);
CREATE POLICY user_preferences_update ON public.user_preferences FOR UPDATE TO authenticated USING(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL) WITH CHECK(user_id=(select auth.uid()) AND mgl_private.company_role(company_id) IS NOT NULL);

-- Perfiles: el propio usuario edita sus datos personales; alta/roles siguen siendo servidor.
GRANT UPDATE(full_name,phone,phone_secondary,dni,birth_date,hire_date,position,department,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,blood_type,photo_drive_id,notes,updated_at,mutation_id)
ON public.profiles TO authenticated;
DROP POLICY profile_update ON public.profiles;
CREATE POLICY profile_update ON public.profiles
FOR UPDATE TO authenticated
USING(
  mgl_private.company_role(company_id) IS NOT NULL
  AND (user_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm'))
)
WITH CHECK(
  mgl_private.company_role(company_id) IS NOT NULL
  AND (user_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm'))
);

-- Costos: ampliar RLS para supervisor y worker ligado a una tarea. El trigger limita columnas reales.
DROP POLICY budget_items_read ON public.budget_items;
DROP POLICY budget_items_update ON public.budget_items;
CREATE POLICY budget_items_read ON public.budget_items FOR SELECT TO authenticated USING(
  mgl_private.project_access(company_id,project_id) AND (
    mgl_private.company_role(company_id) IN ('admin','pm','supervisor') OR
    EXISTS(SELECT 1 FROM public.tasks t WHERE t.company_id=budget_items.company_id AND t.project_id=budget_items.project_id AND t.budget_item_id=budget_items.id AND t.assignee_id=(select auth.uid()) AND t.deleted_at IS NULL)
  )
);
CREATE POLICY budget_items_update ON public.budget_items FOR UPDATE TO authenticated USING(
  mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[])
) WITH CHECK(
  mgl_private.project_write(company_id,project_id,ARRAY['admin','pm','supervisor','field_worker']::public.app_role[])
);
GRANT INSERT(stage_id) ON public.budget_items TO authenticated;
GRANT UPDATE(qty_actual,unit_price_actual,updated_at,mutation_id) ON public.budget_items TO authenticated;
GRANT UPDATE(stage_id) ON public.budget_items TO authenticated;

-- Material requests: el creador y el aprobador seleccionado pueden operar según trigger/RPC.
DROP POLICY material_requests_read ON public.material_requests;
DROP POLICY material_requests_update ON public.material_requests;
CREATE POLICY material_requests_read ON public.material_requests FOR SELECT TO authenticated USING(
  mgl_private.project_access(company_id,project_id) AND (
    requested_by=(select auth.uid()) OR approver_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm','supervisor')
  )
);
CREATE POLICY material_requests_update ON public.material_requests FOR UPDATE TO authenticated USING(
  mgl_private.project_access(company_id,project_id) AND (requested_by=(select auth.uid()) OR approver_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm','supervisor'))
) WITH CHECK(
  mgl_private.project_access(company_id,project_id) AND (requested_by=(select auth.uid()) OR approver_id=(select auth.uid()) OR mgl_private.company_role(company_id) IN ('admin','pm','supervisor'))
);
GRANT INSERT(approver_id,priority,stage_id,budget_item_id) ON public.material_requests TO authenticated;
GRANT UPDATE(needed_on,notes,approver_id,priority,stage_id,budget_item_id,deleted_at,updated_at,mutation_id) ON public.material_requests TO authenticated;



-- Propagación/validación de tenant en nuevas entidades. Evita company_id adulterado.
CREATE FUNCTION mgl_private.propagate_company_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company_id uuid;
BEGIN
  CASE TG_ARGV[0]
    WHEN 'project' THEN
      SELECT p.company_id INTO v_company_id FROM public.projects p
      WHERE p.id=NEW.project_id AND p.deleted_at IS NULL;
    WHEN 'recipient' THEN
      SELECT p.company_id INTO v_company_id FROM public.profiles p
      WHERE p.user_id=NEW.recipient_id AND p.deleted_at IS NULL;
    WHEN 'notification' THEN
      SELECT n.company_id INTO v_company_id FROM public.notifications n
      WHERE n.id=NEW.notification_id AND n.deleted_at IS NULL;
    WHEN 'user' THEN
      SELECT p.company_id INTO v_company_id FROM public.profiles p
      WHERE p.user_id=NEW.user_id AND p.deleted_at IS NULL;
    ELSE
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MGL: unsupported company propagation source';
  END CASE;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: cannot resolve tenant company';
  END IF;
  IF NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_company_id THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MGL: tenant company mismatch';
  END IF;
  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER b0_propagate_company BEFORE INSERT ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION mgl_private.propagate_company_id('project');
CREATE TRIGGER b0_propagate_company BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION mgl_private.propagate_company_id('recipient');
CREATE TRIGGER b0_propagate_company BEFORE INSERT ON public.notification_deliveries
FOR EACH ROW EXECUTE FUNCTION mgl_private.propagate_company_id('notification');
CREATE TRIGGER b0_propagate_company BEFORE INSERT ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION mgl_private.propagate_company_id('user');
CREATE TRIGGER b0_propagate_company BEFORE INSERT ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION mgl_private.propagate_company_id('user');

-- Revocar ejecución directa de helpers privados nuevos.
REVOKE ALL ON FUNCTION mgl_private.bump_version(),mgl_private.assign_default_stage(),mgl_private.seed_project_stages(),mgl_private.project_stage_guard(),mgl_private.recalculate_budget_cost_status(),mgl_private.material_request_guard(),mgl_private.ensure_user_preferences(),mgl_private.enqueue_notification(uuid,uuid,uuid,uuid,text,text,text,text,uuid,text,jsonb),mgl_private.notify_task_assignment(),mgl_private.notify_material_request(),mgl_private.notify_cost_alert(),mgl_private.cancel_unread_external_deliveries(),mgl_private.propagate_company_id() FROM PUBLIC,anon,authenticated;
