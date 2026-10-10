-- MGL Systems / Fase 8
-- Planificacion avanzada: EDT/WBS, cronograma, dependencias tipadas, linea base,
-- historial de avance y fuentes para Gantt / CPM / Curva S.

ALTER TABLE public.tasks
  ADD COLUMN wbs_code text NOT NULL DEFAULT '',
  ADD COLUMN task_type text NOT NULL DEFAULT 'activity',
  ADD COLUMN parent_task_id uuid,
  ADD COLUMN planned_weight numeric(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN budget_item_id uuid,
  ADD CONSTRAINT tasks_task_type_chk CHECK(task_type IN ('activity','milestone','summary')),
  ADD CONSTRAINT tasks_planned_weight_chk CHECK(planned_weight>=0),
  ADD CONSTRAINT tasks_parent_not_self_chk CHECK(parent_task_id IS NULL OR parent_task_id<>id),
  ADD CONSTRAINT tasks_milestone_dates_chk CHECK(task_type<>'milestone' OR (starts_on IS NOT NULL AND due_on=starts_on)),
  ADD CONSTRAINT tasks_parent_fk FOREIGN KEY(company_id,project_id,parent_task_id)
    REFERENCES public.tasks(company_id,project_id,id),
  ADD CONSTRAINT tasks_budget_item_fk FOREIGN KEY(company_id,project_id,budget_item_id)
    REFERENCES public.budget_items(company_id,project_id,id);

CREATE UNIQUE INDEX tasks_wbs_code_uidx
  ON public.tasks(company_id,project_id,wbs_code)
  WHERE deleted_at IS NULL AND wbs_code<>'';
CREATE INDEX tasks_parent_idx
  ON public.tasks(company_id,project_id,parent_task_id)
  WHERE deleted_at IS NULL AND parent_task_id IS NOT NULL;
CREATE INDEX tasks_budget_item_idx
  ON public.tasks(company_id,project_id,budget_item_id)
  WHERE deleted_at IS NULL AND budget_item_id IS NOT NULL;
CREATE INDEX tasks_schedule_dates_idx
  ON public.tasks(company_id,project_id,starts_on,due_on)
  WHERE deleted_at IS NULL;

ALTER TABLE public.task_dependencies
  ADD COLUMN dependency_type text NOT NULL DEFAULT 'FS',
  ADD COLUMN lag_days integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT task_dependencies_type_chk CHECK(dependency_type IN ('FS','SS','FF','SF')),
  ADD CONSTRAINT task_dependencies_lag_chk CHECK(lag_days BETWEEN -3650 AND 3650);

CREATE TABLE public.schedule_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  version_no integer NOT NULL CHECK(version_no>0),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded')),
  baseline_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  UNIQUE(company_id,project_id,id),
  UNIQUE(company_id,project_id,version_no),
  FOREIGN KEY(company_id,project_id) REFERENCES public.projects(company_id,id),
  FOREIGN KEY(company_id,created_by) REFERENCES public.profiles(company_id,user_id)
);
CREATE UNIQUE INDEX schedule_baselines_active_uidx
  ON public.schedule_baselines(company_id,project_id)
  WHERE deleted_at IS NULL AND status='active';
CREATE INDEX schedule_baselines_project_idx
  ON public.schedule_baselines(company_id,project_id,version_no DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE public.schedule_baseline_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  baseline_id uuid NOT NULL,
  task_id uuid NOT NULL,
  title text NOT NULL,
  wbs_code text NOT NULL DEFAULT '',
  task_type text NOT NULL CHECK(task_type IN ('activity','milestone','summary')),
  parent_task_id uuid,
  starts_on date,
  due_on date,
  planned_weight numeric(10,4) NOT NULL CHECK(planned_weight>=0),
  budget_item_id uuid,
  progress_at_baseline smallint NOT NULL CHECK(progress_at_baseline BETWEEN 0 AND 100),
  UNIQUE(company_id,project_id,baseline_id,id),
  UNIQUE(company_id,project_id,baseline_id,task_id),
  FOREIGN KEY(company_id,project_id,baseline_id) REFERENCES public.schedule_baselines(company_id,project_id,id)
);
CREATE INDEX schedule_baseline_tasks_project_idx
  ON public.schedule_baseline_tasks(company_id,project_id,baseline_id,wbs_code)
  WHERE deleted_at IS NULL;

CREATE TABLE public.schedule_baseline_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  baseline_id uuid NOT NULL,
  dependency_id uuid NOT NULL,
  task_id uuid NOT NULL,
  depends_on_task_id uuid NOT NULL,
  dependency_type text NOT NULL CHECK(dependency_type IN ('FS','SS','FF','SF')),
  lag_days integer NOT NULL CHECK(lag_days BETWEEN -3650 AND 3650),
  UNIQUE(company_id,project_id,baseline_id,dependency_id),
  FOREIGN KEY(company_id,project_id,baseline_id) REFERENCES public.schedule_baselines(company_id,project_id,id)
);
CREATE INDEX schedule_baseline_dependencies_idx
  ON public.schedule_baseline_dependencies(company_id,project_id,baseline_id,task_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.task_progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  server_updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  mutation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  deleted_at timestamptz,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL,
  task_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL,
  status public.task_status NOT NULL,
  progress smallint NOT NULL CHECK(progress BETWEEN 0 AND 100),
  UNIQUE(company_id,task_id,mutation_id),
  FOREIGN KEY(company_id,project_id,task_id) REFERENCES public.tasks(company_id,project_id,id)
);
CREATE INDEX task_progress_history_task_idx
  ON public.task_progress_history(company_id,project_id,task_id,recorded_at)
  WHERE deleted_at IS NULL;
CREATE INDEX task_progress_history_project_idx
  ON public.task_progress_history(company_id,project_id,recorded_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_baseline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_baseline_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_progress_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.schedule_baselines,public.schedule_baseline_tasks,public.schedule_baseline_dependencies,public.task_progress_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.schedule_baselines,public.schedule_baseline_tasks,public.schedule_baseline_dependencies,public.task_progress_history TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.schedule_baselines,public.schedule_baseline_tasks,public.schedule_baseline_dependencies,public.task_progress_history TO service_role;

CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_baselines
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_baseline_tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_baseline_dependencies
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();
CREATE TRIGGER a_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.task_progress_history
FOR EACH ROW EXECUTE FUNCTION mgl_private.row_guard();

CREATE POLICY schedule_baselines_read ON public.schedule_baselines FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY schedule_baseline_tasks_read ON public.schedule_baseline_tasks FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY schedule_baseline_dependencies_read ON public.schedule_baseline_dependencies FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id));
CREATE POLICY task_progress_history_read ON public.task_progress_history FOR SELECT TO authenticated
USING(mgl_private.project_access(company_id,project_id));

CREATE OR REPLACE FUNCTION mgl_private.validate_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_parent_type text;
  v_budget_type text;
  v_budget_status text;
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) AND NOT EXISTS (
    SELECT 1 FROM public.project_members m JOIN public.profiles p
      ON p.company_id=m.company_id AND p.user_id=m.user_id
    WHERE m.company_id=NEW.company_id AND m.project_id=NEW.project_id
      AND m.user_id=NEW.assignee_id AND m.deleted_at IS NULL AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: assignee is not an active project member';
  END IF;

  IF NEW.task_type='milestone' AND (NEW.starts_on IS NULL OR NEW.due_on IS DISTINCT FROM NEW.starts_on) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: milestone requires the same start and finish date';
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,8));
    SELECT p.task_type INTO v_parent_type
    FROM public.tasks p
    WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id
      AND p.id=NEW.parent_task_id AND p.deleted_at IS NULL;
    IF v_parent_type IS DISTINCT FROM 'summary' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: WBS parent must be an active summary task';
    END IF;
    IF EXISTS(
      WITH RECURSIVE parents(id,parent_task_id) AS (
        SELECT p.id,p.parent_task_id FROM public.tasks p
        WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id AND p.id=NEW.parent_task_id
        UNION ALL
        SELECT p.id,p.parent_task_id FROM public.tasks p
        JOIN parents a ON p.id=a.parent_task_id
        WHERE p.company_id=NEW.company_id AND p.project_id=NEW.project_id
      )
      SELECT 1 FROM parents WHERE id=NEW.id
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cyclic WBS hierarchy';
    END IF;
  END IF;

  IF NEW.budget_item_id IS NOT NULL THEN
    SELECT i.item_type,b.status INTO v_budget_type,v_budget_status
    FROM public.budget_items i
    JOIN public.project_budgets b ON b.company_id=i.company_id AND b.project_id=i.project_id AND b.id=i.budget_id
    WHERE i.company_id=NEW.company_id AND i.project_id=NEW.project_id
      AND i.id=NEW.budget_item_id AND i.deleted_at IS NULL AND b.deleted_at IS NULL;
    IF v_budget_type IS DISTINCT FROM 'item' OR v_budget_status IS DISTINCT FROM 'baseline' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: planning cost link must use a leaf item from the active budget baseline';
    END IF;
  END IF;

  IF mgl_private.company_role(NEW.company_id)='field_worker' THEN
    IF TG_OP='INSERT' AND (NEW.created_by<>auth.uid() OR NEW.assignee_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: workers create only self-assigned tasks';
    END IF;
    IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','progress','updated_at','server_updated_at','mutation_id']) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: workers may update only status and progress';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mgl_private.capture_task_progress() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.progress IS DISTINCT FROM OLD.progress OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_progress_history(
      id,company_id,project_id,task_id,recorded_at,status,progress,updated_at,mutation_id
    ) VALUES (
      gen_random_uuid(),NEW.company_id,NEW.project_id,NEW.id,NEW.updated_at,NEW.status,NEW.progress,
      NEW.updated_at,NEW.mutation_id
    ) ON CONFLICT(company_id,task_id,mutation_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION mgl_private.capture_task_progress() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS capture_task_progress ON public.tasks;
CREATE TRIGGER capture_task_progress AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION mgl_private.capture_task_progress();

INSERT INTO public.task_progress_history(
  id,company_id,project_id,task_id,recorded_at,status,progress,updated_at,mutation_id
)
SELECT gen_random_uuid(),t.company_id,t.project_id,t.id,t.updated_at,t.status,t.progress,t.updated_at,t.mutation_id
FROM public.tasks t
WHERE NOT EXISTS(
  SELECT 1 FROM public.task_progress_history h
  WHERE h.company_id=t.company_id AND h.task_id=t.id AND h.mutation_id=t.mutation_id
);

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
      v_allowed_keys := ARRAY['title','description','status','priority','assignee_id','starts_on','due_on','progress','position','wbs_code','task_type','parent_task_id','planned_weight','budget_item_id'];
    WHEN 'task_dependencies' THEN
      v_allowed_keys := ARRAY['task_id','depends_on_task_id','dependency_type','lag_days'];
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
              created_by,starts_on,due_on,progress,position,wbs_code,task_type,parent_task_id,planned_weight,budget_item_id,updated_at,mutation_id
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
              budget_item_id=CASE WHEN p_payload ? 'budget_item_id' THEN NULLIF(p_payload->>'budget_item_id','')::uuid ELSE t.budget_item_id END,
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
              id,company_id,project_id,task_id,depends_on_task_id,dependency_type,lag_days,updated_at,mutation_id
            ) VALUES (
              p_entity_id,v_company_id,p_project_id,
              (p_payload->>'task_id')::uuid,(p_payload->>'depends_on_task_id')::uuid,
              COALESCE(NULLIF(p_payload->>'dependency_type',''),'FS'),COALESCE((p_payload->>'lag_days')::integer,0),
              p_updated_at,p_mutation_id
            ) RETURNING pg_catalog.to_jsonb(task_dependencies.*) INTO v_row;
          WHEN 'update' THEN
            UPDATE public.task_dependencies d SET
              task_id=CASE WHEN p_payload ? 'task_id' THEN (p_payload->>'task_id')::uuid ELSE d.task_id END,
              depends_on_task_id=CASE WHEN p_payload ? 'depends_on_task_id' THEN (p_payload->>'depends_on_task_id')::uuid ELSE d.depends_on_task_id END,
              dependency_type=CASE WHEN p_payload ? 'dependency_type' THEN p_payload->>'dependency_type' ELSE d.dependency_type END,
              lag_days=CASE WHEN p_payload ? 'lag_days' THEN (p_payload->>'lag_days')::integer ELSE d.lag_days END,
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


CREATE OR REPLACE FUNCTION mgl_private.create_schedule_baseline(p_project_id uuid,p_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_company_id uuid;
  v_id uuid := gen_random_uuid();
  v_version integer;
  v_task_count integer;
  v_dependency_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='MGL: authentication required';
  END IF;
  IF length(trim(coalesce(p_name,'')))<2 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='MGL: baseline name is required';
  END IF;

  SELECT p.company_id INTO v_company_id
  FROM public.projects p
  WHERE p.id=p_project_id AND p.deleted_at IS NULL;
  IF v_company_id IS NULL OR NOT mgl_private.project_write(v_company_id,p_project_id,ARRAY['admin','pm']::public.app_role[]) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='MGL: planning baseline requires admin or pm access';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id::text,80));

  IF EXISTS(
    SELECT 1 FROM public.tasks t
    WHERE t.company_id=v_company_id AND t.project_id=p_project_id AND t.deleted_at IS NULL
      AND t.task_type IN ('activity','milestone')
      AND (t.starts_on IS NULL OR t.due_on IS NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: every activity and milestone needs planned dates before creating a baseline';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.tasks t
    WHERE t.company_id=v_company_id AND t.project_id=p_project_id AND t.deleted_at IS NULL
      AND t.task_type IN ('activity','milestone')
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: baseline requires at least one scheduled activity or milestone';
  END IF;

  SELECT coalesce(max(version_no),0)+1 INTO v_version
  FROM public.schedule_baselines
  WHERE company_id=v_company_id AND project_id=p_project_id;

  UPDATE public.schedule_baselines
  SET status='superseded',updated_at=clock_timestamp(),mutation_id=gen_random_uuid()
  WHERE company_id=v_company_id AND project_id=p_project_id AND status='active' AND deleted_at IS NULL;

  INSERT INTO public.schedule_baselines(
    id,company_id,project_id,version_no,name,status,baseline_at,created_by,updated_at,mutation_id
  ) VALUES(
    v_id,v_company_id,p_project_id,v_version,trim(p_name),'active',clock_timestamp(),auth.uid(),clock_timestamp(),gen_random_uuid()
  );

  INSERT INTO public.schedule_baseline_tasks(
    id,company_id,project_id,baseline_id,task_id,title,wbs_code,task_type,parent_task_id,
    starts_on,due_on,planned_weight,budget_item_id,progress_at_baseline,updated_at,mutation_id
  )
  SELECT gen_random_uuid(),t.company_id,t.project_id,v_id,t.id,t.title,t.wbs_code,t.task_type,t.parent_task_id,
    t.starts_on,t.due_on,t.planned_weight,t.budget_item_id,t.progress,clock_timestamp(),gen_random_uuid()
  FROM public.tasks t
  WHERE t.company_id=v_company_id AND t.project_id=p_project_id AND t.deleted_at IS NULL;
  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  INSERT INTO public.schedule_baseline_dependencies(
    id,company_id,project_id,baseline_id,dependency_id,task_id,depends_on_task_id,dependency_type,lag_days,updated_at,mutation_id
  )
  SELECT gen_random_uuid(),d.company_id,d.project_id,v_id,d.id,d.task_id,d.depends_on_task_id,d.dependency_type,d.lag_days,clock_timestamp(),gen_random_uuid()
  FROM public.task_dependencies d
  WHERE d.company_id=v_company_id AND d.project_id=p_project_id AND d.deleted_at IS NULL;
  GET DIAGNOSTICS v_dependency_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'id',v_id,'project_id',p_project_id,'version_no',v_version,'status','active',
    'task_count',v_task_count,'dependency_count',v_dependency_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_schedule_baseline(p_project_id uuid,p_name text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT mgl_private.create_schedule_baseline(p_project_id,p_name);
$$;
REVOKE ALL ON FUNCTION mgl_private.create_schedule_baseline(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mgl_private.create_schedule_baseline(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_schedule_baseline(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_schedule_baseline(uuid,text) TO authenticated;

CREATE OR REPLACE VIEW public.project_schedule_summary WITH(security_invoker=true) AS
WITH task_agg AS (
  SELECT t.company_id,t.project_id,
    count(*) FILTER(WHERE t.deleted_at IS NULL)::integer AS active_tasks,
    count(*) FILTER(WHERE t.deleted_at IS NULL AND t.task_type IN ('activity','milestone') AND t.starts_on IS NOT NULL AND t.due_on IS NOT NULL)::integer AS scheduled_tasks,
    count(*) FILTER(WHERE t.deleted_at IS NULL AND t.task_type<>'summary' AND t.due_on<CURRENT_DATE AND t.progress<100)::integer AS overdue_tasks,
    count(*) FILTER(WHERE t.deleted_at IS NULL AND t.task_type='milestone')::integer AS milestone_count,
    min(t.due_on) FILTER(WHERE t.deleted_at IS NULL AND t.task_type='milestone' AND t.progress<100 AND t.due_on>=CURRENT_DATE) AS next_milestone_on,
    CASE WHEN coalesce(sum(t.planned_weight) FILTER(WHERE t.deleted_at IS NULL AND t.task_type<>'summary'),0)>0
      THEN round(
        sum((t.progress::numeric/100)*t.planned_weight) FILTER(WHERE t.deleted_at IS NULL AND t.task_type<>'summary') /
        sum(t.planned_weight) FILTER(WHERE t.deleted_at IS NULL AND t.task_type<>'summary') * 100,2
      ) ELSE 0 END AS actual_progress_pct
  FROM public.tasks t
  GROUP BY t.company_id,t.project_id
), baseline AS (
  SELECT DISTINCT ON (b.company_id,b.project_id)
    b.company_id,b.project_id,b.id AS baseline_id,b.version_no AS baseline_version,b.name AS baseline_name,b.baseline_at
  FROM public.schedule_baselines b
  WHERE b.deleted_at IS NULL AND b.status='active'
  ORDER BY b.company_id,b.project_id,b.version_no DESC
)
SELECT p.id AS project_id,p.company_id,
  coalesce(a.active_tasks,0)::integer AS active_tasks,
  coalesce(a.scheduled_tasks,0)::integer AS scheduled_tasks,
  coalesce(a.overdue_tasks,0)::integer AS overdue_tasks,
  coalesce(a.milestone_count,0)::integer AS milestone_count,
  a.next_milestone_on,
  coalesce(a.actual_progress_pct,0)::numeric(8,2) AS actual_progress_pct,
  b.baseline_id,b.baseline_version,b.baseline_name,b.baseline_at
FROM public.projects p
LEFT JOIN task_agg a ON a.company_id=p.company_id AND a.project_id=p.id
LEFT JOIN baseline b ON b.company_id=p.company_id AND b.project_id=p.id
WHERE p.deleted_at IS NULL;

REVOKE ALL ON public.project_schedule_summary FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_schedule_summary TO authenticated,service_role;
