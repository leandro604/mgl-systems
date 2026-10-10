-- Fase 8 · integridad de EDT y red CPM.
-- Impide convertir un resumen con hijos en actividad/hito y evita dependencias sobre nodos resumen.

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

  IF NEW.task_type<>'summary' AND EXISTS(
    SELECT 1 FROM public.tasks child
    WHERE child.company_id=NEW.company_id AND child.project_id=NEW.project_id
      AND child.parent_task_id=NEW.id AND child.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: a WBS parent with active children must remain a summary task';
  END IF;

  IF NEW.task_type='summary' AND EXISTS(
    SELECT 1 FROM public.task_dependencies d
    WHERE d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.deleted_at IS NULL
      AND (d.task_id=NEW.id OR d.depends_on_task_id=NEW.id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: summary tasks cannot participate in CPM dependencies';
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

CREATE OR REPLACE FUNCTION mgl_private.validate_dependency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_schedulable_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,0));
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT count(*)::integer INTO v_schedulable_count
  FROM public.tasks t
  WHERE t.company_id=NEW.company_id AND t.project_id=NEW.project_id
    AND t.id IN (NEW.task_id,NEW.depends_on_task_id)
    AND t.deleted_at IS NULL AND t.task_type IN ('activity','milestone');
  IF v_schedulable_count<>2 THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: CPM dependencies require two active activity/milestone tasks';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.depends_on_task_id
      UNION
      SELECT d.depends_on_task_id FROM public.task_dependencies d JOIN ancestors a ON d.task_id=a.id
      WHERE d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.deleted_at IS NULL AND d.id<>NEW.id
    ) SELECT 1 FROM ancestors WHERE id=NEW.task_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MGL: cyclic task dependency';
  END IF;
  RETURN NEW;
END;
$$;
